"use client";

import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { moveSentence, noticeParts, noticeText, type NoticeSentence } from "./notice-sentence-order";
import styles from "./notice-sentence-editor.module.css";

export type NoticeEditorHandle = { insert: (value: string) => void };
export function NoticeSentenceEditor({ text, onChange, disabled, editorRef }: { text: string; onChange: (text: string) => void; disabled: boolean; editorRef?: Ref<NoticeEditorHandle> }) {
  const [state, setState] = useState(() => {
    const parts = noticeParts(text);
    return { text, parts, nextId: parts.sentences.length, rows: parts.sentences.map((value, index) => ({ id: `sentence-${index}`, text: value })) };
  });
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  const cursor = useRef<string | null>(null);
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
    inputs.current.forEach(node => { node.style.height = "0px"; node.style.height = `${node.scrollHeight}px`; });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.current.forEach((node, id) => {
        node.getAnimations().forEach(animation => animation.cancel());
        const old = before.current.get(id);
        if (old !== undefined) {
          const delta = old - node.getBoundingClientRect().top;
          if (delta) node.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], { duration: 200, easing: "ease-out" });
        }
      });
    }
    before.current.clear();
  }, [state.rows]);
  function apply(rows: NoticeSentence[], animate = true) {
    if (rows === state.rows) return;
    if (animate) nodes.current.forEach((node, id) => before.current.set(id, node.getBoundingClientRect().top));
    const value = noticeText(rows, state.parts);
    setState({ ...state, text: value, rows }); onChange(value);
  }
  useImperativeHandle(editorRef, () => ({ insert(value) {
    if (disabled) return;
    const row = state.rows.find(item => item.id === cursor.current) ?? state.rows.at(-1);
    if (!row) { onChange(value); return; }
    const node = inputs.current.get(row.id);
    const start = node?.selectionStart ?? row.text.length;
    const end = node?.selectionEnd ?? start;
    apply(state.rows.map(item => item.id === row.id ? { ...item, text: item.text.slice(0, start) + value + item.text.slice(end) } : item), false);
    requestAnimationFrame(() => { node?.focus({ preventScroll: true }); node?.setSelectionRange(start + value.length, start + value.length); });
  } }));
  return <div className={styles.editor} id="finalNoticeEditor" role="group" aria-labelledby="notice-editor-label">
    <strong id="notice-editor-label">여기서 바로 수정하세요</strong>
    <p>문장을 눌러 수정하고, 왼쪽 ⠿ 손잡이를 잡아 순서를 옮기세요. 손잡이에서는 위·아래 방향키도 사용할 수 있어요.</p>
    <div className={styles.paper}>
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
      ><span aria-hidden="true">⠿</span></button>
      <textarea className={styles.text} rows={1} disabled={disabled} aria-label={`${index + 1}번 문장 수정`} value={row.text}
        ref={node => { if (node) inputs.current.set(row.id, node); else inputs.current.delete(row.id); }}
        onFocus={() => { cursor.current = row.id; }}
        onChange={event => apply(state.rows.map(item => item.id === row.id ? { ...item, text: event.target.value } : item), false)} />
    </div>)}
    {!state.rows.length && <textarea className={styles.text} rows={4} disabled={disabled} aria-label="알림장 내용 입력" value={text} onChange={event => onChange(event.target.value)} />}
    </div>
    <span className={styles.status} role="status">{announcement}</span>
  </div>;
}
