import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-session";
import { AdminLogin } from "@/features/admin/admin-login";
export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">관리자 전용</span><h1>관리자 로그인</h1><p>기존 관리자 아이디와 비밀번호를 입력해 주세요. 회원 로그인과 별도로 관리됩니다.</p></header><AdminLogin /></main>;
}
