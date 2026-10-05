import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WeeklyStoryPanel } from "@/features/records/weekly-story-panel";

export const dynamic = "force-dynamic";
export default async function WeeklyStoryPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">주간 놀이 돌아보기</span><h1>우리반 주간 놀이 이야기</h1><p>매일의 관찰을 이어 보며 아이들의 흥미와 다음 놀이의 방향을 살펴보세요.</p></header><WeeklyStoryPanel today={today} /></main>;
}
