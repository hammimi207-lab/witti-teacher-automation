import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { documentFrom, type Asset, type ContentRecord } from "@/lib/platform-content";
export async function signAsset(asset: Asset) {
  const bucket = asset.image_bucket || asset.attachment_bucket;
  const path = asset.image_path || asset.attachment_path;
  if (!bucket || !path || !["platform-notice-images", "platform-notice-attachments", "platform-popup-images"].includes(bucket)) return { ...asset, url: "" };
  const { data } = await createAdminClient().storage.from(bucket).createSignedUrl(path, 3600, asset.attachment_path ? { download: asset.attachment_original_file_name || true } : undefined);
  return { ...asset, url: data?.signedUrl || "" };
}
export async function signContent(row: ContentRecord): Promise<ContentRecord> {
  if (row.image_path) return { ...row, url: (await signAsset(row)).url };
  const doc = documentFrom(row);
  return { ...row, content_blocks: [{ ...doc, assets: await Promise.all((doc.assets || []).map(signAsset)), attachments: await Promise.all((doc.attachments || []).map(signAsset)) }] };
}
export function assetReferences(row: ContentRecord) {
  const doc = documentFrom(row);
  const assets = row.image_path ? [row] : [...doc.assets || [], ...doc.attachments || []];
  return assets.flatMap(asset => {
    const bucket = asset.image_bucket || asset.attachment_bucket;
    const path = asset.image_path || asset.attachment_path;
    return typeof bucket === "string" && typeof path === "string" && path && ["platform-popup-images", "platform-notice-images", "platform-notice-attachments"].includes(bucket) ? [{ bucket, path }] : [];
  });
}
export async function cleanupContentAssets(previous: ContentRecord, next?: ContentRecord) {
  const keep = new Set(next ? assetReferences(next).map(ref => `${ref.bucket}/${ref.path}`) : []);
  for (const ref of assetReferences(previous)) {
    if (keep.has(`${ref.bucket}/${ref.path}`)) continue;
    const { error } = await createAdminClient().storage.from(ref.bucket).remove([ref.path]);
    if (error) throw error;
  }
}
