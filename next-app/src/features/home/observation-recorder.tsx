"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CaptureDialog, type CaptureDialogHandle } from "./capture-dialog";
import { ObservationPlayChoice, type Play } from "./observation-play-choice";
import { openObservationRecord } from "./observation-handoff";

export type ObservationRecorderHandle = { open: () => void };
type Saved = { fragment_id: string; recorded_at: string; play_topic: string | null; record_audio: { duration_ms: number; transcription_status: string }; record_transcriptions: { raw_transcription: string; teacher_edited_transcription: string | null; created_at: string }[] };
type Draft = { blob: Blob; url: string; startedAt: string; endedAt: string; durationMs: number };
type Phase = "idle" | "requesting" | "recording" | "paused" | "stopping";
const length = (ms: number) => `${Math.floor(ms / 60000)}분 ${Math.floor(ms / 1000) % 60}초`;
const message = (cause: unknown) => cause instanceof Error ? cause.message : "요청을 처리하지 못했어요.";

export const ObservationRecorder = forwardRef<ObservationRecorderHandle, { onActivity: (count: number, dirty: boolean) => void; userId?: string }>(function ObservationRecorder({ onActivity, userId = "" }, ref) {
  const dialog = useRef<CaptureDialogHandle>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const attempt = useRef(0);
  const started = useRef(0);
  const paused = useRef(0);
  const pauseStarted = useRef(0);
  const discard = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [duration, setDuration] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [plays, setPlays] = useState<Play[]>([]);
  const [playLinks, setPlayLinks] = useState<Record<string, string>>({});
  const [nextPlayId, setNextPlayId] = useState("");
  const [newPlayTitle, setNewPlayTitle] = useState("");
  const [creatingNextPlay, setCreatingNextPlay] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try { const response = await fetch("/api/observations/recordings", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSaved(data.recordings || []); }
    catch (cause) { setError(message(cause)); }
  }
  async function loadPlays() {
    try {
      const response = await fetch("/api/observations/plays", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPlays(data.plays || []);
      setPlayLinks(Object.fromEntries((data.links || []).map((link: { fragment_id: string; cluster_id: string }) => [link.fragment_id, link.cluster_id])));
    } catch (cause) { setError(message(cause)); }
  }
  async function createPlay(title: string) {
    const response = await fetch("/api/observations/plays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", title }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "새 놀이를 만들지 못했어요.");
    const play = data.play as Play;
    setPlays(previous => previous.some(item => item.cluster_id === play.cluster_id) ? previous : [play, ...previous]);
    return play;
  }
  async function linkPlay(fragmentId: string, clusterId: string) {
    const previousId = playLinks[fragmentId] || "";
    setPlayLinks(previous => ({ ...previous, [fragmentId]: clusterId }));
    setBusy(fragmentId); setError("");
    try {
      const response = await fetch("/api/observations/plays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: clusterId ? "link" : "unlink", fragmentId, ...(clusterId ? { clusterId } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "놀이 연결을 저장하지 못했어요.");
      return true;
    } catch (cause) { setPlayLinks(previous => ({ ...previous, [fragmentId]: previousId })); setError(message(cause)); return false; }
    finally { setBusy(""); }
  }
  async function createAndLink(fragmentId: string, title: string) {
    try { const play = await createPlay(title); return await linkPlay(fragmentId, play.cluster_id); }
    catch (cause) { setError(message(cause)); return false; }
  }
  function stop(cancel = false) {
    attempt.current++; discard.current = cancel;
    if (recorder.current?.state && recorder.current.state !== "inactive") { setPhase("stopping"); recorder.current.stop(); } else setPhase("idle");
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
  }
  async function start() {
    if (recorder.current || phase === "requesting" || draft) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("이 브라우저에서는 마이크 녹음을 지원하지 않아요."); return; }
    setError(""); const token = ++attempt.current; setPhase("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== attempt.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; const instance = new MediaRecorder(media, { audioBitsPerSecond: 32000 }); recorder.current = instance;
      const chunks: Blob[] = []; started.current = Date.now(); paused.current = 0; pauseStarted.current = 0; discard.current = false;
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onstop = () => {
        media.getTracks().forEach(track => track.stop()); recorder.current = null; stream.current = null;
        const end = Date.now();
        if (!discard.current && chunks.length) { const blob = new Blob(chunks, { type: instance.mimeType || chunks[0].type }); setDraft({ blob, url: URL.createObjectURL(blob), startedAt: new Date(started.current).toISOString(), endedAt: new Date(end).toISOString(), durationMs: end - started.current - paused.current - (pauseStarted.current ? end - pauseStarted.current : 0) }); }
        else if (!discard.current) setError("녹음된 소리가 없어요.");
        setPhase("idle");
      };
      instance.onerror = () => { setError("녹음이 중단됐어요."); stop(); };
      instance.start(1000); setDuration(0); setPhase("recording");
    } catch (cause) { if (token === attempt.current) { setPhase("idle"); setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "마이크 권한이 필요해요." : "마이크를 사용할 수 없어요."); } }
  }
  function clearDraft() { if (draft) URL.revokeObjectURL(draft.url); setDraft(null); }
  async function transcribe(id: string) {
    setBusy(id); setError("");
    try { const response = await fetch(`/api/observations/recordings/${id}`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); }
    catch (cause) { setError(message(cause)); await load(); } finally { setBusy(""); }
  }
  async function save(withTranscription: boolean) {
    if (!draft || busy) return;
    setBusy("saving"); setError("");
    try {
      const form = new FormData(); form.set("audio", draft.blob, "observation"); form.set("startedAt", draft.startedAt); form.set("endedAt", draft.endedAt); form.set("durationMs", String(draft.durationMs)); form.set("playTopic", "");
      const response = await fetch("/api/observations/recordings", { method: "POST", body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error);
      clearDraft(); await load(); setBusy("");
      if (nextPlayId) await linkPlay(data.id, nextPlayId);
      if (withTranscription) await transcribe(data.id);
    } catch (cause) { setError(message(cause)); } finally { setBusy(""); }
  }
  async function mutate(id: string, method: "PATCH" | "DELETE", body?: object) {
    setBusy(id); setError("");
    try { const response = await fetch(`/api/observations/recordings/${id}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); }
    catch (cause) { setError(message(cause)); } finally { setBusy(""); }
  }
  async function saveFragment(id: string, kind: "child_speech" | "observation") {
    if (!selected[id]?.trim()) { setError("저장할 문장을 먼저 붙여넣어 주세요."); return; }
    setBusy(id); setError("");
    try { const response = await fetch("/api/observations/fragments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: id, kind, text: selected[id] }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSelected(previous => ({ ...previous, [id]: "" })); setError("기록 조각을 저장했어요."); }
    catch (cause) { setError(message(cause)); } finally { setBusy(""); }
  }
  useImperativeHandle(ref, () => ({ open: () => { dialog.current?.open(); if (userId) { void load(); void loadPlays(); } } }));
  useEffect(() => { onActivity(saved.length + Number(Boolean(draft)), Boolean(draft) || phase !== "idle"); }, [saved.length, draft, phase, onActivity]);
  useEffect(() => { if (phase !== "recording") return; const timer = window.setInterval(() => { const ms = Date.now() - started.current - paused.current; setDuration(ms); if (ms >= 600000) stop(); }, 500); return () => clearInterval(timer); }, [phase]);
  useEffect(() => () => { attempt.current++; if (recorder.current?.state && recorder.current.state !== "inactive") recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); if (draft) URL.revokeObjectURL(draft.url); }, [draft]);

  return <CaptureDialog ref={dialog} id="observation-title" title="관찰 녹음" onClose={() => { if (phase !== "idle") stop(); }}>
    {userId && <fieldset className="observation-play-choice"><legend>다음 녹음의 놀이</legend>
      <label><input type="radio" name="next-play" checked={!nextPlayId} onChange={() => setNextPlayId("")} /> 아직 정하지 않기</label>
      {plays.map(play => <label key={play.cluster_id}><input type="radio" name="next-play" checked={nextPlayId === play.cluster_id} onChange={() => setNextPlayId(play.cluster_id)} /> {play.title}</label>)}
      <button className="button secondary" type="button" onClick={() => setCreatingNextPlay(value => !value)}>새 놀이 만들기</button>
      {creatingNextPlay && <div className="observation-new-play"><label>새 놀이명<input value={newPlayTitle} maxLength={100} onChange={event => setNewPlayTitle(event.target.value)} /></label><button className="button secondary" type="button" disabled={!newPlayTitle.trim()} onClick={() => { void createPlay(newPlayTitle.trim()).then(play => { setNextPlayId(play.cluster_id); setNewPlayTitle(""); setCreatingNextPlay(false); }).catch(cause => setError(message(cause))); }}>추가하고 선택</button></div>}
    </fieldset>}
    <p role="status">{phase === "requesting" ? "마이크 사용을 허용하면 바로 녹음해요." : phase === "recording" ? `녹음 중 · ${length(duration)}` : phase === "paused" ? `일시정지 · ${length(duration)}` : phase === "stopping" ? "녹음을 정리하고 있어요…" : draft ? "녹음 종료 · 저장 방법을 선택해 주세요." : "관찰을 녹음해 주세요."}</p>
    <div className="capture-actions">
      {phase === "recording" && <><button className="button secondary" type="button" onClick={() => { recorder.current?.pause(); pauseStarted.current = Date.now(); setPhase("paused"); }}>일시정지</button><button className="button primary" type="button" onClick={() => stop()}>종료</button><button className="button secondary" type="button" onClick={() => stop(true)}>취소</button></>}
      {phase === "paused" && <><button className="button primary" type="button" onClick={() => { paused.current += Date.now() - pauseStarted.current; pauseStarted.current = 0; recorder.current?.resume(); setPhase("recording"); }}>다시 시작</button><button className="button secondary" type="button" onClick={() => stop()}>종료</button><button className="button secondary" type="button" onClick={() => stop(true)}>취소</button></>}
      {phase === "requesting" && <button className="button secondary" type="button" onClick={() => stop(true)}>권한 요청 취소</button>}
      {phase === "idle" && !draft && <button className="button primary" type="button" onClick={() => void start()}>녹음 시작</button>}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {draft && <section className="observation-transcript"><audio controls src={draft.url} /><p>녹음 길이: {length(draft.durationMs)}</p>{userId ? <><p className="capture-note">저장할 때 선택한 놀이가 이 녹음에 연결돼요. 저장 후에도 바꿀 수 있어요.</p><div className="capture-actions"><button className="button primary" type="button" disabled={!!busy} onClick={() => void save(false)}>녹음 저장</button><button className="button secondary" type="button" disabled={!!busy} onClick={() => void save(true)}>전사하기</button><button className="button secondary" type="button" disabled={!!busy} onClick={() => void save(false)}>전사하지 않고 저장</button></div></> : <><p className="capture-note">비회원 녹음은 기기에 내려받을 수 있어요. 회원은 녹음 저장과 전사도 이용할 수 있어요.</p><a className="button secondary" href={draft.url} download="관찰-녹음">녹음 내려받기</a></>}<button className="button secondary" type="button" disabled={!!busy} onClick={clearDraft}>삭제</button></section>}
    <ul className="observation-clips">{saved.map(row => { const id = row.fragment_id; const audio = Array.isArray(row.record_audio) ? row.record_audio[0] : row.record_audio; const transcript = [...(row.record_transcriptions || [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]; const linkedTitle = plays.find(play => play.cluster_id === playLinks[id])?.title; return <li key={id}><b>{linkedTitle || "놀이 연결 없음"}</b>{row.play_topic && !linkedTitle && <p className="capture-note">기존 입력 놀이명: {row.play_topic} · 연결 확인 필요</p>}<time dateTime={row.recorded_at}>{new Date(row.recorded_at).toLocaleString("ko-KR")} · {length(audio?.duration_ms || 0)}</time><audio controls src={`/api/observations/recordings/${id}`} aria-label="원본 녹음 재생" /><ObservationPlayChoice fragmentId={id} linkedId={playLinks[id] || ""} plays={plays} hasTranscript={Boolean(transcript?.raw_transcription?.trim())} disabled={!!busy} onLink={linkPlay} onCreateAndLink={createAndLink} /><div className="capture-actions"><a className="button secondary" href={`/api/observations/recordings/${id}`} download={`관찰-${id}`}>원본 내려받기</a>{audio?.transcription_status !== "done" && <button className="button secondary" type="button" disabled={!!busy} onClick={() => void transcribe(id)}>{busy === id ? "전사 중…" : "전사하기"}</button>}<button className="button secondary" type="button" disabled={!!busy} onClick={() => { if (window.confirm("이 녹음을 삭제할까요?")) void mutate(id, "DELETE"); }}>삭제</button></div>
      {transcript && <section className="observation-transcript"><h3>녹음 원문</h3><p className="transcript-text" onMouseUp={() => { const value = window.getSelection()?.toString().trim(); if (value && transcript.raw_transcription.includes(value)) setSelected(previous => ({ ...previous, [id]: value })); }}>{transcript.raw_transcription || "인식된 말소리가 없어요."}</p><p className="capture-note">원본 음성과 비교해 확인해 주세요.</p><div className="capture-actions"><button className="button secondary" type="button" onClick={() => setSelected(previous => ({ ...previous, [id]: transcript.raw_transcription }))}>전체 붙여넣기</button><button className="button secondary" type="button" onClick={() => { const value = window.getSelection()?.toString().trim(); if (value && transcript.raw_transcription.includes(value)) setSelected(previous => ({ ...previous, [id]: value })); else setError("녹음 원문에서 문장을 먼저 선택해 주세요."); }}>선택한 부분 붙여넣기</button></div><label className="capture-memo">기록 조각으로 저장할 문장<textarea rows={3} value={selected[id] || ""} onChange={event => setSelected(previous => ({ ...previous, [id]: event.target.value }))} /></label><div className="capture-actions"><button className="button secondary" type="button" disabled={!!busy} onClick={() => void saveFragment(id, "child_speech")}>아이의 말로 저장</button><button className="button secondary" type="button" disabled={!!busy} onClick={() => void saveFragment(id, "observation")}>관찰기록으로 저장</button></div><label className="capture-memo">교사 수정 전사문<textarea rows={3} value={edited[id] ?? transcript.teacher_edited_transcription ?? transcript.raw_transcription} onChange={event => setEdited(previous => ({ ...previous, [id]: event.target.value }))} /></label><button className="button secondary" type="button" disabled={!!busy} onClick={() => void mutate(id, "PATCH", { teacherEditedTranscription: edited[id] ?? transcript.teacher_edited_transcription ?? transcript.raw_transcription })}>교사 수정본 저장</button></section>}
      {transcript && <button className="button primary" type="button" disabled={!!busy || !userId || !(edited[id] ?? transcript.teacher_edited_transcription ?? transcript.raw_transcription).trim()} onClick={() => {
        try { openObservationRecord(userId, edited[id] ?? transcript.teacher_edited_transcription ?? transcript.raw_transcription); }
        catch (cause) { setError(message(cause)); }
      }}>이 관찰로 새 기록 만들기</button>}
    </li>; })}</ul>
  </CaptureDialog>;
});
