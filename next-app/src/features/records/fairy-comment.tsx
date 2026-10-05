"use client";
import { FairyImage } from "./fairy-image";

import { useId, useRef, useState, type ReactNode } from "react";
import { Minus, StickyNote } from "lucide-react";

function FairyIcon() { return <FairyImage className="fairy-comment-avatar" width={46} height={54} />; }

export function FairyComment({ children, comment, available }: { children: ReactNode; comment: ReactNode; available: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const id = useId();
  const reopen = useRef<HTMLButtonElement>(null);
  const minimize = useRef<HTMLButtonElement>(null);
  function hide() {
    setCollapsed(true);
    requestAnimationFrame(() => reopen.current?.focus());
  }
  return <div className={`fairy-comment-layout${available && !collapsed ? " has-comment" : ""}`}>
    <div className="fairy-comment-input">
      {available && <div className="fairy-comment-toolbar"><button ref={reopen} type="button" className="fairy-comment-toggle" aria-expanded={!collapsed} aria-controls={id} onClick={() => {
        if (!collapsed) hide();
        else { setCollapsed(false); requestAnimationFrame(() => minimize.current?.focus()); }
      }}><StickyNote size={16} aria-hidden="true" />코멘트가 있어요</button></div>}
      {children}
    </div>
    <aside id={id} className="fairy-comment-note" aria-label="기록요정의 코멘트" hidden={!available || collapsed}>
      <FairyIcon />
      <div className="fairy-comment-bubble">
        <div className="fairy-comment-heading"><strong>기록요정의 작은 메모</strong><button ref={minimize} type="button" className="fairy-comment-minimize" aria-label="코멘트 메모 숨기기" title="메모 숨기기" onClick={hide}><Minus size={17} aria-hidden="true" /></button></div>
        <div className="fairy-comment-content">{comment}</div>
      </div>
    </aside>
  </div>;
}
