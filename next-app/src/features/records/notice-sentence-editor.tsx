"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { moveSentence, noticeParts, noticeText, type NoticeSentence } from "./notice-sentence-order";
import styles from "./notice-sentence-editor.module.css";

export function NoticeSentenceEditor({ text, onChange, disabled }: { text: string; onChange: (text: string) => void; disabled: boolean }) {
  const [state, setState] = useState(() => {
    const parts = noticeParts(text);
    return { text, parts, nextId: parts.sentences.length, rows: parts.sentences.map((value, index) => ({ id: `sentence-${index}`, text: value })) };
  });
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const before = useRef(new Map<string, number>());
  const drag = useRef<{ id: string; pointer: number; rows: NoticeSentence[] } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  if (state.text !== text) {
    const parts = noticeParts(text);
    const available = [...state.rows];
    let nextId = state.nextId;
    const rows = parts.sentences.map(value => {
      const index = available.findIndex(row => row.text === value);
      return index < 0 ? { id: `sentence-${nextId++}`, text: value } : available.splice(index, 1)[0];
    });
    setState({ text, parts, rows, nextId });
  }
  useLayoutEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.current.forEach((node, id) => {
        const old = before.current.get(id);
        if (old !== undefined) {
          const delta = old - node.getBoundingClientRect().top;
          if (delta) node.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], { duration: 200, easing: "ease-out" });
        }
      });
    }
    before.current.clear();
  }, [state.rows]);
  function apply(rows: NoticeSentence[]) {
    if (rows === state.rows) return;
    nodes.current.forEach((node, id) => before.current.set(id, node.getBoundingClientRect().top));
    const value = noticeText(rows, state.parts);
    setState({ ...state, text: value, rows }); onChange(value);
  }
  return <div className={styles.editor} aria-label="알림장 문장 순서 편집">
    <p>문장 카드를 잡아 위아래로 옮기세요. 키보드에서는 위·아래 방향키를 사용하세요.</p>
    {state.rows.map((row, index) => <div key={row.id} ref={node => { if (node) nodes.current.set(row.id, node); else nodes.current.delete(row.id); }} className={`${styles.card} ${active === row.id ? styles.active : ""}`}>
      <button type="button" className={styles.handle} disabled={disabled} aria-label={`${index + 1}번 문장 이동: ${row.text}`} aria-pressed={active === row.id}
        onKeyDown={event => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const target = index + (event.key === "ArrowUp" ? -1 : 1);
          const rows = moveSentence(state.rows, row.id, target);
          apply(rows);
          if (rows !== state.rows) setAnnouncement(`${target + 1}번째 위치로 이동했습니다.`);
        }}
        onPointerDown={event => {
          if (disabled || !event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: row.id, pointer: event.pointerId, rows: state.rows }; setActive(row.id);
        }}
        onPointerMove={event => {
          if (!drag.current || drag.current.pointer !== event.pointerId) return;
          const otherRows = state.rows.filter(item => item.id !== row.id);
          let destination = 0;
          for (const other of otherRows) {
            const rect = nodes.current.get(other.id)?.getBoundingClientRect();
            if (rect && event.clientY > rect.top + rect.height / 2) destination++;
          }
          apply(moveSentence(state.rows, row.id, destination));
          if (event.clientY < 70) window.scrollBy(0, -16);
          else if (event.clientY > window.innerHeight - 70) window.scrollBy(0, 16);
        }}
        onPointerUp={() => { if (drag.current) setAnnouncement(`${index + 1}번째 위치로 이동했습니다.`); drag.current = null; setActive(null); }}
        onPointerCancel={() => { if (drag.current) apply(drag.current.rows); drag.current = null; setActive(null); }}
        onLostPointerCapture={() => { drag.current = null; setActive(null); }}
      ><span aria-hidden="true">⠿</span><span className={styles.text}>{row.text}</span></button>
    </div>)}
    <span className={styles.status} role="status">{announcement}</span>
  </div>;
}
