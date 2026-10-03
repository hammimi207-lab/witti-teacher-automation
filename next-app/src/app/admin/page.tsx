import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-session";
import { AdminConsole } from "@/features/admin/admin-console";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  if (!await isAdmin()) redirect("/admin/login");
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">관리자 전용</span><h1>운영 관리</h1><p>회원·기록 데이터, 공지사항과 방문 팝업을 관리합니다.</p></header><p><a className="button secondary" href="/admin/consents">비밀유지 동의 기록</a></p><AdminConsole /></main>;
}
