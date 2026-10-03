import OpenAI from "openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (error: string, status: number) => Response.json({ error }, { status, headers });
async function owned(context: Context) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return null;
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("record_audio").select("storage_bucket,storage_path,mime_type,transcription_status").eq("fragment_id", id).eq("user_id", auth.user.id).maybeSingle();
  const { data: fragment } = await admin.from("record_fragments").select("fragment_id,deleted_at").eq("fragment_id", id).eq("user_id", auth.user.id).eq("record_type", "voice").maybeSingle();
  return data && fragment && !fragment.deleted_at ? { id, userId: auth.user.id, admin, audio: data } : null;
}

export async function GET(_request: Request, context: Context) {
  const item = await owned(context);
  if (!item) return reply("녹음을 찾지 못했어요.", 404);
  const file = await item.admin.storage.from(item.audio.storage_bucket).download(item.audio.storage_path);
  if (file.error || !file.data) return reply("원본 녹음을 읽지 못했어요.", 500);
  return new Response(file.data, { headers: { ...headers, "Content-Type": item.audio.mime_type } });
}

export async function POST(request: Request, context: Context) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("허용되지 않은 요청이에요.", 403);
  const item = await owned(context);
  if (!item) return reply("녹음을 찾지 못했어요.", 404);
  if (!process.env.OPENAI_API_KEY) return reply("전사 연결이 설정되지 않았어요.", 503);
  const file = await item.admin.storage.from(item.audio.storage_bucket).download(item.audio.storage_path);
  if (file.error || !file.data) return reply("원본 녹음을 읽지 못했어요.", 500);
  await item.admin.from("record_audio").update({ transcription_status: "pending" }).eq("fragment_id", item.id).eq("user_id", item.userId);
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 100000, maxRetries: 0 });
    const extension = item.audio.mime_type === "audio/mp4" ? "m4a" : item.audio.mime_type === "audio/ogg" ? "ogg" : "webm";
    const result = await client.audio.transcriptions.create({ file: new File([file.data], `observation.${extension}`, { type: item.audio.mime_type }), model: "gpt-4o-mini-transcribe", language: "ko", response_format: "json" }, { signal: request.signal });
    const text = result.text || "";
    const saved = await item.admin.from("record_transcriptions").insert({ fragment_id: item.id, user_id: item.userId, raw_transcription: text, model: "gpt-4o-mini-transcribe" });
    if (saved.error) throw saved.error;
    await item.admin.from("record_audio").update({ transcription_status: "done" }).eq("fragment_id", item.id).eq("user_id", item.userId);
    return Response.json({ rawTranscription: text }, { headers });
  } catch {
    await item.admin.from("record_audio").update({ transcription_status: "error" }).eq("fragment_id", item.id).eq("user_id", item.userId);
    return reply("전사에 실패했어요. 원본 녹음은 보존되어 있습니다.", 502);
  }
}

export async function PATCH(request: Request, context: Context) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("허용되지 않은 요청이에요.", 403);
  const item = await owned(context);
  if (!item) return reply("녹음을 찾지 못했어요.", 404);
  const body = await request.json().catch(() => null);
  const parsed = z.object({ teacherEditedTranscription: z.string().max(100000) }).safeParse(body);
  if (!parsed.success) return reply("수정 전사문을 확인해 주세요.", 400);
  const { data } = await item.admin.from("record_transcriptions").select("transcription_id").eq("fragment_id", item.id).eq("user_id", item.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return reply("전사 원문이 없어요.", 409);
  const result = await item.admin.from("record_transcriptions").update({ teacher_edited_transcription: parsed.data.teacherEditedTranscription }).eq("transcription_id", data.transcription_id).eq("user_id", item.userId);
  if (result.error) return reply("수정 전사문을 저장하지 못했어요.", 500);
  return Response.json({ saved: true }, { headers });
}

export async function DELETE(request: Request, context: Context) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("허용되지 않은 요청이에요.", 403);
  const item = await owned(context);
  if (!item) return reply("녹음을 찾지 못했어요.", 404);
  const result = await item.admin.from("record_fragments").update({ deleted_at: new Date().toISOString() }).eq("fragment_id", item.id).eq("user_id", item.userId);
  if (result.error) return reply("녹음을 삭제하지 못했어요.", 500);
  return Response.json({ deleted: true }, { headers });
}
