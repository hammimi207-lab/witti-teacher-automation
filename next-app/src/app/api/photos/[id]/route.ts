import { photoAccess, photoError, PHOTO_BUCKET, privateHeaders, sameOrigin } from "@/lib/record-photos";

async function ownedPhoto(id: string) {
  const { userId, admin } = await photoAccess();
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return { admin, userId, photo: null };
  const { data: photo, error } = await admin.from("photo_records").select("id,storage_bucket,file_path,mime_type").eq("id", Number(id)).eq("user_id", userId).eq("deleted", false).maybeSingle();
  if (error) throw error;
  if (photo && photo.storage_bucket !== PHOTO_BUCKET) throw new Error("Unexpected photo storage");
  return { admin, userId, photo };
}
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { admin, photo } = await ownedPhoto((await context.params).id);
    if (!photo) return new Response(null, { status: 404, headers: privateHeaders });
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).download(photo.file_path);
    if (error || !data) return new Response(null, { status: 404, headers: privateHeaders });
    return new Response(data, { headers: { ...privateHeaders, "Content-Type": ["image/jpeg", "image/png", "image/webp"].includes(photo.mime_type) ? photo.mime_type : "application/octet-stream", "Content-Disposition": "inline" } });
  } catch (error) { return photoError(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try {
    const { admin, userId, photo } = await ownedPhoto((await context.params).id);
    if (!photo) return Response.json({ deleted: true }, { headers: privateHeaders });
    const removed = await admin.storage.from(PHOTO_BUCKET).remove([photo.file_path]);
    if (removed.error) throw removed.error;
    // A minimal tombstone prevents a save retry from resurrecting a deleted photo.
    const updated = await admin.from("photo_records").update({ deleted: true, original_file_name: "삭제된 사진", child_alias: "", size_bytes: 0, ai_caption: null }).eq("id", photo.id).eq("user_id", userId);
    if (updated.error) throw updated.error;
    return Response.json({ deleted: true }, { headers: privateHeaders });
  } catch (error) { return photoError(error); }
}
