import { requireAdmin, sameOrigin } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signAsset } from "@/lib/platform-content-server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return Response.json({}, { status: 401 }); }
  if (!sameOrigin(request)) return Response.json({}, { status: 403 });
  if (Number(request.headers.get("content-length")) > 21 * 1024 * 1024) return Response.json({ error: "파일 크기가 너무 큽니다." }, { status: 413 });
  try {
    const form = await request.formData(); const file = form.get("file"); const kind = form.get("kind");
    if (!(file instanceof File) || !["popup", "image", "attachment"].includes(String(kind))) throw new Error();
    if (!file.size || file.size > (kind === "attachment" ? 20 : 10) * 1024 * 1024) throw new Error();
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let bytes: Buffer = Buffer.from(await file.arrayBuffer()); let extension = ext;
    let mime = ({ pdf: "application/pdf", hwp: "application/x-hwp", hwpx: "application/vnd.hancom.hwpx" } as Record<string, string>)[ext];
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) { bytes = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().png().toBuffer(); extension = "png"; mime = "image/png"; }
    else if (kind !== "attachment" || !mime || (ext === "pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") || (ext === "hwpx" && bytes.subarray(0, 2).toString() !== "PK") || (ext === "hwp" && bytes.subarray(0, 8).toString("hex") !== "d0cf11e0a1b11ae1")) throw new Error();
    const bucket = kind === "popup" ? "platform-popup-images" : kind === "image" ? "platform-notice-images" : "platform-notice-attachments";
    const path = `admin/${randomUUID()}.${extension}`;
    const { error } = await createAdminClient().storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw error;
    const prefix = kind === "attachment" ? "attachment" : "image";
    return Response.json(await signAsset({ [kind === "attachment" ? "attachment_id" : "asset_id"]: randomUUID(), [`${prefix}_bucket`]: bucket, [`${prefix}_path`]: path, [`${prefix}_original_file_name`]: file.name, [`${prefix}_mime_type`]: mime, [`${prefix}_size_bytes`]: bytes.length }));
  } catch { return Response.json({ error: "파일을 업로드하지 못했습니다. 이미지 10MB·첨부파일 20MB 이하의 JPG, PNG, WEBP, PDF, HWP, HWPX 파일인지 확인해 주세요." }, { status: 400 }); }
}
