"use client";
import { useState } from "react";
export function RecoveryForm({ verified, mode }: { verified: boolean; mode: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    if (verified && form.get("password") !== form.get("confirm")) { setMessage("새 비밀번호가 일치하지 않습니다."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(verified ? { action: "update", password: form.get("password") } : { action: "send", email: form.get("email"), mode }) });
      const payload = await response.json();
      setMessage(payload.message || payload.error || "요청을 처리하지 못했습니다.");
      if (response.ok && verified) window.location.replace("/login");
    } catch { setMessage("연결을 확인하고 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <form className="panel recovery-form" onSubmit={submit}>{verified ? <><label className="field">새 비밀번호<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label><label className="field">새 비밀번호 확인<input name="confirm" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label></> : <><label className="field">가입 이메일<input type="email" name="email" autoComplete="email" required /></label><p>기록요정 전용 인증 메일 연결을 준비 중입니다. 현재 메일 발송은 중단되어 있습니다.</p></>}<button className="button primary" disabled={busy}>{busy ? "처리 중…" : verified ? "새 비밀번호 저장" : "인증 메일 받기"}</button><p role="status">{message}</p></form>;
}
