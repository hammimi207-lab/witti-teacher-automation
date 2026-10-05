"use client";
import { useEffect, useState } from "react";
import { handoffKey, readHandoff } from "../home/observation-handoff";

export function ObservationImport({ userId, token, onApply, disabled }: {
  userId: string; token?: string; onApply: (text: string) => void; disabled: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!userId || !token || !/^[0-9a-f-]{36}$/.test(token)) return;
    try {
      const saved = readHandoff(sessionStorage.getItem(handoffKey(userId, token)));
      // Browser storage is available only after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(saved?.text ?? null);
      if (!saved) setError("연결할 관찰 내용이 만료되었어요. 홈에서 다시 연결해 주세요.");
    } catch { setError("관찰 내용을 읽지 못했어요. 브라우저 저장 공간을 확인해 주세요."); }
  }, [userId, token]);
  if (error && text === null) return <p role="alert" className="error">{error}</p>;
  if (text === null) return null;
  return <section className="panel observation-transcript"><h2>연결한 관찰 내용</h2>
    <p>전사·영상 관찰 내용을 확인한 뒤 현재 기록에 추가해 주세요. 기존 입력은 유지됩니다.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <label className="capture-memo">기록에 넣을 관찰 내용<textarea rows={4} maxLength={15000} value={text} onChange={event => { setText(event.target.value); setError(""); }} /></label>
    <button type="button" className="button primary" disabled={disabled || !text.trim()} onClick={() => {
      try {
        onApply(text); sessionStorage.removeItem(handoffKey(userId, token!)); setText(null);
        const url = new URL(window.location.href); url.searchParams.delete("observation");
        window.history.replaceState(null, "", url);
      }
      catch (cause) { setError(cause instanceof Error ? cause.message : "연결 상태를 정리하지 못했어요. 다시 시도해 주세요."); }
    }}>현재 기록의 관찰 입력에 추가</button></section>;
}
