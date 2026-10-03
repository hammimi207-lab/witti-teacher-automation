"use client";
import { useEffect, useRef, useState } from "react";
import { openObservationRecord } from "./observation-handoff";
export function AudioFileAnalysis({ userId }: { userId: string }) {
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState("");
  const [text, setText] = useState<string | null>(null), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file);
    // Browser-only resource, released when the selected file changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(next); return () => URL.revokeObjectURL(next);
  }, [file]);
  async function analyze() {
    if (!file || !consent || lock.current) return;
    if (!file.size || file.size > 4_000_000) { setError("녹음 파일은 비어 있지 않은 4MB 이하 파일이어야 해요."); return; }
    lock.current = true; setBusy(true); setError(""); setText(null);
    try {
      const form = new FormData(); form.set("audio", file); form.set("consent", "accepted");
      const response = await fetch("/api/observations/audio-file", { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setText(data.text || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "녹음 파일을 분석하지 못했어요."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="observation-transcript"><p>저장해 둔 녹음 파일의 말을 텍스트로 옮기고 기록에 연결해요.</p>
    <label className="capture-memo">녹음 파일 선택<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm,audio/ogg,.m4a,.wav,.mp3" disabled={busy} onChange={event => {
      setFile(event.target.files?.[0] || null); setUrl(""); setText(null); setConsent(false); setError("");
    }} /></label><p className="capture-note">MP3·M4A·WAV·WebM·Ogg, 4MB 이하</p>
    {file && url && <audio controls src={url} />}
    <label><input type="checkbox" disabled={busy} checked={consent} onChange={event => setConsent(event.target.checked)} /> 녹음 파일을 OpenAI로 전송해 전사하는 데 동의합니다.</label>
    <button className="button primary" type="button" disabled={busy || !file || !consent} onClick={() => void analyze()}>{busy ? "파일을 전사하고 있어요…" : "녹음 파일 분석하기"}</button>
    {error && <p role="alert" className="error">{error}</p>}
    {text !== null && <><label className="capture-memo">전사문 확인·수정<textarea rows={6} maxLength={15000} value={text} onChange={event => setText(event.target.value)} /></label>
      {!text.trim() && <p>인식된 말소리가 없어요. 원본 녹음을 확인해 주세요.</p>}
      <button className="button primary" type="button" disabled={!text.trim()} onClick={() => { try { openObservationRecord(userId, text); } catch (cause) { setError(cause instanceof Error ? cause.message : "기록을 연결하지 못했어요."); } }}>이 관찰로 새 기록 만들기</button></>}
  </section>;
}
