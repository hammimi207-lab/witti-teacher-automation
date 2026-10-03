import { requireAdmin, sameOrigin } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signContent, cleanupContentAssets } from "@/lib/platform-content-server";
import { safeLink, type ContentRecord } from "@/lib/platform-content";
import { z } from "zod";
const schema = z.object({ id: z.number().int().positive().optional(), title: z.string().trim().min(1).max(120), content: z.string().max(20000), is_active: z.boolean(), deleted: z.boolean(), display_start_at: z.string().datetime({ offset: true }).nullable().optional(), display_end_at: z.string().datetime({ offset: true }).nullable().optional(), is_pinned: z.boolean().optional(), notice_level: z.enum(["일반", "중요", "점검"]).optional(), popup_level: z.enum(["일반", "중요", "점검"]).optional(), audience: z.enum(["all", "member"]).optional(), priority: z.number().int().min(0).max(1000).optional(), popup_position: z.enum(["top-left", "top-center", "top-right", "middle-left", "center", "middle-right", "bottom-left", "bottom-center", "bottom-right"]).optional(), link_url: z.string().max(1000).optional(), image_bucket: z.literal("platform-popup-images").optional(), image_path: z.string().max(500).optional(), image_alt_text: z.string().max(200).optional(), image_original_file_name: z.string().max(300).optional(), image_mime_type: z.string().optional(), image_size_bytes: z.number().optional(), content_blocks: z.array(z.object({ type: z.literal("document-v2"), block_id: z.string().optional(), body: z.string().max(20000), assets: z.array(z.record(z.string(), z.unknown())).max(30), attachments: z.array(z.record(z.string(), z.unknown())).max(5) })).max(1).optional() });
export async function GET(request: Request) {
  try { await requireAdmin(); } catch { return Response.json({}, { status: 401 }); }
  const kind = new URL(request.url).searchParams.get("kind");
  if (!["notices", "popups"].includes(kind || "")) return Response.json({}, { status: 400 });
  try {
    const db = createAdminClient(); const rows: ContentRecord[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await db.from(`platform_${kind}`).select("*").order("id", { ascending: false }).range(page * 500, page * 500 + 499);
      if (error) throw error;
      rows.push(...data as ContentRecord[]); if (data.length < 500) break;
    }
    return Response.json(await Promise.all(rows.map(signContent)), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "게시물을 불러오지 못했습니다." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return Response.json({}, { status: 401 }); }
  if (!sameOrigin(request)) return Response.json({}, { status: 403 });
  const body = await request.json().catch(() => null);
  const normalized = body?.record && typeof body.record === "object" ? Object.fromEntries(Object.entries(body.record).filter(([key, value]) => value !== null || ["display_start_at", "display_end_at"].includes(key))) : null;
  const parsed = schema.safeParse(normalized);
  if (!parsed.success || !["notices", "popups"].includes(body?.kind)) return Response.json({ error: "필수 입력과 파일 형식을 확인해 주세요." }, { status: 400 });
  const { id, ...input } = parsed.data;
  if (input.display_start_at && input.display_end_at && Date.parse(input.display_start_at) >= Date.parse(input.display_end_at)) return Response.json({ error: "종료 시각은 시작 시각보다 뒤여야 합니다." }, { status: 400 });
  if (input.link_url && !safeLink(input.link_url)) return Response.json({ error: "http 또는 https 링크를 입력해 주세요." }, { status: 400 });
  if (body.kind === "popups" && !input.image_path) return Response.json({ error: "팝업 이미지를 등록해 주세요." }, { status: 400 });
  if (body.kind === "notices" && !input.content.trim() && !input.content_blocks?.some(block => block.body.trim() || block.assets.length || block.attachments.length)) return Response.json({ error: "본문, 이미지 또는 첨부파일을 입력해 주세요." }, { status: 400 });
  // URL은 임시 서명 주소이므로 DB에 저장하지 않습니다.
  for (const block of input.content_blocks || []) for (const asset of [...block.assets, ...block.attachments]) {
    delete asset.url;
    if ((asset.image_bucket && asset.image_bucket !== "platform-notice-images") || (asset.attachment_bucket && asset.attachment_bucket !== "platform-notice-attachments") || (asset.image_link_url && !safeLink(asset.image_link_url))) return Response.json({ error: "이미지 저장소 또는 연결 링크가 올바르지 않습니다." }, { status: 400 });
  }
  try {
    const db = createAdminClient();
    const previousResult = id ? await db.from(`platform_${body.kind}`).select("*").eq("id", id).single() : null;
    if (previousResult?.error) throw previousResult.error;
    const payload = body.kind === "notices" ? { title: input.title, content: input.content, content_blocks: input.content_blocks, content_format: "document-v2", notice_level: input.notice_level || "일반", is_pinned: input.is_pinned || false, is_active: input.is_active, deleted: input.deleted, display_start_at: input.display_start_at, display_end_at: input.display_end_at } : { ...input, content: input.content || "이미지형 팝업", link_label: "이미지 열기" };
    const query = id ? db.from(`platform_${body.kind}`).update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id) : db.from(`platform_${body.kind}`).insert({ ...payload, created_by: "admin", ...(body.kind === "notices" && input.is_active ? { published_at: new Date().toISOString() } : {}) });
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    let cleanupWarning = "";
    if (previousResult?.data) { try { await cleanupContentAssets(previousResult.data as ContentRecord, data as ContentRecord); } catch { cleanupWarning = "게시물은 저장했지만 이전 파일 정리가 완료되지 않았습니다."; } }
    return Response.json({ ...await signContent(data as ContentRecord), ...(cleanupWarning ? { cleanupWarning } : {}) });
  } catch { return Response.json({ error: "저장하지 못했습니다. 입력 내용은 유지됩니다." }, { status: 503 }); }
}
