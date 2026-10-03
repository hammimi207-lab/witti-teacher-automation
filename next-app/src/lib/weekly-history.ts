import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { WeeklyResult, WeeklySource, weekRange } from "@/features/records/weekly-story";

export const WEEKLY_HISTORY_TYPE = "주간 놀이 이야기";
export type WeeklySnapshot = { range: ReturnType<typeof weekRange>; sources: WeeklySource[]; excluded: number; result: WeeklyResult };
type Client = Awaited<ReturnType<typeof createClient>>;
export function historyQuery(client: Client, userId: string) {
  return client.from("generated_texts").select("id,result_text,source_text,created_at")
    .eq("user_id", userId).eq("output_type", WEEKLY_HISTORY_TYPE).eq("deleted", false)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("id", { ascending: false });
}
export function retainWeeklyRows<T extends { id: number; source_text: string | null }>(rows: T[]) {
  const weeks = new Set<string>();
  const kept: T[] = [], removed: T[] = [];
  for (const row of rows) {
    if (row.source_text && !weeks.has(row.source_text) && weeks.size < 5) { weeks.add(row.source_text); kept.push(row); }
    else removed.push(row);
  }
  return { kept, removed };
}
export async function saveWeeklyHistory(snapshot: WeeklySnapshot) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required");
  const userId = data.user.id, sessionId = randomUUID();
  const session = await client.from("play_sessions").insert({ session_id: sessionId, user_id: userId,
    play_name: "우리반 주간 놀이 이야기", play_goal: "", age_group: snapshot.sources[0]?.ageGroup || "",
    child_alias: "주간 놀이 이야기", curriculum_areas: [], record_type: "놀이 이야기",
    play_subcategories: [], play_subcategory_notes: {}, teacher_supports: [], teacher_support_notes: {}, deleted: false });
  if (session.error) throw session.error;
  const saved = await client.from("generated_texts").insert({ session_id: sessionId, user_id: userId,
    output_type: WEEKLY_HISTORY_TYPE, result_text: JSON.stringify(snapshot), source_text: snapshot.range.monday,
    edited_text: "", expires_at: "infinity", deleted: false }).select("id");
  if (saved.error) throw saved.error;
  if (!saved.data?.length) throw new Error("Save failed");
  const rows = await historyQuery(client, userId);
  if (rows.error) throw rows.error;
  const { removed } = retainWeeklyRows(rows.data || []);
  if (removed.length) {
    // Only remove immutable snapshots observed above: a concurrent new analysis is never deleted.
    const pruned = await client.from("generated_texts").update({ deleted: true, result_text: "", source_text: "" })
      .eq("user_id", userId).eq("output_type", WEEKLY_HISTORY_TYPE).in("id", removed.map(row => row.id));
    if (pruned.error) throw pruned.error;
  }
  return saved.data[0].id;
}
