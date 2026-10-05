import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
const input = z.object({ id: z.string().uuid(), recordedAt: z.iso.datetime(), playId: z.string().uuid().nullable() });
export async function GET() {
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user) return Response.json({ error: "로그인이 필요해요." }, { status: 401, headers });
  const result = await createAdminClient().from("record_fragments").select("fragment_id,recorded_at,play_topic").eq("user_id", data.user.id).eq("record_type", "voice").is("deleted_at", null).order("recorded_at", { ascending: false }).limit(50);
  return result.error ? Response.json({ error: "실행 이력을 불러오지 못했어요." }, { status: 500, headers }) : Response.json({ recordings: result.data || [] }, { headers });
}
export async function POST(request: Request) {
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("허용되지 않은 요청이에요.", 403);
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user) return fail("로그인이 필요해요.", 401);
  const raw = await request.text();
  if (raw.length > 1024) return fail("실행 정보가 너무 커요.", 413);
  const parsed = input.safeParse(await Promise.resolve().then(() => JSON.parse(raw)).catch(() => null));
  if (!parsed.success) return fail("실행 정보를 확인해 주세요.", 400);
  const admin = createAdminClient();
  let title: string | null = null;
  if (parsed.data.playId) {
    const play = await admin.from("play_clusters").select("title").eq("cluster_id", parsed.data.playId).eq("user_id", data.user.id).maybeSingle();
    if (play.error || !play.data) return fail("연결할 놀이를 찾지 못했어요.", 404);
    title = play.data.title;
  }
  // Only execution metadata: no audio bytes, transcript, or observation content.
  const result = await admin.from("record_fragments").upsert({ fragment_id: parsed.data.id, user_id: data.user.id, record_type: "voice", recorded_at: parsed.data.recordedAt, play_topic: title, tags: ["recording_execution_only"], raw_text: null }, { onConflict: "fragment_id", ignoreDuplicates: true });
  if (result.error) return fail("실행 이력을 남기지 못했어요.", 500);
  if (parsed.data.playId) {
    const owned = await admin.from("record_fragments").select("fragment_id").eq("fragment_id", parsed.data.id).eq("user_id", data.user.id).maybeSingle();
    if (owned.error || !owned.data) return fail("실행 이력을 확인하지 못했어요.", 404);
    const linked = await admin.from("play_fragment_links").upsert({ fragment_id: parsed.data.id, cluster_id: parsed.data.playId, user_id: data.user.id, link_source: "teacher", confirmed_at: new Date().toISOString() }, { onConflict: "cluster_id,fragment_id" });
    if (linked.error) return fail("실행 이력은 남았지만 놀이 연결을 완료하지 못했어요. 이력에서 다시 연결해 주세요.", 500);
  }
  return Response.json({ id: parsed.data.id }, { headers });
}
