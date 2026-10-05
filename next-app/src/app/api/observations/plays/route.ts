import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const reply = (error: string, status: number) => Response.json({ error }, { status, headers });
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), title: z.string().trim().min(1).max(100) }),
  z.object({ action: z.literal("link"), fragmentId: z.string().uuid(), clusterId: z.string().uuid() }),
  z.object({ action: z.literal("unlink"), fragmentId: z.string().uuid() }),
]);

async function access() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  return error || !user ? null : { userId: user.id, admin: createAdminClient() };
}

export async function GET() {
  const auth = await access();
  if (!auth) return reply("로그인이 필요해요.", 401);
  const [clusters, links] = await Promise.all([
    auth.admin.from("play_clusters").select("cluster_id,title").eq("user_id", auth.userId).order("created_at", { ascending: false }).limit(100),
    auth.admin.from("play_fragment_links").select("fragment_id,cluster_id").eq("user_id", auth.userId).not("confirmed_at", "is", null).limit(100),
  ]);
  if (clusters.error || links.error) return reply("놀이 연결을 불러오지 못했어요.", 500);
  return Response.json({ plays: (clusters.data || []).filter(row => row.title), links: links.data || [] }, { headers });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("허용되지 않은 요청이에요.", 403);
  const auth = await access();
  if (!auth) return reply("로그인이 필요해요.", 401);
  if (Number(request.headers.get("content-length") || 0) > 4096) return reply("요청이 너무 커요.", 413);
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply("놀이 연결 정보를 확인해 주세요.", 400);
  const input = parsed.data;
  if (input.action === "create") {
    const title = input.title.trim();
    const existing = await auth.admin.from("play_clusters").select("cluster_id,title").eq("user_id", auth.userId).eq("title", title).limit(1).maybeSingle();
    if (existing.error) return reply("놀이 목록을 확인하지 못했어요.", 500);
    if (existing.data) return Response.json({ play: existing.data }, { headers });
    const created = await auth.admin.from("play_clusters").insert({ user_id: auth.userId, title }).select("cluster_id,title").single();
    return created.error ? reply("새 놀이를 만들지 못했어요.", 500) : Response.json({ play: created.data }, { headers });
  }
  const fragment = await auth.admin.from("record_fragments").select("fragment_id").eq("fragment_id", input.fragmentId).eq("user_id", auth.userId).eq("record_type", "voice").is("deleted_at", null).maybeSingle();
  if (fragment.error || !fragment.data) return reply("녹음을 찾지 못했어요.", 404);
  if (input.action === "link") {
    const play = await auth.admin.from("play_clusters").select("cluster_id").eq("cluster_id", input.clusterId).eq("user_id", auth.userId).maybeSingle();
    if (play.error || !play.data) return reply("놀이를 찾지 못했어요.", 404);
  }
  const previous = await auth.admin.from("play_fragment_links").select("cluster_id").eq("fragment_id", input.fragmentId).eq("user_id", auth.userId).not("confirmed_at", "is", null);
  if (previous.error) return reply("기존 연결을 확인하지 못했어요.", 500);
  if (input.action === "link" && previous.data?.some(row => row.cluster_id === input.clusterId)) return Response.json({ saved: true }, { headers });
  const removed = await auth.admin.from("play_fragment_links").delete().eq("fragment_id", input.fragmentId).eq("user_id", auth.userId).not("confirmed_at", "is", null);
  if (removed.error) return reply("기존 연결을 변경하지 못했어요.", 500);
  if (input.action === "unlink") return Response.json({ saved: true }, { headers });
  const linked = await auth.admin.from("play_fragment_links").upsert({ fragment_id: input.fragmentId, cluster_id: input.clusterId, user_id: auth.userId, link_source: "teacher", confirmed_at: new Date().toISOString() }, { onConflict: "cluster_id,fragment_id" });
  if (linked.error) {
    if (previous.data?.[0]) await auth.admin.from("play_fragment_links").upsert({ fragment_id: input.fragmentId, cluster_id: previous.data[0].cluster_id, user_id: auth.userId, link_source: "teacher", confirmed_at: new Date().toISOString() }, { onConflict: "cluster_id,fragment_id" });
    return reply("놀이를 연결하지 못했어요. 다시 시도해 주세요.", 500);
  }
  return Response.json({ saved: true }, { headers });
}
