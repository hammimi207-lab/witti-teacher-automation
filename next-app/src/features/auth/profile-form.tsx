"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export type AccountProfile = { name: string; institution: string; position: string; mailing: boolean; username: string; email: string };
export function ProfileForm({ profile }: { profile: AccountProfile }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const router = useRouter();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const form = new FormData(event.currentTarget);
    lock.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), institution: form.get("institution"), position: form.get("position"), mailing: form.get("mailing") === "on" }) });
      const result = await response.json();
      setMessage(response.ok ? "가입 정보를 저장했습니다." : result.error || "저장하지 못했습니다.");
      if (response.ok) router.refresh();
    } catch { setMessage("연결을 확인한 뒤 다시 저장해 주세요. 입력한 내용은 유지됩니다."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form className="panel recovery-form account-profile-form" onSubmit={save} aria-label="가입 정보 수정">
    <h2>내 가입 정보</h2>
    <fieldset disabled={busy} className="account-profile-fields">
      <label className="field">성명<input name="name" autoComplete="name" defaultValue={profile.name} required maxLength={100} /></label>
      <label className="field">아이디<input value={profile.username} readOnly /><small>로그인 아이디는 변경할 수 없습니다.</small></label>
      <label className="field">이메일<input value={profile.email} readOnly /><small>가입 시 인증한 이메일입니다.</small></label>
      <label className="field">기관명 <small>(선택)</small><input name="institution" autoComplete="organization" defaultValue={profile.institution} maxLength={200} /></label>
      <label className="field">직책 <small>(선택)</small><select name="position" defaultValue={profile.position}><option value="">선택해 주세요</option>{[...new Set(["원장", "원감", "선임교사", "주임교사", "경력교사", "신입교사", "예비(실습)교사", "기타", profile.position].filter(Boolean))].map(position => <option key={position}>{position}</option>)}</select></label>
      <label className="signup-consent"><input name="mailing" type="checkbox" defaultChecked={profile.mailing} /><span>기록요정 소식과 자료 안내 메일 수신 (선택)</span></label>
      <button className="button primary" type="submit">{busy ? "저장 중…" : "변경 내용 저장"}</button>
    </fieldset>
    <p role="status">{message}</p><Link className="library-view-all" href="/account-recovery?mode=password">비밀번호 변경</Link>
  </form>;
}
