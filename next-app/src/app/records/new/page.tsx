import { RecordWizard } from "@/features/records/record-wizard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function NewRecordPage({ searchParams }: { searchParams: Promise<{ guest?: string; observation?: string }> }) {
  const {data,error} = await (await createClient()).auth.getUser();
  const params = await searchParams;
  const guest = params.guest === "1";
  if((error || !data.user) && !guest) redirect("/login?next=/records/new");
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">기록 요정</span><h1>새 기록 만들기</h1><p>교사가 확인한 실제 장면을 중심으로 작성합니다. AI 결과는 반드시 검토해 주세요.</p></header><RecordWizard key={guest ? "guest" : data.user!.id} userId={guest ? "" : data.user!.id} observationToken={params.observation} /></main>;
}
