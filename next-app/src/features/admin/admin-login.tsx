"use client";
import { useState } from "react";
export function AdminLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="panel recovery-form" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.replace("/admin");
    } catch (e) { setError(e instanceof Error ? e.message : "연결을 확인해 주세요."); setBusy(false); }
  }}><label className="field">관리자 아이디<input name="id" autoComplete="username" required /></label><label className="field">관리자 비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? "확인 중…" : "관리자 로그인"}</button></form>;
}
