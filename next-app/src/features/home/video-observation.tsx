"use client";
import { useEffect, useRef, useState } from "react";
import { prepareObservationVideo } from "./prepare-observation-video";
import { openObservationRecord } from "./observation-handoff";
import type { VideoObservation } from "../records/video-observation-schema";

export function VideoObservation({ userId = "" }: { userId?: string }) {
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState("");
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VideoObservation | null>(null), [text, setText] = useState("");
  const [transcript, setTranscript] = useState(""), [note, setNote] = useState(""), [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    if (!file) return;
    const value = URL.createObjectURL(file);
    // Object URLs are browser resources, created after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  async function analyze() {
    if (!file || !consent || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setResult(null); setText("");
    try {
      const form = await prepareObservationVideo(file); form.set("consent", "accepted");
      const response = await fetch("/api/observations/video", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "영상 분석을 완료하지 못했어요.");
      if (data.userId !== userId) throw new Error("로그인 계정이 바뀌었어요. 홈을 새로고침해 주세요.");
      setResult(data.data); setText(data.data.teacherDraft); setTranscript(data.transcript); setNote(data.transcriptNote);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "영상 분석을 완료하지 못했어요."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="observation-transcript"><h3>촬영한 영상으로 관찰하기</h3>
    <p className="capture-note">MP4·WebM, 90초·100MB 이하. 3MB보다 큰 영상은 기기에서 음성과 8개 장면을 추출해 전송하며 원본은 업로드하지 않아요.</p>
    {!userId && <p>로그인한 뒤 영상 관찰을 이용해 주세요.</p>}
    <label className="capture-memo">촬영한 영상 선택<input type="file" accept="video/mp4,video/webm" disabled={busy || !userId} onChange={event => {
      setFile(event.target.files?.[0] || null); setResult(null); setText(""); setTranscript(""); setNote(""); setError(""); setUrl(""); setConsent(false);
    }} /></label>
    {file && url && <video controls playsInline preload="metadata" src={url} style={{ width: "100%", maxHeight: 260 }} />}
    <label className="capture-note"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /> 영상·음성·추출 장면을 OpenAI로 전송하는 데 동의하며 보호자 동의와 기관 지침을 확인했습니다.</label>
    <button type="button" className="button secondary" disabled={busy || !file || !consent || !userId} onClick={() => void analyze()}>{busy ? "음성과 장면을 분석하고 있어요…" : "영상 전사·상황 분석"}</button>
    {error && <p role="alert" className="error">{error}</p>}
    {result && <><h3>장면 분석: {result.classification}</h3><p>{result.reason}</p><p className="transcript-text">{result.observations}</p>
      <h3>놀이 이야기 과정</h3>{result.stages.map((item, index) => <p key={index}><b>{item.stage} · {item.second}초</b><br />{item.evidence}</p>)}
      <p className="capture-note">관찰 부족: {result.missingStages}</p>
      <p className="capture-note">표본 장면 사이 사건은 놓칠 수 있어요. 표정으로 감정이나 발달 수준을 확정하지 않아요.</p>
      <details><summary>음성 전사 원문</summary><p className="transcript-text">{transcript || "인식된 말소리가 없어요."}</p>{note && <p>{note}</p>}</details>
      <label className="capture-memo">기록에 넣을 관찰 내용<textarea rows={5} maxLength={15000} value={text} onChange={event => setText(event.target.value)} /></label>
      <button type="button" className="button primary" disabled={!text.trim()} onClick={() => { try { openObservationRecord(userId, text); } catch (cause) { setError(cause instanceof Error ? cause.message : "기록 연결을 완료하지 못했어요."); } }}>이 관찰로 새 기록 만들기</button>
    </>}
  </section>;
}
