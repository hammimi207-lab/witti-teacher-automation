import { FindIdForm } from "@/features/auth/find-id-form";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RecoveryForm } from "@/features/auth/recovery-form";
export const dynamic = "force-dynamic";
export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ mode?: string; verified?: string; error?: string }> }) {
  const params = await searchParams;
  if (params.mode === "email" || params.mode === "id") {
    return <main className="shell page-shell"><header className="page-title"><h1>아이디 찾기</h1></header><FindIdForm /><p><Link href="/login">로그인으로 돌아가기</Link></p></main>;
  }
  const mode = params.mode === "id" ? "id" : "password";
  const client = await createClient();
  const { data } = await client.auth.getUser();
  const verified = params.verified === "1" && !!data.user;
  let username = ""; let lookupFailed = false;
  if (verified && data.user && mode === "id") {
    const profile = await client.from("subscribers").select("username,platform_member_id").eq("user_id", data.user.id).eq("deleted", false).limit(1);
    lookupFailed = !!profile.error;
    username = profile.data?.[0]?.username || profile.data?.[0]?.platform_member_id || "";
  }
  return <main className="shell page-shell"><header className="page-title"><h1>{mode === "id" ? "아이디 찾기" : "비밀번호 찾기"}</h1><p>가입 이메일 인증 후 계정 정보를 확인할 수 있습니다.</p></header>{params.error && <p className="error" role="alert">인증 링크가 만료되었거나 확인할 수 없습니다. 이 브라우저에서 인증 메일을 다시 요청해 주세요.</p>}{verified && mode === "id" ? <section className="panel"><h2>계정 정보</h2><p>로그인 이메일: {data.user?.email}</p><p>{lookupFailed ? "기존 아이디 조회 권한을 확인해야 합니다." : username ? `기존 가입 아이디: ${username}` : "별도로 등록된 아이디가 없습니다."}</p><p>현재 웹앱에서는 위 이메일로 로그인합니다.</p></section> : <RecoveryForm verified={verified} mode={mode} />}<p><Link href="/login">로그인으로 돌아가기</Link></p></main>;
}
