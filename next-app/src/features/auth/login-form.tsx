"use client";
import { useEffect, useRef, useState } from "react";

export function LoginForm({ configured }:{ configured:boolean }) {
  const [error,setError]=useState(""); const [pending,setPending]=useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    try {
      const email = sessionStorage.getItem("witti.signup-identifier") || sessionStorage.getItem("witti.signup-email");
      sessionStorage.removeItem("witti.signup-identifier");
      sessionStorage.removeItem("witti.signup-email");
      if (!email || !formRef.current) return;
      const emailInput = formRef.current.elements.namedItem("identifier") as HTMLInputElement;
      const passwordInput = formRef.current.elements.namedItem("password") as HTMLInputElement;
      emailInput.value = email;
      passwordInput.value = "";
      passwordInput.focus();
      formRef.current.querySelector<HTMLElement>("[data-signup-notice]")?.removeAttribute("hidden");
    } catch { /* 브라우저 저장소를 사용할 수 없으면 일반 로그인 양식 사용 */ }
  }, []);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form=new FormData(event.currentTarget);
    try {
      const response=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({identifier:form.get("identifier"),password:form.get("password"),remember:form.get("remember")==="on"})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error || "로그인하지 못했습니다.");
      // 새 세션 쿠키로 헤더까지 다시 렌더링하고 이전 로그인 화면 캐시를 남기지 않습니다.
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.replace(next === "/records/new" ? next : "/records");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "연결을 확인하고 다시 로그인해 주세요.");
      setPending(false);
    }
  }
  return <form ref={formRef} className="panel" style={{maxWidth:520,margin:"0 auto"}} onSubmit={submit}><p data-signup-notice hidden role="status">회원가입이 완료되었습니다. 비밀번호를 입력해 로그인해 주세요.</p><div className="form-grid" style={{gridTemplateColumns:"1fr"}}><div className="field"><label htmlFor="identifier">아이디 또는 이메일</label><input id="identifier" name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required /></div><div className="field"><label htmlFor="password">비밀번호</label><input id="password" name="password" type="password" autoComplete="current-password" minLength={6} required /></div></div><label className="signup-consent" style={{marginTop:20}}><input type="checkbox" name="remember" /><span>자동 로그인 · 30일간 로그인 상태 유지</span></label><p style={{fontSize:14,color:"#536d7a",marginTop:8}}>개인 기기에서만 선택해 주세요. 비밀번호는 저장하지 않습니다.</p>{!configured&&<p className="error">Supabase URL과 Publishable Key를 연결하면 기존 회원으로 로그인할 수 있습니다.</p>}{error&&<p className="error">{error}</p>}<div className="submit-row"><button className="button primary" disabled={!configured||pending}>{pending?"확인하는 중":"로그인"}</button></div></form>;
}
