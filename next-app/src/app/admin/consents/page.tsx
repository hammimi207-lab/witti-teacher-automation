import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONSENT_BUCKET, readConsent } from "@/lib/confidentiality";
export const dynamic = "force-dynamic";
export default async function ConsentsPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  if(!await isAdmin()) redirect("/admin/login");
  const params=await searchParams; const page=Math.max(0,Math.min(100000,Number(params.page)||0));
  const {data,error}=await createAdminClient().storage.from(CONSENT_BUCKET).list("",{limit:50,offset:Math.floor(page)*50,sortBy:{column:"created_at",order:"desc"}});
  const rows=error?[]:await Promise.all((data||[]).filter(item=>/^[0-9a-f-]{36}\.json$/.test(item.name)).map(item=>readConsent(item.name.slice(0,-5))));
  return <main className="shell page-shell"><Link href="/admin">관리 화면으로 돌아가기</Link><h1>비밀유지 동의 기록</h1><p>회원가입 전 기록도 포함됩니다. 이름·휴대폰 번호·이메일은 본인 인증되지 않은 자기기입 정보입니다. 동의일로부터 1년간 보관합니다.</p>{error&&<p role="alert">기록을 불러오지 못했습니다.</p>}{rows.map(row=>row&&<article className="panel" key={row.id}><h2>{row.name} · {row.phone || "휴대폰 번호 미등록"}</h2><p>{row.email}</p>{row.institution && <p>기존 소속 정보: {row.institution}</p>}<p>동의: {new Date(row.acceptedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} (한국시간)</p><p>보관 만료: {row.expiresAt} · 버전: {row.version}</p><p>동의 번호: {row.id}</p><details><summary>동의 당시 전문과 증빙</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(row,null,2)}</pre></details></article>)}<p><Link href={`?page=${Math.max(0,page-1)}`}>이전</Link> · {page+1}페이지 · {(data?.length||0)===50&&<Link href={`?page=${page+1}`}>다음</Link>}</p></main>;
}
