"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { weekRange } from "./weekly-story";

const iso = (date: Date) => date.toISOString().slice(0, 10);
function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return iso(date).slice(0, 7);
}
export function WeekPicker({ value, disabled, onChange, label = "살펴볼 주 선택" }: { value: string; disabled?: boolean; onChange: (monday: string) => void; label?: string }) {
  const selected = weekRange(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const [preview, setPreview] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    (popup.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? popup.current?.querySelector<HTMLButtonElement>('.week-picker-row'))?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const first = new Date(`${month}-01T00:00:00Z`);
  const last = new Date(first); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  const cursor = new Date(`${weekRange(iso(first)).monday}T00:00:00Z`);
  const weeks: string[][] = [];
  while (cursor <= last) {
    const days = Array.from({ length: 6 }, (_, i) => iso(new Date(cursor.getTime() + i * 86400000)));
    if (days[5] >= iso(first)) weeks.push(days);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  const shown = weekRange(preview || selected.monday);
  return <div className="week-picker" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }}>
    <span className="week-picker-label" id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" className="week-picker-trigger" disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => { if (!open) { setMonth(value.slice(0, 7)); setPreview(null); } setOpen(!open); }}>
      <CalendarDays size={18} aria-hidden="true" /><span id={`${id}-value`}>{selected.monday} ~ {selected.saturday}</span><small>월~토</small>
    </button>
    {open && <div className="week-picker-popup" ref={popup} id={`${id}-calendar`} role="group" aria-label="월요일부터 토요일까지 주간 선택">
      <div className="week-picker-month"><button type="button" aria-label="이전 달" onClick={() => { setMonth(shiftMonth(month, -1)); setPreview(null); }}><ChevronLeft size={18} /></button><strong aria-live="polite">{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</strong><button type="button" aria-label="다음 달" onClick={() => { setMonth(shiftMonth(month, 1)); setPreview(null); }}><ChevronRight size={18} /></button></div>
      <p className="week-picker-help">한 줄이 한 주예요. 월~토를 함께 선택해요.</p>
      <div className="week-picker-days" aria-hidden="true">{["월", "화", "수", "목", "금", "토"].map(day => <span key={day}>{day}</span>)}</div>
      <div className="week-picker-weeks" onMouseLeave={() => setPreview(null)}>{weeks.map(days => <button key={days[0]} type="button" className="week-picker-row" aria-label={`${days[0]} 월요일부터 ${days[5]} 토요일까지 선택`} aria-pressed={selected.monday === days[0]} onMouseEnter={() => setPreview(days[0])} onFocus={() => setPreview(days[0])} onClick={() => { onChange(days[0]); setOpen(false); trigger.current?.focus(); }}>
        {days.map(day => <span key={day} aria-hidden="true" className={day.slice(0, 7) === month ? "" : "outside-month"}>{Number(day.slice(8))}</span>)}
      </button>)}</div>
      <div className="week-picker-preview">{shown.monday} ~ {shown.saturday}<span>월요일부터 토요일까지 · 일요일 제외</span></div>
    </div>}
  </div>;
}
