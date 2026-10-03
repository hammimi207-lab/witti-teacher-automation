import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const reply = (error: string, status: number) => Response.json({ error }, { status, headers });
const inputSchema = z.object({ fragmentId: z.string().uuid(), note: z.string().max(2000).default("") });
const outputSchema = z.object({ suggestions: z.array(z.object({ title: z.string(), reason: z.string() })).max(3) });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("허용되지 않은 요청이에요.", 403);
  if (Number(request.headers.get("content-length") || 0) > 4096) return reply("메모가 너무 길어요.", 413);
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return reply("녹음 정보를 확인해 주세요.", 400);
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return reply("로그인이 필요해요.", 401);
  const admin = createAdminClient();
  const fragment = await admin.from("record_fragments").select("fragment_id,recorded_at,play_topic").eq("fragment_id", input.data.fragmentId).eq("user_id", user.id).eq("record_type", "voice").is("deleted_at", null).maybeSingle();
  if (fragment.error || !fragment.data) return reply("녹음을 찾지 못했어요.", 404);
  const [transcriptions, plays, recent] = await Promise.all([
    admin.from("record_transcriptions").select("raw_transcription,teacher_edited_transcription").eq("fragment_id", input.data.fragmentId).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
    admin.from("play_clusters").select("title").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    admin.from("record_fragments").select("play_topic").eq("user_id", user.id).not("play_topic", "is", null).order("recorded_at", { ascending: false }).limit(20),
  ]);
  if (transcriptions.error || plays.error || recent.error) return reply("제안에 필요한 기록을 읽지 못했어요.", 500);
  const transcript = transcriptions.data?.[0]?.teacher_edited_transcription || transcriptions.data?.[0]?.raw_transcription || "";
  if (!transcript.trim() && !input.data.note.trim()) return reply("전사문이나 메모가 있어야 후보를 제안할 수 있어요.", 409);
  if (!process.env.OPENAI_API_KEY) return reply("AI 연결을 확인해 주세요.", 503);
  const titles = [...new Set([...(plays.data || []).map(item => item.title), ...(recent.data || []).map(item => item.play_topic)].filter((title): title is string => Boolean(title)))];
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45000, maxRetries: 0 });
    const result = await openai.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini", store: false,
      input: [
        { role: "developer", content: "당신은 교사의 놀이 기록 분류를 돕습니다. 놀이명을 확정하지 말고 후보를 최대 3개 제안하세요. 전사문·교사 메모에 드러난 재료나 행동을 근거로 쓰고, 기존 놀이명과 맞으면 그대로 사용하세요. 근거 없는 사건·아이 이름·발달 평가는 만들지 마세요. 녹음 시간만으로 놀이를 추정하지 마세요. 근거가 부족하면 빈 배열을 반환하세요. 각 reason은 확인 가능한 짧은 근거로 작성하세요." },
        { role: "user", content: JSON.stringify({ transcript: transcript.slice(0, 10000), teacherNote: input.data.note, recordedAt: fragment.data.recorded_at, existingPlayTitles: titles.slice(0, 50) }) },
      ],
      text: { format: zodTextFormat(outputSchema, "play_suggestions") }, max_output_tokens: 1200,
    }, { signal: request.signal });
    const suggestions = (result.output_parsed?.suggestions || []).map(item => ({ title: item.title.trim().slice(0, 100), reason: item.reason.trim().slice(0, 300) })).filter(item => item.title && item.reason);
    return Response.json({ suggestions }, { headers });
  } catch {
    return reply("놀이 후보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.", 502);
  }
}
