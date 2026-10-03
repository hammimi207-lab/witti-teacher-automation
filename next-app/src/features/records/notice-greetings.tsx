"use client";
import { useEffect, useState } from "react";
import { greetingOptions, seoulToday } from "./notice-workflow";
import type { RecordInput } from "./schema";
type GreetingField = "openingGreeting" | "closingGreeting" | "openingKind" | "closingKind";
export function NoticeGreetings({ input, onChange, onApply, disabled = false }: { input: RecordInput | (Pick<RecordInput, GreetingField> & { writingDate?: string }); onChange: (field: GreetingField, value: string) => void; onApply?: () => void; disabled?: boolean }) {
  const date = input.writingDate || seoulToday();
  const [calendar, setCalendar] = useState<{ date: string; options: ReturnType<typeof greetingOptions>; available: boolean } | null>(null);
  const options = calendar?.date === date ? calendar.options : greetingOptions(date);
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    fetch(`/api/records/greetings?date=${date}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (!controller.signal.aborted && payload.date === date) setCalendar({ date, options: { opening: payload.opening, closing: payload.closing }, available: payload.holidayAvailable });
    }).catch(() => { if (!controller.signal.aborted) setCalendar({ date, options: greetingOptions(date), available: false }); });
    return () => controller.abort();
  }, [date]);
  return <section className="notice-greetings" aria-label="서두 및 마무리 인사 선택">
    <div className="notice-greetings-heading"><div><span className="section-kicker">마지막 한마디</span><h3>인사로 마음을 전해요</h3></div><span className="notice-greetings-date">{date}</span></div>
    <p>완성된 글에 어울리는 인사를 골라 다듬어 주세요. 사용하지 않아도 괜찮아요.</p>
    <div className="notice-greetings-cards">
    {(["opening", "closing"] as const).map(side => {
      const kind = side === "opening" ? "openingKind" : "closingKind";
      const field = side === "opening" ? "openingGreeting" : "closingGreeting";
      return <fieldset key={side} disabled={disabled}><legend>{side === "opening" ? "서두 인사" : "마무리 인사"}</legend>
        <div className="choice-grid">{options[side].map(option => <button type="button" className="button secondary" aria-pressed={input[kind] === option.id} key={option.id} onClick={() => {
          if (kind === "openingKind") onChange(kind, option.id as RecordInput["openingKind"]); else onChange(kind, option.id as RecordInput["closingKind"]);
          onChange(field, option.candidates[Number(date.slice(-2)) % option.candidates.length]);
        }}>{option.label}{option.recommended && " · 추천"}{input[kind] === option.id && " ✓"}</button>)}</div>
        {input[kind] !== "none" && <>
          <div className="choice-grid">{options[side].find(option => option.id === input[kind])?.candidates.filter(Boolean).map(candidate => <button type="button" className="button secondary" key={candidate} onClick={() => onChange(field, candidate)}>{candidate}</button>)}</div>
          <label htmlFor={field}>나의 인사말<textarea id={field} rows={2} maxLength={500} value={input[field]} placeholder="아이의 오늘 이야기에 어울리는 짧은 인사를 적어 주세요." onChange={event => onChange(field, event.target.value)} /></label>
        </>}
      </fieldset>;
    })}
    </div>
    {onApply && <button type="button" className="button primary" disabled={disabled} onClick={onApply}>인사말을 알림장에 적용</button>}
    <details className="notice-greetings-help"><summary>날씨·공휴일 추천 안내</summary><p>기관 지역과 해당 날짜의 날씨 연동이 없어 날씨를 추측하지 않아요. 날씨 인사를 선택하면 일반 인사가 나타나며, 확인한 날씨는 직접 적을 수 있어요.</p>
    {(!calendar || calendar.date !== date || !calendar.available) && <p role="status">공휴일 정보를 확인하지 못했어요. 일반·주말 인사와 직접 작성을 사용할 수 있어요.</p>}
    <small>공휴일 추천은 기관의 휴원 안내가 아니에요.</small></details>
  </section>;
}
