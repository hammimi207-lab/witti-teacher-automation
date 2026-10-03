import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupContentAssets } from "@/lib/platform-content-server";
import type { ContentRecord } from "@/lib/platform-content";

export const ADMIN_TABLES = ["subscribers", "play_sessions", "photo_records", "generated_texts", "phrase_logs", "platform_notices", "platform_popups"] as const;
export type AdminTable = typeof ADMIN_TABLES[number];
export type AdminRow = Record<string, unknown> & { id: number };
export function validTable(table: string): table is AdminTable { return ADMIN_TABLES.includes(table as AdminTable); }
export function periodStart(period: string) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600000);
  if (period === "today") return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600000).toISOString();
  if (period === "week") return new Date(now.getTime() - 7 * 86400000).toISOString();
  if (period === "month") return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 3600000).toISOString();
  return null;
}
export async function readRows(table: AdminTable, period: string, hidden: boolean, page: number, size = 50) {
  const db = createAdminClient();
  let query = db.from(table).select("*", { count: "exact" }).eq("deleted", hidden).order("id", { ascending: false });
  const start = periodStart(period);
  if (start) query = query.gte("created_at", start);
  const result = await query.range(page * size, (page + 1) * size - 1);
  if (result.error) throw result.error;
  return { rows: (result.data || []) as AdminRow[], count: result.count || 0 };
}
export async function allRows(table: AdminTable, period: string, hidden: boolean) {
  const rows: AdminRow[] = [];
  for (let page = 0; ; page++) {
    const result = await readRows(table, period, hidden, page, 500);
    rows.push(...result.rows);
    if (rows.length >= result.count || !result.rows.length) break;
  }
  return rows;
}
export function csv(rows: Record<string, unknown>[]) {
  const columns = Array.from(new Set(rows.flatMap(Object.keys)));
  const cell = (value: unknown) => {
    let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + [columns.map(cell).join(","), ...rows.map(row => columns.map(key => cell(row[key])).join(","))].join("\r\n");
}
async function removeFile(bucket: unknown, path: unknown, fallback: string) {
  if (typeof path !== "string" || !path) return;
  const name = typeof bucket === "string" && bucket ? bucket : fallback;
  if (!["play-photos", "platform-popup-images", "platform-notice-images", "platform-notice-attachments"].includes(name)) throw new Error("허용되지 않은 저장소입니다.");
  const { error } = await createAdminClient().storage.from(name).remove([path]);
  if (error) throw error;
}
async function removePhotos(column: "user_id" | "session_id", value: string) {
  const db = createAdminClient();
  // 삭제 후 같은 첫 페이지를 조회하여 1,000개 제한에 따른 누락을 방지합니다.
  for (;;) {
    const { data, error } = await db.from("photo_records").select("id,storage_bucket,file_path").eq(column, value).limit(100);
    if (error) throw error;
    if (!data?.length) return;
    for (const photo of data) await removeFile(photo.storage_bucket, photo.file_path, "play-photos");
    const removed = await db.from("photo_records").delete().in("id", data.map(row => row.id));
    if (removed.error) throw removed.error;
  }
}
export async function mutateRecords(table: AdminTable, ids: number[], action: "hide" | "restore" | "delete") {
  const db = createAdminClient();
  if (action !== "delete") {
    const payload: Record<string, boolean> = { deleted: action === "hide" };
    if (table === "subscribers") payload.is_active = action === "restore";
    const { data, error } = await db.from(table).update(payload).in("id", ids).select("id");
    if (error) throw error;
    return data?.length || 0;
  }
  const { data, error } = await db.from(table).select("*").in("id", ids);
  if (error) throw error;
  let count = 0;
  for (const row of data || []) {
    if (table === "subscribers" && row.user_id) {
      await removePhotos("user_id", row.user_id);
      const result = await db.auth.admin.deleteUser(row.user_id);
      if (result.error && result.error.status !== 404) throw result.error;
    }
    if (table === "play_sessions" && row.session_id) await removePhotos("session_id", row.session_id);
    if (table === "photo_records") await removeFile(row.storage_bucket, row.file_path, "play-photos");
    if (table === "platform_popups") await removeFile(row.image_bucket, row.image_path, "platform-popup-images");
    if (table === "platform_notices") await cleanupContentAssets(row as ContentRecord);
    const result = await db.from(table).delete().eq("id", row.id);
    if (result.error) throw result.error;
    count++;
  }
  return count;
}
