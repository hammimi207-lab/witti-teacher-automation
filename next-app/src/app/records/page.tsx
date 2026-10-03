import Link from "next/link";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { unpackRecord, type SavedRecord } from "@/features/records/saved-record-library";
import { RecordList } from "@/features/records/record-list";

export const dynamic = "force-dynamic";

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "language" ? "language" : "record";
  let records: SavedRecord[] = []; let loggedIn = false; let failed = false;
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    loggedIn = Boolean(data.user);
    if (data.user) {
      const response = await supabase.from("generated_texts").select("id,session_id,output_type,result_text,edited_text,created_at").eq("user_id", data.user.id).eq("deleted", false).or("output_type.is.null,and(output_type.neq.주간 지원 계획,output_type.neq.주간 놀이 이야기)").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("created_at", { ascending: false }).limit(100);
      failed = Boolean(response.error); records = (response.data ?? []) as SavedRecord[];
    }
  }
  const visible = records.filter((record) => unpackRecord(record).kinds.includes(tab));
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">내 기록</span><h1>내가 만든 기록</h1><p>직접 저장한 최근 100개 기록에서 종합 기록과 관찰 언어를 나누어 살펴보세요.</p><Link className="library-view-all" href="/records/photos">내 사진 관리</Link></header><nav className="record-library-tabs" aria-label="내 기록 분류"><Link href="/records" aria-current={tab === "record" ? "page" : undefined}>종합 기록</Link><Link href="/records?tab=language" aria-current={tab === "language" ? "page" : undefined}>정확한 관찰 언어</Link></nav>
    {failed ? <p role="alert" className="error">기록을 불러오지 못했습니다. 연결과 조회 권한을 확인해 주세요.</p> : visible.length ? <RecordList key={tab} records={visible} language={tab === "language"} /> : <section className="panel empty-state"><h2>{loggedIn ? (tab === "language" ? "아직 저장한 관찰 언어가 없어요" : "아직 저장한 종합 기록이 없어요") : "로그인하면 저장한 기록을 확인할 수 있어요"}</h2><p>{loggedIn ? "생성 결과를 검토한 뒤 원하는 내용을 저장해 주세요." : "로그인 후 내 기록을 확인해 주세요."}</p><Link className="button primary" href={loggedIn ? "/records/new" : "/login"}>{loggedIn ? "새 기록 만들기" : "로그인하기"}</Link></section>}
  </main>;
}
