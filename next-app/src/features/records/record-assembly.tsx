"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import type { GeneratedRecord } from "./schema";
import type { WeeklyResult, WeeklySource } from "./weekly-story";
import styles from "./record-assembly.module.css";

type Props = {
  mode: "daily" | "weekly";
  observation?: string;
  files?: File[];
  sources?: WeeklySource[];
  result?: GeneratedRecord | null;
  weeklyResult?: WeeklyResult;
  onComplete: () => void;
};

function LocalPhoto({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // These photos remain browser-local, like the existing upload preview.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt="교사가 첨부한 관찰 사진" />;
}

export function RecordAssembly({ mode, observation = "", files = [], sources = [], result, weeklyResult, onComplete }: Props) {
  const root = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState("gather");
  const [longWait, setLongWait] = useState(false);
  const ready = mode === "daily" ? Boolean(result) : Boolean(weeklyResult);
  useEffect(() => {
    root.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    const timer = window.setTimeout(() => setLongWait(true), 15000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = window.setTimeout(onComplete, 100);
      return () => window.clearTimeout(timer);
    }
    const timers = [
      window.setTimeout(() => setPhase("meaning"), 0),
      window.setTimeout(() => setPhase("assemble"), 1100),
      window.setTimeout(() => setPhase("unfold"), 2000),
      window.setTimeout(onComplete, 2700),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [ready, onComplete]);

  const weekly = mode === "weekly";
  const cards = weekly
    ? sources.slice(0, 6).map(source => ({ id: source.id, label: `${source.date} · ${source.childAlias}`, text: source.observation, file: undefined as File | undefined }))
    : [
      ...observation.split(/\n+|(?<=[.!?。])\s+/u).map(text => text.trim()).filter(Boolean).slice(0, 4).map((text, i) => ({ id: `text-${i}`, label: "교사가 남긴 관찰", text, file: undefined as File | undefined })),
      ...files.slice(0, 2).map((file, i) => ({ id: `photo-${i}`, label: "함께 남긴 순간", text: "", file })),
    ];
  const groups = weeklyResult?.plays ?? [];
  const tags = weekly ? groups.map(group => group.title) : (result?.curriculumLinks ?? []).map(link => link.area);
  const positions = cards.map((_, i) => ({
    x: cards.length === 1 ? 50 : weekly ? [24, 75, 23, 77, 28, 73][i] : 27 + (i % 2) * 46,
    y: cards.length <= 2 ? 50 : cards.length <= 4 ? 32 + Math.floor(i / 2) * 36 : weekly ? [15, 20, 47, 52, 79, 84][i] : 18 + Math.floor(i / 2) * 32,
  }));
  const lines = groups.flatMap(group => {
    const indices = cards.map((card, i) => group.sourceIds.includes(card.id) ? i : -1).filter(i => i >= 0);
    return indices.slice(1).map((index, i) => [indices[i], index]);
  }).filter(([a, b], i, all) => all.findIndex(([c, d]) => c === a && d === b) === i);
  const message = phase === "unfold" ? "모인 순간들이 기록으로 펼쳐져요."
    : phase === "assemble" ? weekly ? "이어진 관찰 속에서 놀이의 흐름을 정리하고 있어요." : "관찰한 순간들을 하나의 이야기로 엮고 있어요."
    : phase === "meaning" ? weekly ? "관련된 관찰 사이에 놀이의 흐름이 드러나요." : "관찰 속 의미를 기록에 담고 있어요."
    : weekly ? "한 주 동안 쌓인 놀이의 순간들을 살펴보고 있어요." : "오늘 남긴 순간들을 모으고 있어요.";

  return <section ref={root} className={`${styles.assembly} ${weekly ? styles.weekly : styles.daily}`} data-phase={phase} aria-label={weekly ? "주간 관찰 지도 만들기" : "아이별 기록 모으기"} aria-busy="true">
    <div className={styles.heading}><span><Sparkles size={15} />{weekly ? "한 주의 관찰 지도" : "오늘의 순간, 하나의 이야기"}</span><h2 role="status" aria-live="polite">{message}</h2></div>
    <div className={styles.stage} aria-hidden="true">
      {weekly && <svg className={styles.connections} viewBox="0 0 100 100" preserveAspectRatio="none">{lines.map(([a, b]) => <line key={`${a}-${b}`} x1={positions[a].x} y1={positions[a].y} x2={positions[b].x} y2={positions[b].y} pathLength="1" />)}</svg>}
      <div className={styles.paper}><BookOpen size={30} /><span>{weekly ? "한 주의 놀이 이야기" : "오늘의 관찰 기록"}</span><i /><i /><i /></div>
      {cards.map((card, i) => {
        const group = groups.findIndex(group => group.sourceIds.includes(card.id));
        const excerpt = card.text.length > 90 ? `${card.text.slice(0, 90)}…` : card.text;
        const evidence = !weekly ? result?.observationRefinementRows?.find(row => row.teacherInput.trim().length > 1 && excerpt.includes(row.teacherInput.trim()))?.teacherInput.trim() : undefined;
        const splitAt = evidence ? excerpt.indexOf(evidence) : -1;
        return <article key={card.id} className={`${styles.card} ${card.file ? styles.photo : ""}`} data-linked={group >= 0} style={{ "--x": `${positions[i].x}%`, "--y": `${positions[i].y}%`, "--tilt": `${i % 2 ? 3 : -3}deg`, "--delay": `${i * 100}ms`, "--index": i, "--group": Math.max(0, group) } as CSSProperties}>
          {card.file && <LocalPhoto file={card.file} />}<small>{card.label}</small>
          {card.text && <p>{evidence && splitAt >= 0 ? <>{excerpt.slice(0, splitAt)}<mark>{evidence}</mark>{excerpt.slice(splitAt + evidence.length)}</> : excerpt}</p>}
        </article>;
      })}
    </div>
    <div className={styles.tags}>{ready && tags.slice(0, 3).map((tag, i) => <span key={`${tag}-${i}`}>{tag}</span>)}</div>
    <p className={styles.note}>{!ready && longWait ? "관찰을 꼼꼼히 읽고 있어요. 자료의 양에 따라 조금 더 걸릴 수 있어요." : weekly ? `실제 저장된 관찰 ${sources.length}건${sources.length > 6 ? " 중 일부를 보여드려요" : "을 함께 살펴봐요"} · 날짜는 저장일 기준` : "선생님이 남긴 관찰과 사진을 바탕으로 기록해요."}</p>
  </section>;
}
