import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_AUDIO_BYTES = 4_000_000; // Keep multipart requests below the deployment's body limit.
const headers = { "Cache-Control": "private, no-store" };
const extensions: Record<string, string> = { "audio/webm": "webm", "video/webm": "webm", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "video/mp4": "mp4", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3" };

// The existing proxy enforces the same signed trial-consent policy as record generation.
// Audio is forwarded in memory, never persisted to Supabase, disk, or application logs.
export async function POST(request: Request) {
  const reply = (error: string, status: number) => Response.json({ error }, { status, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("이 사이트에서 다시 전사를 요청해 주세요.", 403);
  if (Number(request.headers.get("content-length") || 0) > MAX_AUDIO_BYTES + 64_000) return reply("전사할 음성이 너무 커요. 음성을 내려받고 짧게 나누어 녹음해 주세요.", 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return reply("음성 파일을 읽지 못했어요. 다시 시도해 주세요.", 400); }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return reply("녹음된 음성이 없어요. 다시 녹음해 주세요.", 400);
  if (audio.size > MAX_AUDIO_BYTES) return reply("전사할 음성이 너무 커요. 음성을 내려받고 짧게 나누어 녹음해 주세요.", 413);
  const type = audio.type.split(";")[0].trim().toLowerCase(), extension = extensions[type];
  if (!extension) return reply("지원하지 않는 음성 형식이에요. 최신 브라우저에서 다시 녹음해 주세요.", 415);
  if (!process.env.OPENAI_API_KEY) return reply("음성 전사 연결이 설정되지 않았어요. 관리자에게 확인해 주세요.", 503);
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 100000, maxRetries: 0 });
    const result = await client.audio.transcriptions.create({
      file: new File([audio], `observation.${extension}`, { type }),
      model: "gpt-4o-mini-transcribe", language: "ko", response_format: "json",
    }, { signal: request.signal });
    return Response.json({ text: result.text || "" }, { headers });
  } catch (error) {
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    if (status === 429) return reply("전사 요청이 많거나 사용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.", 429);
    if (status === 400 || status === 422) return reply("음성을 전사하지 못했어요. 녹음이 정상적으로 재생되는지 확인해 주세요.", 422);
    if (status === 401 || status === 403) return reply("전사 서비스 연결을 확인해 주세요. 원본 녹음은 그대로 남아 있어요.", 503);
    return reply("전사 서비스에 연결하지 못했어요. 원본 녹음은 그대로예요. 잠시 후 다시 시도해 주세요.", 502);
  }
}
