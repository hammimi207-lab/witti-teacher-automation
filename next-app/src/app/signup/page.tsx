"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

export default function SignupPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [mailMessage, setMailMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") || "signup";
    if (action === "signup" && fields.get("password") !== fields.get("confirm")) { setMessage("비밀번호 확인이 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(fields), action, privacy: fields.get("privacy") === "on", mailing: fields.get("mailing") === "on" }) });
      const result = await response.json();
      if (action === "send") {
        setMailMessage(result.error || `${String(fields.get("email")).trim()}로 인증번호를 발송했습니다. 받은편지함·스팸함과 기존 기록요정 메일에 묶인 새 메일을 확인해 주세요. 가장 최근 인증번호만 사용할 수 있습니다.`);
        if (response.ok) { setSent(true); setCooldown(60); }
      } else setMessage(result.error || result.message);
      if (response.ok && action === "signup" && result.complete) {
        setComplete(true);
        // 비밀번호는 전달하거나 저장하지 않습니다. 아이디만 같은 탭에서 한 번 사용합니다.
        try { sessionStorage.setItem("witti.signup-identifier", String(fields.get("username")).trim()); } catch { /* 저장 차단 시에도 로그인으로 이동 */ }
        window.location.replace("/login");
      }
    } catch { (action === "send" ? setMailMessage : setMessage)("서버에 연결하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">회원 서비스</span><h1>회원가입</h1><p>회원가입 후 로그인하면 생성한 기록을 저장하고 확인할 수 있습니다.</p></header>
    <form className="panel recovery-form" aria-label="회원가입 양식" onSubmit={submit}>
      <label className="field">성명<input name="name" autoComplete="name" /></label>
      <label className="field">아이디<input name="username" autoComplete="username" pattern="[a-z0-9_]{4,20}" /><small>영문 소문자·숫자·밑줄 4~20자</small></label>
      <label className="field">이메일<input name="email" type="email" autoComplete="email" required disabled={busy || complete} onChange={() => { setSent(false); setMessage(""); setMailMessage(""); setCooldown(0); }} /></label>
      <button className="button secondary" type="submit" value="send" formNoValidate disabled={busy || complete || cooldown > 0}>{busy ? "처리 중…" : cooldown ? `${cooldown}초 후 인증번호 다시 받기` : sent ? "인증번호 다시 받기" : "인증번호 받기"}</button>
      {mailMessage && <p role="status" aria-live="polite">{mailMessage}</p>}
      {sent && <label className="field">이메일 인증번호<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /><small>메일로 받은 6자리 번호를 5분 안에 입력해 주세요.</small></label>}
      <label className="field">비밀번호<input name="password" type="password" autoComplete="new-password" minLength={8} /></label>
      <label className="field">비밀번호 확인<input name="confirm" type="password" autoComplete="new-password" minLength={8} /></label>
      <label className="field">기관명 <small>(선택)</small><input name="institution" autoComplete="organization" /></label>
      <label className="field">직책 <small>(선택)</small><select name="position"><option value="">선택해 주세요</option>{["원장", "원감", "선임교사", "주임교사", "경력교사", "신입교사", "예비(실습)교사", "기타"].map(position => <option key={position}>{position}</option>)}</select></label>
      <div className="signup-consents">
        <label className="signup-consent"><input type="checkbox" name="privacy" /><span>개인정보 수집 및 이용에 동의합니다. (필수)</span></label>
        <label className="signup-consent"><input type="checkbox" name="mailing" /><span>기록요정 소식과 자료 안내 메일 수신에 동의합니다. (선택)</span></label>
      </div>
      <p role="status" aria-live="polite">{message || "이메일 인증 후 회원가입 가능합니다."}</p>
      {sent && !complete && <button className="button primary" type="submit" value="signup" disabled={busy}>{busy ? "처리 중…" : "이메일 인증 후 회원가입 완료"}</button>}
      <Link href="/login">이미 가입하셨나요? 로그인</Link>
    </form>
  </main>;
}
