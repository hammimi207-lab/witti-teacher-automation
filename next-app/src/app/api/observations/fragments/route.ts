import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const error = (message: string, status: number) => Response.json({ error: message }, { status, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return error("허용되지 않은 요청이에요.", 403);
  const parsed = z.object({ sourceId: z.string().uuid(), text: z.string().trim().min(1).max(100000), kind: z.enum(["child_speech", "observation"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("저장할 문장을 확인해 주세요.", 400);
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return error("로그인이 필요해요.", 401);
  const admin = createAdminClient();
  const source = await admin.from("record_fragments").select("recorded_at,play_topic").eq("fragment_id", parsed.data.sourceId).eq("user_id", auth.user.id).eq("record_type", "voice").is("deleted_at", null).maybeSingle();
  if (!source.data) return error("원본 녹음을 찾지 못했어요.", 404);
  const saved = await admin.from("record_fragments").insert({ user_id: auth.user.id, record_type: "text", recorded_at: source.data.recorded_at, play_topic: source.data.play_topic, raw_text: parsed.data.text, tags: [parsed.data.kind, `source_audio:${parsed.data.sourceId}`] }).select("fragment_id").single();
  if (saved.error) return error("기록 조각을 저장하지 못했어요.", 500);
  return Response.json({ id: saved.data.fragment_id }, { headers });
}
