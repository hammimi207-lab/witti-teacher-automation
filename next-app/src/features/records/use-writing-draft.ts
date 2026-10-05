"use client";
import { useEffect, useRef, useState } from "react";
import { draftKey, readDraft, hasDraftContent, type WritingDraft } from "./writing-draft";
import type { GeneratedRecord } from "./schema";

export function useWritingDraft(userId: string, payload: Omit<WritingDraft, "version" | "updatedAt" | "result"> & { result: GeneratedRecord | null }) {
  const [candidate, setCandidate] = useState<WritingDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const revision = useRef(0);
  const key = draftKey(userId);
  const serialized = JSON.stringify(payload);
  useEffect(() => {
    // Browser storage and account changes are hydrated after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!userId) { setCandidate(null); setReady(true); setStatus("비회원 이용 중 · 작성 내용은 저장되지 않습니다"); return; }
    try {
      const saved = readDraft(localStorage.getItem(key));
      setCandidate(saved); setReady(!saved);
    } catch { setStatus("임시 저장을 사용할 수 없어요. 브라우저 저장 공간을 확인해 주세요."); setReady(true); }
  }, [key, userId]);
  useEffect(() => {
    if (!ready || !userId) return;
    const activeRevision = revision.current;
    function flush() {
      // A reset invalidates pending timers and cleanup writes from the previous record.
      if (activeRevision !== revision.current) return;
      try {
        const current = JSON.parse(serialized);
        if (!hasDraftContent(current.input) && !current.result) {
          localStorage.removeItem(key); setStatus("작성 내용은 이 브라우저에 임시 저장됩니다 · 사진 제외"); return;
        }
        const updatedAt = new Date().toISOString();
        localStorage.setItem(key, JSON.stringify({ ...JSON.parse(serialized), version: 1, updatedAt }));
        setStatus("이 브라우저에 임시 저장됨 · 사진은 다시 첨부해 주세요");
      } catch { setStatus("임시 저장 실패 · 화면을 떠나기 전에 최종 글을 복사해 주세요."); }
    }
    const timer = window.setTimeout(flush, 500);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", onHide);
    return () => { clearTimeout(timer); flush(); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onHide); };
  }, [key, serialized, ready, userId]);
  function resolve() { setCandidate(null); setReady(true); }
  function clear() {
    revision.current += 1;
    setCandidate(null); setReady(true);
    if (!userId) return;
    try { localStorage.removeItem(key); setStatus("작성 내용을 모두 초기화했습니다."); }
    catch { setStatus("화면은 초기화했지만 브라우저 임시 저장을 지우지 못했습니다."); }
  }
  return { candidate, ready, status, resolve, clear };
}
