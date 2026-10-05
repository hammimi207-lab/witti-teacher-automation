"use client";
import { useState, useEffect, type FormEvent } from "react";
import { ArrowRight, LogIn } from "lucide-react";
import { CONSENT_VERSION, NDA_TEXT, PRIVACY_TEXT } from "@/lib/confidentiality-terms";
const ndaLabels = ["시험 이용 목적", "정보를 사용하는 범위", "외부 공유 금지", "비밀유지에서 제외되는 정보", "비밀유지 기간", "기록의 권리"];
const privacyLabels = ["수집 목적", "저장하는 정보", "보관과 파기", "동의를 거부할 권리", "회원가입 전 기록"];
export default function ConfidentialityPage() {
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const [accountEmail,setAccountEmail]=useState("");
  useEffect(()=>{fetch("/api/auth/status",{cache:"no-store"}).then(r=>r.json()).then(data=>{if(data.signedIn&&data.email)setAccountEmail(data.email);}).catch(()=>{});},[]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form=new FormData(event.currentTarget);
    try {
      const result=await fetch("/api/consent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:form.get("name"),email:form.get("email"),phone:form.get("phone"),version:CONSENT_VERSION,ndaAccepted:form.get("nda")==="on",privacyAccepted:form.get("privacy")==="on"})});
      const data=await result.json(); if(!result.ok) throw new Error(data.error);
      // Reload the document so the newly issued consent cookie updates the server layout.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(new URLSearchParams(window.location.search).get("next") === "guest" ? "/records/new?guest=1" : "/");
    } catch(e) { setError(e instanceof Error?e.message:"저장에 실패했습니다."); setBusy(false); }
  }
  return <main className="shell consent-page">
    <header className="consent-intro"><span className="consent-kicker">기록 요정 · 교사 체험</span><h1>선생님, 반가워요</h1><p>함께 써 보는 기록 요정, 시작 전에 두 가지만 약속해 주세요.</p></header>
    <section className="consent-first-checks" aria-labelledby="consent-first-title">
      <h2 id="consent-first-title">사용 전 두 가지 확인 <span>모두 필수</span></h2>
      <div className="consent-first-item">
        <label className="consent-check"><input type="checkbox" name="nda" form="trial-consent-form" required /><span>비밀유지 약정에 동의합니다.<small>체험 중 알게 된 비공개 화면·자료는 외부에 공유하지 않아요.</small></span></label>
        <a href="#nda-title">비밀유지 약정 자세히 보기</a>
      </div>
      <div className="consent-first-item">
        <label className="consent-check"><input type="checkbox" name="privacy" form="trial-consent-form" required /><span>개인정보 수집·이용에 동의합니다.<small>동의 확인을 위해 이름·휴대폰·이메일과 동의 기록을 1년간 보관해요.</small></span></label>
        <a href="#privacy-title">수집 항목·이용 목적 자세히 보기</a>
      </div>
      <p>두 항목을 확인한 뒤 아래 이용자 정보를 입력해 주세요.</p>
    </section>
    {accountEmail ? <p className="panel" role="status">로그인은 완료되었습니다. 현재 계정({accountEmail})에 연결된 최신 동의를 확인하지 못했습니다. 아래에서 확인하면 이후에는 자동으로 연결됩니다.</p> : <section className="consent-login-card" aria-labelledby="consent-login-title">
      <div className="consent-login-icon"><LogIn size={28} aria-hidden="true" /></div>
      <div className="consent-login-copy"><span>기존 회원 안내</span><h2 id="consent-login-title">이미 동의하셨나요?</h2><p>로그인해서 기존 동의 내역을 확인해 주세요.</p></div>
      <a className="consent-login-button" href="/login">로그인하기<ArrowRight size={20} aria-hidden="true" /></a>
    </section>}
    <form id="trial-consent-form" className="consent-form" onSubmit={submit}>
      <section className="consent-card" aria-labelledby="participant-title"><header className="consent-section-title"><span>01</span><h2 id="participant-title">이용자 정보</h2></header><p className="consent-helper">이용자 구분을 위해 본인의 이름, 개인 휴대폰 번호, 이메일을 입력해 주세요. 어린이집 정보는 입력하지 않아도 됩니다.</p><div className="consent-fields"><label>이름<input name="name" required maxLength={100} autoComplete="name" placeholder="성함을 입력해 주세요" /></label><label>개인 휴대폰 번호<input name="phone" type="tel" required maxLength={20} autoComplete="tel" inputMode="tel" placeholder="010-1234-5678" /></label><label className="consent-email">이메일<input key={accountEmail} defaultValue={accountEmail} readOnly={!!accountEmail} name="email" type="email" required maxLength={254} autoComplete="email" placeholder="example@email.com" /></label></div><p className="consent-note">휴대폰 번호는 이용자 구분용으로 저장합니다. 문자 인증 등 별도의 본인 인증은 진행하지 않습니다.</p></section>
      <section className="consent-card" aria-labelledby="nda-title"><header className="consent-section-title"><h2 id="nda-title">체험 내용은 우리끼리</h2><b className="consent-required">필수</b></header><p className="consent-short">체험 중 제공되는 비공개 화면·자료·접근 권한은 외부에 공유하지 말아 주세요. 사용 후 의견은 운영자에게 편하게 전해 주세요.</p><details className="consent-details"><summary>비밀유지 약정 전체 보기</summary><div className="consent-clauses">{NDA_TEXT.split("\n").slice(2).map((text,i)=><div key={text}><h3>{ndaLabels[i]}</h3><p>{text}</p></div>)}</div></details></section>
      <section className="consent-card" aria-labelledby="privacy-title"><header className="consent-section-title"><h2 id="privacy-title">동의 기록을 보관해요</h2><b className="consent-required">필수</b></header><dl className="consent-brief"><div><dt>목적</dt><dd>체험 동의 확인·이용 권한 관리·관련 문의 처리</dd></div><div><dt>항목</dt><dd>이름, 개인 휴대폰 번호, 이메일, 동의 번호·시각·여부, 동의서 버전·전문</dd></div><div><dt>기간</dt><dd><strong>동의일로부터 1년</strong> · 만료 후 정기 삭제</dd></div></dl><p className="consent-note">회원가입 전에도 저장됩니다. 동의를 거부할 수 있지만, 체험 이용은 어렵습니다.</p><details className="consent-details"><summary>개인정보 수집·이용 안내 전체 보기</summary><dl className="consent-privacy">{PRIVACY_TEXT.split("\n").slice(2).map((text,i)=><div key={text}><dt>{privacyLabels[i]}</dt><dd>{text}</dd></div>)}</dl></details></section>
      <div className="consent-submit">{error&&<p role="alert" className="consent-error">{error}</p>}<button className="button primary" disabled={busy}>{busy?"동의 기록 저장 중…":"동의하고 기록 요정 이용하기"}</button><p>동의하지 않으시면 이 화면을 닫아 주세요.</p></div>
    </form>
    <footer className="consent-contact"><p><strong>운영자 함미미</strong><a href="mailto:hammimi207@gmail.com">hammimi207@gmail.com</a></p><small>동의서 버전 {CONSENT_VERSION}</small></footer>
  </main>;
}
