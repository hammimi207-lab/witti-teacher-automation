import "server-only";
import { createAdminClient } from "./supabase/admin";
import { PHOTO_BUCKET } from "./record-photos";

export async function ownedSteamPhotos(userId: string, ids: number[]) {
  if (new Set(ids).size !== ids.length) throw new Error("INVALID_PHOTOS");
  if (!ids.length) return [];
  const admin = createAdminClient();
  const { data, error } = await admin.from("photo_records").select("id,storage_bucket,file_path").eq("user_id", userId).eq("deleted", false).in("id", ids);
  if (error) throw new Error("PHOTO_UNAVAILABLE");
  if (!data || data.length !== ids.length || data.some(photo => photo.storage_bucket !== PHOTO_BUCKET || !photo.file_path.startsWith(`${userId}/`))) throw new Error("INVALID_PHOTOS");
  return ids.map(id => data.find(photo => photo.id === id)!);
}

export async function steamPhotoBlobs(userId: string, ids: number[]) {
  if (!ids.length) return [];
  const photos = await ownedSteamPhotos(userId, ids);
  const admin = createAdminClient();
  const bucket = await admin.storage.getBucket(PHOTO_BUCKET);
  if (bucket.error || !bucket.data || bucket.data.public) throw new Error("PHOTO_UNAVAILABLE");
  return Promise.all(photos.map(async photo => {
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).download(photo.file_path);
    if (error || !data || data.size > 10000000) throw new Error("PHOTO_UNAVAILABLE");
    return data;
  }));
}
