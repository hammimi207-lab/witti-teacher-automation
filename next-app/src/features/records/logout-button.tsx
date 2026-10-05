"use client";
import { useRef, useState } from "react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function logout() {
    if (lock.current) return;
    if (!window.confirm("로그아웃할까요? 저장하지 않은 입력 내용은 사라질 수 있습니다.")) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      // 이전 로그인 상태의 화면/캐시가 남지 않도록 새 페이지로 이동합니다.
      window.location.replace("/login");
    } catch {
      setError("로그아웃하지 못했습니다. 다시 시도해 주세요.");
      lock.current = false; setBusy(false);
    }
  }
  return <div className="logout-control"><button type="button" className="logout-button" disabled={busy} onClick={logout}>{busy ? "로그아웃 중…" : "로그아웃"}</button>{error && <p role="alert">{error}</p>}</div>;
}
