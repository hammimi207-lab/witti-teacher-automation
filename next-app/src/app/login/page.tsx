import { LoginForm } from "@/features/auth/login-form";
import { GuestEntry } from "@/features/auth/guest-entry";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string}>}) {
  if(hasSupabaseConfig()) {
    const {data,error}=await (await createClient()).auth.getUser();
    if(!error && data.user) redirect((await searchParams).next === "/records/new" ? "/records/new" : "/records");
  }
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">회원 서비스</span><h1>로그인</h1><p>로그인 하면 생성한 기록을 저장하고 언제나 확인할 수 있습니다.</p></header><LoginForm configured={hasSupabaseConfig()} /><div className="auth-recovery-links"><a href="/account-recovery?mode=id">아이디 찾기</a><span>·</span><a href="/account-recovery">비밀번호 찾기</a></div><GuestEntry /></main>;
}
