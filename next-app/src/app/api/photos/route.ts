import { z } from "zod";
import sharp from "sharp";
import { photoAccess, photoError, PHOTO_BUCKET, privateHeaders, sameOrigin } from "@/lib/record-photos";
import { readAIConsent } from "@/features/records/ai-consent";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { userId, admin } = await photoAccess();
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    const rawIds = new URL(request.url).searchParams.get("ids");
    const ids = rawIds ? z.array(z.coerce.number().int().positive().safe()).min(1).max(5).safeParse(rawIds.split(",")) : null;
    if (ids && !ids.success) return Response.json({ error: "사진 번호를 확인해 주세요." }, { status: 400 });
    if (sessionId && !z.string().uuid().safeParse(sessionId).success) return Response.json({ error: "기록 번호를 확인해 주세요." }, { status: 400 });
    let query = admin.from("photo_records").select("id,session_id,original_file_name,created_at").eq("user_id", userId).eq("deleted", false).order("created_at", { ascending: true });
    if (ids?.success) query = query.in("id", ids.data);
    else if (sessionId) query = query.eq("session_id", sessionId);
    // Paginate the personal gallery; a saved record contains at most five new photos.
    const offset = Math.max(0, Math.min(1000000, Number(new URL(request.url).searchParams.get("offset")) || 0));
    const { data, error } = await query.range(offset, offset + 99);
    if (error) throw error;
    return Response.json({ photos: (data || []).map(photo => ({ ...photo, url: `/api/photos/${photo.id}` })), hasMore: data?.length === 100 }, { headers: privateHeaders });
  } catch (error) { return photoError(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try {
    const { userId, admin } = await photoAccess();
    const form = await request.formData();
    const sessionId = z.string().uuid().parse(form.get("sessionId"));
    const slot = z.coerce.number().int().min(0).max(4).parse(form.get("slot"));
    const file = form.get("photo");
    if (!(file instanceof File) || file.type !== "image/jpeg" || !file.size || file.size > 600000) return Response.json({ error: "사진 형식이나 용량을 확인해 주세요." }, { status: 400 });
    const { data: record, error: recordError } = await admin.from("generated_texts").select("result_text").eq("user_id", userId).eq("session_id", sessionId).eq("deleted", false).limit(1).maybeSingle();
    if (recordError) throw recordError;
    if (!record) return Response.json({ error: "본인의 종합 기록을 먼저 저장해 주세요." }, { status: 404 });
    const envelope = JSON.parse(record.result_text);
    try { readAIConsent(envelope.consent, true); } catch { return Response.json({ error: "사진 활용 동의가 필요합니다." }, { status: 403 }); }
    if (!envelope.savedKinds?.includes("record")) return Response.json({ error: "종합 기록 저장 후 사진을 보관할 수 있습니다." }, { status: 400 });
    const photoKey = form.get("photoKey");
    // STEAM uses stable file keys so retries and added photos never reuse another photo's slot.
    const steamKey = typeof photoKey === "string" && photoKey.length <= 500 && envelope.steam ? (await import("node:crypto")).createHash("sha256").update(photoKey).digest("hex").slice(0, 32) : null;
    const path = `${userId}/${sessionId}/${steamKey ? `steam-${steamKey}` : `web-${slot}`}.jpg`;
    const { data: existing, error: existingError } = await admin.from("photo_records").select("id,deleted").eq("user_id", userId).eq("file_path", path).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return Response.json({ saved: !existing.deleted, deleted: existing.deleted, id: existing.id }, { headers: privateHeaders });
    const bucket = await admin.storage.getBucket(PHOTO_BUCKET);
    if (bucket.error || !bucket.data || bucket.data.public) throw new Error("Private photo storage unavailable");
    // Validate the bytes independently of the browser-supplied MIME type.
    const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 20000000 }).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    const upload = await admin.storage.from(PHOTO_BUCKET).upload(path, image, { contentType: "image/jpeg", upsert: false });
    if (upload.error) throw upload.error;
    const inserted = await admin.from("photo_records").insert({ user_id: userId, session_id: sessionId, storage_bucket: PHOTO_BUCKET, file_path: path, original_file_name: file.name.slice(0, 200), mime_type: "image/jpeg", size_bytes: image.length, child_alias: envelope.input?.childAlias || "", is_selected: true, deleted: false }).select("id").single();
    if (inserted.error) {
      await admin.storage.from(PHOTO_BUCKET).remove([path]);
      throw inserted.error;
    }
    return Response.json({ saved: true, id: inserted.data.id }, { headers: privateHeaders });
  } catch (error) { return photoError(error); }
}
