"use client";
import { useRevealedInput } from "./use-revealed-input";
import { useEffect, useId, useState } from "react";
import { seoulToday } from "./notice-workflow";

export function CommonActivity({ userId, writingDate, value, onChange }: { userId: string; writingDate?: string; value: string; onChange: (text: string) => void }) {
  const inputId = useId();
  const revealInput = useRevealedInput();
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const day = writingDate || seoulToday();
  const key = `record-fairy:common:${userId}:${day}`;
  useEffect(() => {
    try {
      const item = JSON.parse(localStorage.getItem(key) || localStorage.getItem(`record-fairy:common:${userId}`) || "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved(""); setDraft("");
      if (item?.day === day && typeof item.text === "string") {
        // Hydrate browser-only, per-account shared activity after mount.
        setSaved(item.text); setDraft(item.text);
      }
    } catch { setStatus("공통 활동을 불러오지 못했어요. 다시 등록해 주세요."); }
  }, [key, day, userId]);
  function save() {
    try {
      const text = draft.trim();
      localStorage.setItem(key, JSON.stringify({ day, text })); setSaved(text);
      if (value) onChange(text);
      setStatus("오늘의 공통 활동을 등록했어요. 같은 기기·브라우저에서 재사용할 수 있어요.");
    } catch { setStatus("저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요."); }
  }
  return <section className="common-activity">
    <h4>오늘 반 공통 활동</h4>
    {saved && <label className="choice"><input type="checkbox" checked={value === saved} onChange={event => onChange(event.target.checked ? saved : "")} /><span>이번 아이에게도 공통 활동 담기<br />{saved}</span></label>}
    {value && value !== saved && <p>이 기록에 담긴 공통 활동: {value} <button type="button" onClick={() => onChange("")}>빼기</button></p>}
    <details open={!saved}><summary onClick={event => { if (!(event.currentTarget.parentElement as HTMLDetailsElement).open) revealInput(inputId); }}>{saved ? "공통 활동 수정" : "반 공통 활동 한 번 등록하기"}</summary>
      <textarea id={inputId} aria-label="오늘 반 공통 활동" value={draft} maxLength={3000} rows={3} onChange={event => setDraft(event.target.value)} placeholder="예: 오늘 반에서 낙엽을 모아 색과 모양을 살펴보았습니다. 아이별 반응은 아래에 따로 적어 주세요." />
      <button type="button" className="button secondary" disabled={!draft.trim()} onClick={save}>공통 활동 등록</button>
    </details>
    {status && <p role="status">{status}</p>}
  </section>;
}
