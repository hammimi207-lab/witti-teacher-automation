import { createClient } from "./supabase/server";
import { weekRange, weeklySources, type WeeklyRow } from "@/features/records/weekly-story";

export async function loadSupportSources(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, day: string, ids: string[]) {
  const range = weekRange(day);
  const response = await supabase.from("generated_texts").select("id,session_id,created_at,result_text")
    .eq("user_id", userId).eq("deleted", false).eq("output_type", "놀이 이야기")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .gte("created_at", range.start).lt("created_at", range.end).in("id", ids).order("created_at", { ascending: true });
  if (response.error) throw new Error("기록 조회 실패");
  const sources = weeklySources((response.data || []) as WeeklyRow[]);
  if (sources.length !== new Set(ids).size) throw new Error("원본 기록이 변경되었어요. 주간 기록을 다시 불러와 주세요.");
  return sources;
}
