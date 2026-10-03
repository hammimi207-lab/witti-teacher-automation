import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const bucket = "record-audio";
const headers = { "Cache-Control": "private, no-store" };
const inputSchema = z.object({ startedAt: z.iso.datetime({ offset: true }), endedAt: z.iso.datetime({ offset: true }), durationMs: z.coerce.number().int().min(0).max(600000), playTopic: z.string().max(300) });
const reply = (error: string, status: number) => Response.json({ error }, { status, headers });

async function access() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, admin: createAdminClient() };
}

export async function GET() {
  const auth = await access();
  if (!auth) return reply("로그인이 필요해요.", 401);
  const { data, error } = await auth.admin.from("record_fragments").select("fragment_id,recorded_at,play_topic,raw_text,record_audio(storage_path,mime_type,duration_ms,started_at,ended_at,transcription_status),record_transcriptions(raw_transcription,teacher_edited_transcription,created_at)").eq("user_id", auth.userId).eq("record_type", "voice").is("deleted_at", null).order("recorded_at", { ascending: false }).limit(50);
  if (error) return reply("녹음 목록을 불러오지 못했어요.", 500);
  return Response.json({ recordings: data }, { headers });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("허용되지 않은 요청이에요.", 403);
  const auth = await access();
  if (!auth) return reply("로그인이 필요해요.", 401);
  if (Number(request.headers.get("content-length") || 0) > 4_100_000) return reply("녹음 크기가 너무 커요.", 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return reply("녹음을 읽지 못했어요.", 400); }
  const parsed = inputSchema.safeParse(Object.fromEntries(["startedAt", "endedAt", "durationMs", "playTopic"].map(key => [key, form.get(key)])));
  const audio = form.get("audio");
  if (!parsed.success || !(audio instanceof File) || !audio.size || audio.size > 4_000_000) return reply("녹음 정보를 확인해 주세요.", 400);
  const mime = audio.type.split(";")[0];
  const extension = mime === "audio/mp4" ? "m4a" : mime === "audio/ogg" ? "ogg" : mime === "audio/webm" ? "webm" : null;
  if (!extension || Date.parse(parsed.data.endedAt) < Date.parse(parsed.data.startedAt)) return reply("녹음 형식이나 시간을 확인해 주세요.", 400);
  const id = crypto.randomUUID();
  const path = `${auth.userId}/${id}/original.${extension}`;
  const uploaded = await auth.admin.storage.from(bucket).upload(path, audio, { contentType: mime, upsert: false });
  if (uploaded.error) return reply("원본 녹음을 저장하지 못했어요. 저장소 설정을 확인해 주세요.", 503);
  const fragment = await auth.admin.from("record_fragments").insert({ fragment_id: id, user_id: auth.userId, record_type: "voice", recorded_at: parsed.data.startedAt, play_topic: parsed.data.playTopic || null }).select("fragment_id").single();
  if (fragment.error) { await auth.admin.storage.from(bucket).remove([path]); return reply("녹음 기록을 저장하지 못했어요.", 500); }
  const detail = await auth.admin.from("record_audio").insert({ fragment_id: id, user_id: auth.userId, storage_bucket: bucket, storage_path: path, mime_type: mime, size_bytes: audio.size, duration_ms: parsed.data.durationMs, started_at: parsed.data.startedAt, ended_at: parsed.data.endedAt, transcription_status: "not_requested" });
  if (detail.error) { await auth.admin.from("record_fragments").delete().eq("fragment_id", id).eq("user_id", auth.userId); await auth.admin.storage.from(bucket).remove([path]); return reply("녹음 정보를 저장하지 못했어요.", 500); }
  return Response.json({ id }, { headers });
}
