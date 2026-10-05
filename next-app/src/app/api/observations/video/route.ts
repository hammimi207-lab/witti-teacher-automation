import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { videoObservationPrompt, videoObservationSchema } from "@/features/records/video-observation-schema";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };
const reply = (error: string, status: number) => Response.json({ error }, { status, headers });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("이 사이트에서 다시 요청해 주세요.", 403);
  if (Number(request.headers.get("content-length") || 0) > 4_000_000) return reply("분석용 음성과 장면이 너무 커요. 더 짧은 영상을 선택해 주세요.", 413);
  try {
    const { data, error } = await (await createClient()).auth.getUser();
    if (error || !data.user) return reply("로그인한 뒤 영상 관찰을 이용해 주세요.", 401);
    const form = await request.formData();
    if (form.get("consent") !== "accepted") return reply("영상·음성 AI 분석 전송을 확인해 주세요.", 403);
    const audioOnly = form.has("audio");
    const video = form.get(audioOnly ? "audio" : "video"), frames = form.getAll("frames");
    const duration = z.coerce.number().positive().max(90).parse(form.get("duration"));
    const timestamps = z.array(z.number().min(0).max(duration)).min(1).max(8).parse(JSON.parse(String(form.get("timestamps"))));
    if (!(video instanceof File) || !video.size || video.size > 3_000_000) return reply("분석용 영상 또는 추출 음성이 비어 있거나 너무 커요.", 413);
    if (!(audioOnly ? ["audio/wav"] : ["video/mp4", "video/webm"]).includes(video.type)) return reply("영상 또는 추출 음성 형식을 확인해 주세요.", 415);
    if (frames.length !== timestamps.length || frames.some(file => !(file instanceof File) || file.type !== "image/jpeg" || !file.size || file.size > 100000))
      return reply("영상 장면을 다시 추출해 주세요.", 400);
    if (timestamps.some((value, index) => index > 0 && value <= timestamps[index - 1])) return reply("영상의 시간 정보를 확인해 주세요.", 400);
    if (!process.env.OPENAI_API_KEY) return reply("영상 분석 연결이 설정되지 않았어요.", 503);
    const images = await Promise.all((frames as File[]).map(async (file, index) => {
      const bytes = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 1_000_000 }).resize(480, 480, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
      return [{ type: "input_text" as const, text: `${timestamps[index]}초 장면` },
        { type: "input_image" as const, image_url: `data:image/jpeg;base64,${bytes.toString("base64")}`, detail: "low" as const }];
    }));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90000, maxRetries: 0 });
    let transcript = "", transcriptNote = "";
    try {
      const result = await client.audio.transcriptions.create({
        file: new File([video], `observation.${audioOnly ? "wav" : video.type === "video/mp4" ? "mp4" : "webm"}`, { type: video.type }),
        model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe", language: "ko", response_format: "json",
      }, { signal: request.signal });
      transcript = result.text.trim();
      if (!transcript) transcriptNote = "인식된 말소리가 없어 영상 장면만 분석했어요.";
    } catch (cause) {
      if (cause instanceof OpenAI.APIError && (cause.status === 400 || cause.status === 422))
        transcriptNote = "음성이 없거나 읽을 수 없어 영상 장면만 분석했어요. 원본을 확인해 주세요.";
      else throw cause;
    }
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini", store: false,
      input: [{ role: "user", content: [{ type: "input_text", text: videoObservationPrompt(transcript) }, ...images.flat()] }],
      text: { format: zodTextFormat(videoObservationSchema, "video_observation") }, max_output_tokens: 5000,
    }, { signal: request.signal });
    if (!response.output_parsed) return reply("영상 관찰 결과를 읽지 못했어요. 다시 시도해 주세요.", 502);
    const result = videoObservationSchema.parse(response.output_parsed);
    result.stages = result.classification === "활동" || result.classification === "판단 어려움" ? [] : result.stages.filter(stage => stage.second <= duration);
    return Response.json({ data: result, transcript, transcriptNote, userId: data.user.id }, { headers });
  } catch (cause) {
    if (cause instanceof z.ZodError || cause instanceof SyntaxError) return reply("90초 이하 영상과 장면 정보를 다시 확인해 주세요.", 400);
    if (cause instanceof OpenAI.APIError) {
      if (cause.status === 429) return reply("사용 한도에 도달했거나 요청이 많아요. 잠시 후 다시 시도해 주세요.", 429);
      if (cause.status === 401 || cause.status === 403) return reply("영상 분석 서비스 연결을 확인해 주세요.", 503);
    }
    return reply("영상을 분석하지 못했어요. 파일 재생과 연결 상태를 확인한 뒤 다시 시도해 주세요.", 502);
  }
}
