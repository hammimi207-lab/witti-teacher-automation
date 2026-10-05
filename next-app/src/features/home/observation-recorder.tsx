"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CaptureDialog, type CaptureDialogHandle } from "./capture-dialog";
import { ObservationPlayChoice, type Play } from "./observation-play-choice";
import { openObservationRecord } from "./observation-handoff";

export type ObservationRecorderHandle = { open: () => void };
type Saved = { fragment_id: string; recorded_at: string; play_topic: string | null };
type Draft = { blob: Blob; url: string; startedAt: string; endedAt: string; durationMs: number };
type Phase = "idle" | "requesting" | "recording" | "paused" | "stopping";
const length = (ms: number) => `${Math.floor(ms / 60000)}분 ${Math.floor(ms / 1000) % 60}초`;
const message = (cause: unknown) => cause instanceof Error ? cause.message : "요청을 처리하지 못했어요.";

export const ObservationRecorder = forwardRef<ObservationRecorderHandle, { onActivity: (count: number, dirty: boolean) => void; userId?: string; onApply?: (text: string, id: string) => void }>(function ObservationRecorder({ onActivity, userId = "", onApply }, ref) {
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
  const [transcript, setTranscript] = useState("");
  const [historyId, setHistoryId] = useState("");
  const [audioAccepted, setAudioAccepted] = useState(false);

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try { const response = await fetch("/api/observations/recording-history", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSaved(data.recordings || []); }
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
      const id = crypto.randomUUID(); setHistoryId(id); void logExecution(id, new Date(started.current).toISOString()).catch(cause => setError(message(cause)));
    } catch (cause) { if (token === attempt.current) { setPhase("idle"); setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "마이크 권한이 필요해요." : "마이크를 사용할 수 없어요."); } }
  }
  function clearDraft() { if (draft) URL.revokeObjectURL(draft.url); setDraft(null); setTranscript(""); setHistoryId(""); setAudioAccepted(false); }
  async function logExecution(id: string, date: string) {
    if (!userId) return;
    const response = await fetch("/api/observations/recording-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, recordedAt: date, playId: nextPlayId || null }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    await load(); await loadPlays();
  }
  async function upload(file: File | undefined) {
    if (!file || busy || phase !== "idle") return;
    const types: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg", mp4: "audio/mp4" };
    const type = file.type || types[file.name.split(".").pop()?.toLowerCase() || ""];
    if (!type || !Object.values(types).includes(type.split(";")[0]) || !file.size || file.size > 4000000) { setError("MP3·M4A·WAV·WEBM·OGG·MP4 형식의 4MB 이하 녹음 파일을 선택해 주세요."); return; }
    if (draft && !window.confirm("현재 임시 녹음과 전사문을 새 파일로 바꿀까요? 필요한 파일은 먼저 내려받아 주세요.")) return;
    clearDraft(); setError(""); const now = new Date().toISOString(); const blob = new Blob([file], { type });
    const id = crypto.randomUUID(); setHistoryId(id);
    setDraft({ blob, url: URL.createObjectURL(blob), startedAt: now, endedAt: now, durationMs: 0 });
    try { await logExecution(id, now); } catch (cause) { setError(message(cause)); }
  }
  async function transcribe() {
    if (!draft || busy || !audioAccepted || !userId) return;
    setBusy("transcribing"); setError("");
    try {
      const id = historyId || crypto.randomUUID(); setHistoryId(id);
      await logExecution(id, draft.startedAt);
      const form = new FormData(); form.set("audio", draft.blob, "observation"); form.set("consent", "accepted");
      const response = await fetch("/api/observations/audio-file", { method: "POST", body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error); setTranscript(data.text || "");
    } catch (cause) { setError(message(cause)); } finally { setBusy(""); }
  }
  useImperativeHandle(ref, () => ({ open: () => { dialog.current?.open(); if (userId) { void load(); void loadPlays(); } } }));
  useEffect(() => { onActivity(saved.length + Number(Boolean(draft)), Boolean(draft) || phase !== "idle"); }, [saved.length, draft, phase, onActivity]);
  useEffect(() => { if (phase !== "recording") return; const timer = window.setInterval(() => { const ms = Date.now() - started.current - paused.current; setDuration(ms); if (ms >= 600000) stop(); }, 500); return () => clearInterval(timer); }, [phase]);
  useEffect(() => () => { attempt.current++; if (recorder.current?.state && recorder.current.state !== "inactive") recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); if (draft) URL.revokeObjectURL(draft.url); }, [draft]);

  return <CaptureDialog ref={dialog} id="observation-title" title="관찰 녹음" beforeClose={() => !busy && window.confirm("따로 저장하지 않은 녹음 파일은 저장되지 않습니다. 필요한 녹음은 기기에 내려받아 주세요. 저장한 파일은 추후 STEAM 분석에도 활용할 수 있습니다. 닫을까요?")} onClose={() => { if (phase !== "idle") stop(true); clearDraft(); }}>
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
    <p className="capture-note">원본 녹음과 전사문은 기록요정에 자동 저장되지 않습니다. 실행 이력과 연결한 놀이명만 남습니다. 필요한 녹음은 따로 내려받으면 추후 STEAM 분석에도 활용할 수 있습니다.</p>
    <label className="capture-memo">녹음 파일 업로드<input type="file" accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg,.mp4" disabled={!!busy || phase !== "idle"} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>
    <p className="capture-note">MP3·M4A·WAV·WEBM·OGG·MP4, 최대 4MB. 업로드한 파일도 전사 후 서버에 보관하지 않습니다.</p>
    {draft && <section className="observation-transcript"><audio controls src={draft.url} /><p>{draft.durationMs ? "녹음 길이: " + length(draft.durationMs) : "업로드한 녹음 파일"}</p>
      <a className="button secondary" href={draft.url} download={"관찰-녹음." + ({ "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/ogg": "ogg" }[draft.blob.type.split(";")[0]] || "webm")}>녹음 파일 따로 저장</a>
      {userId && <><label className="capture-memo"><input type="checkbox" checked={audioAccepted} onChange={event => setAudioAccepted(event.target.checked)} />음성 파일을 AI 전사 서비스에 전송하는 데 동의합니다.</label><button className="button secondary" type="button" disabled={!!busy || !audioAccepted} onClick={() => void transcribe()}>{busy === "transcribing" ? "전사 중…" : "전사하기"}</button></>}
      <button className="button secondary" type="button" disabled={!!busy} onClick={clearDraft}>임시 녹음 지우기</button>
      {transcript && <><label className="capture-memo">교사 확인 전사문<textarea rows={8} value={transcript} onChange={event => setTranscript(event.target.value)} /></label><p>음성과 비교해 확인해 주세요. 이 글도 닫으면 사라집니다. 필요한 글은 복사하거나 STEAM 관찰에 추가하세요.</p><button className="button primary" type="button" disabled={!!busy || !transcript.trim()} onClick={() => { if (!window.confirm("관찰 글을 연결하고 녹음 창을 닫을까요? 따로 저장하지 않은 녹음 파일은 저장되지 않습니다. 필요한 파일은 먼저 내려받아 주세요. 저장한 파일은 추후 STEAM 분석에도 활용할 수 있습니다.")) return; try { if (onApply) { onApply(transcript, historyId); dialog.current?.close(); } else openObservationRecord(userId, transcript); } catch (cause) { setError(message(cause)); } }}>{onApply ? "STEAM 관찰에 추가" : "이 관찰로 새 기록 만들기"}</button></>}
    </section>}
    <h3>녹음 실행 이력</h3><p className="capture-note">음성·전사문 없이 실행 일시와 놀이 연결만 표시합니다.</p>
    <ul className="observation-clips">{saved.map(row => { const id = row.fragment_id; const linkedTitle = plays.find(play => play.cluster_id === playLinks[id])?.title; return <li key={id}><b>{linkedTitle || row.play_topic || "놀이 연결 없음"}</b><time dateTime={row.recorded_at}>{new Date(row.recorded_at).toLocaleString("ko-KR")}</time><ObservationPlayChoice fragmentId={id} linkedId={playLinks[id] || ""} plays={plays} hasTranscript={false} disabled={!!busy} onLink={linkPlay} onCreateAndLink={createAndLink} /></li>; })}</ul>
  </CaptureDialog>;
});
