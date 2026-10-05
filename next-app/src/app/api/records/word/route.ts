import { z } from "zod";
import sharp from "sharp";
import { Packer } from "docx";
import { recordInputSchema } from "@/features/records/schema";
import { generatedSchema } from "@/features/records/result-schema";
import { buildStoryWordDocument } from "@/features/records/story-word-document";
import { photoAccess, PHOTO_BUCKET, privateHeaders, sameOrigin } from "@/lib/record-photos";

export const runtime = "nodejs";
const payloadSchema = z.object({
  title: z.string().max(200), result: generatedSchema,
  input: recordInputSchema.nullish(), recordType: z.string().max(100).nullish(),
  createdAt: z.string().max(100).nullish(), plain: z.string().max(100000).default(""),
  edited: z.string().max(100000).default(""), sessionId: z.string().uuid().nullish(),
  photoIds: z.array(z.number().int().positive().safe()).max(5).optional(),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try {
    const { userId, admin } = await photoAccess();
    const form = await request.formData();
    const metadata = form.get("record");
    if (typeof metadata !== "string" || metadata.length > 300000) throw new Error("INVALID");
    let parsed;
    try { parsed = payloadSchema.safeParse(JSON.parse(metadata)); } catch { throw new Error("INVALID"); }
    if (!parsed.success) throw new Error("INVALID");
    const record = parsed.data;
    const sources: Blob[] = [];
    if (record.sessionId) {
      // Stored photos are authoritative: never resurrect a deleted photo from a stale preview.
      let query = admin.from("photo_records").select("storage_bucket,file_path").eq("user_id", userId).eq("deleted", false);
      query = record.photoIds ? query.in("id", record.photoIds) : query.eq("session_id", record.sessionId);
      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      for (const photo of data || []) {
        if (photo.storage_bucket !== PHOTO_BUCKET) throw new Error("PHOTO");
        const downloaded = await admin.storage.from(PHOTO_BUCKET).download(photo.file_path);
        if (downloaded.error || !downloaded.data) throw new Error("PHOTO");
        sources.push(downloaded.data);
      }
    } else {
      const files = form.getAll("photo");
      if (files.length > 5 || files.some(file => !(file instanceof File) || file.size > 600000 || !file.size)) throw new Error("INVALID");
      sources.push(...files as File[]);
    }
    const photos = [];
    for (const source of sources) {
      const { data, info } = await sharp(Buffer.from(await source.arrayBuffer()), { limitInputPixels: 20000000 }).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).flatten({ background: "white" }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
      photos.push({ data: new Uint8Array(data), width: info.width, height: info.height });
    }
    const document = buildStoryWordDocument(record.title, record.result, record.input, record.createdAt, { ...record, photos });
    const buffer = await Packer.toBuffer(document);
    return new Response(new Uint8Array(buffer), { headers: { ...privateHeaders,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=record.docx", "X-Record-Word-Layout": "2026-09-19-server",
    } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "INVALID" ? 400 : 500;
    return Response.json({ error: status === 401 ? "로그인 후 다시 다운로드해 주세요." : status === 400 ? "기록이나 사진 정보를 확인해 주세요." : "Word 문서를 만들지 못했습니다. 다시 시도해 주세요. 기록 내용은 유지됩니다." }, { status, headers: privateHeaders });
  }
}
