export type Asset = { asset_id?: string; attachment_id?: string; image_bucket?: string; image_path?: string; image_original_file_name?: string; image_alt_text?: string; image_caption?: string; image_link_url?: string; attachment_bucket?: string; attachment_path?: string; attachment_original_file_name?: string; url?: string; [key: string]: unknown };
export type Block = { type: string; block_id?: string; body?: string; text?: string; assets?: Asset[]; attachments?: Asset[]; [key: string]: unknown };
export type ContentRecord = { id?: number; title: string; content: string; content_blocks?: Block[]; is_active: boolean; deleted: boolean; is_pinned?: boolean; notice_level?: string; popup_level?: string; audience?: string; priority?: number; popup_position?: string; display_start_at?: string | null; display_end_at?: string | null; image_path?: string; image_bucket?: string; image_alt_text?: string; link_url?: string; url?: string; [key: string]: unknown };
export function safeLink(value: unknown) { try { const url = new URL(String(value)); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } }
export function visible(row: ContentRecord, now = Date.now()) { return row.is_active && !row.deleted && (!row.display_start_at || Date.parse(row.display_start_at) <= now) && (!row.display_end_at || Date.parse(row.display_end_at) >= now); }
export function documentFrom(row: ContentRecord): Block {
  const blocks = row.content_blocks || [];
  const document = blocks.find(block => block.type === "document-v2");
  if (document) return { ...document, assets: document.assets || [], attachments: document.attachments || [] };
  const assets: Asset[] = [];
  const body = blocks.map((block, i) => {
    if (block.type === "divider") return "---";
    if (block.type === "image") { const asset = { ...block, asset_id: `legacy_${i}` }; assets.push(asset); return `[[이미지:${asset.asset_id}]]`; }
    if (block.type === "callout") return `:::callout|${block.callout_style || "info"}|${block.callout_title || "안내"}\n${block.text || ""}\n:::`;
    return `:::style|${block.text_style || "노멀"}|${block.text_color || "기본색"}|${block.highlight_color || "없음"}\n${block.text || ""}\n:::`;
  }).join("\n\n") || row.content;
  return { type: "document-v2", body, assets, attachments: [] };
}
