"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ObservationRecorder, type ObservationRecorderHandle } from "../home/observation-recorder";
import { appendObservation } from "../home/observation-handoff";
import { RecordAssembly } from "../records/record-assembly";
import { preparePhoto, type SavedPhoto } from "../records/document-photos";
import { AI_CONSENT_TEXT, PHOTO_CONSENT_TEXT, AI_CONSENT_VERSION } from "../records/ai-consent";
import { recordInputSchema } from "../records/schema";
import { generatedSchema } from "../records/result-schema";
import type { SavedEnvelope } from "../records/save-contract";
import { steamAnalysisSchema, steamDraftSchema, steamRunSchema, steamStorySchema, storySource, processDraft, photoObservationText, type SteamAnalysis, type SteamSaved, type SteamRun } from "../records/steam-schema";
import styles from "./workflow.module.css";
import { PlayReferences } from "./play-references";

const steps = ["사진 올리기", "관찰 더하기", "STEAM 읽기", "놀이 이어가기", "과정 기록하기", "참고문헌 더보기"];
const emptyProcess = { interest: "", attempt: "", change: "", repeat: "", teacher: "", next: "" };
type LocalPhoto = { key: string; file: File; url: string };
const failure = (cause: unknown) => cause instanceof Error ? cause.message : "연결하지 못했습니다. 다시 시도해 주세요.";
const areaNames: Record<string, string> = { "S 과학": "S 과학 · 만져 보고 변화를 살피는 놀이", "T 기술": "T 기술 · 도구를 써 보는 놀이", "E 공학": "E 공학 · 놓고 이어 만드는 놀이", "A 예술": "A 예술 · 소리·몸·재료로 표현하는 놀이", "M 수학": "M 수학 · 크기·양·자리를 비교하는 놀이" };
function PlaySupport({ support }: { support: SteamAnalysis["support"] }) {
  return <div className={styles.supportSections}>
    <section><h4>재료와 놀이 공간</h4><ul>{support.materials.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
    <section><h4>교사가 해볼 말과 지원</h4><p>{support.teacher}</p></section>
    <section><h4>다음 놀이에서 관찰할 행동</h4><p className={styles.supportHint}>아직 관찰된 행동이 아닙니다. 놀이가 이어질 때 눈여겨봐 주세요.</p><ul>{support.watch.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
    <section className={styles.safety}><h4>안전하게 놀이하려면</h4><p>{support.safety}</p></section>
  </div>;
}
function ObservationPhoto({ src, alt }: { src: string; alt: string }) {
  // Selected local/private photos use the existing authenticated preview route.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.observationPhoto} src={src} alt={alt} />;
}

export function SteamWorkflow({ userId, initial }: { userId: string; initial: SavedEnvelope | null }) {
  const saved = initial?.steam;
  const [step, setStep] = useState(saved ? 4 : 0);
  const [age, setAge] = useState<SteamSaved["age"]>(saved?.age || "2세");
  const [observation, setObservation] = useState(saved?.commonObservation ?? saved?.sourceObservation ?? "");
  const [title, setTitle] = useState(initial?.input.playName || "STEAM 놀이 과정");
  const [gallery, setGallery] = useState<SavedPhoto[]>([]);
  const [galleryOffset, setGalleryOffset] = useState(0), [hasMore, setHasMore] = useState(false);
  const [photoIds, setPhotoIds] = useState(saved?.photoIds || []);
  const [files, setFiles] = useState<LocalPhoto[]>([]);
  const [photoNotes, setPhotoNotes] = useState<Record<string, { speech: string; action: string; flow: string }>>(() => Object.fromEntries((saved?.photoIds || []).map((id, index) => [`saved:${id}`, saved?.photoObservations?.[index] || { speech: "", action: "", flow: "" }])));
  const [recordingPhoto, setRecordingPhoto] = useState<string | null>(null);
  const [recordingIds, setRecordingIds] = useState(saved?.recordingIds || []);
  const [analysis, setAnalysis] = useState<SteamAnalysis | null>(saved?.analysis || null);
  const [run, setRun] = useState<SteamRun | null>(saved?.run || null);
  const [previousRuns, setPreviousRuns] = useState<NonNullable<SteamSaved["previousRuns"]>>(saved?.previousRuns || []);
  const [candidate, setCandidate] = useState<{ analysis: SteamAnalysis; signature: string; run: SteamRun | null } | null>(null);
  const [analyzedSignature, setAnalyzedSignature] = useState(saved ? JSON.stringify({ age: saved.age, observation: saved.sourceObservation.trim(), photoIds: saved.photoIds, files: [], photoObservations: saved.photoIds.map((_, index) => ({ photo: index + 1, speech: saved.photoObservations?.[index]?.speech || "", action: saved.photoObservations?.[index]?.action || "", flow: saved.photoObservations?.[index]?.flow || "" })) }) : "");
  const [confirmed, setConfirmed] = useState(saved?.confirmedObservation || "");
  const [selectedAreas, setSelectedAreas] = useState<string[]>(saved?.selectedAreas || []);
  const [selectedCards, setSelectedCards] = useState<string[]>(saved?.selectedCards || (saved?.selectedAreas || []).map(area => `0:${area}`));
  const [interpretation, setInterpretation] = useState(saved?.interpretation || "");
  const [extension, setExtension] = useState(saved?.extension || "");
  const [process, setProcess] = useState(saved?.process || emptyProcess);
  const [draft, setDraft] = useState(saved?.draft || "");
  const [story, setStory] = useState<SteamSaved["story"] | null>(saved?.story || null);
  const [storyCandidate, setStoryCandidate] = useState<SteamSaved["story"] | null>(null);
  const [storyPending, setStoryPending] = useState(false);
  const [analysisPending, setAnalysisPending] = useState(false);
  const [analysisReady, setAnalysisReady] = useState<{ curriculumLinks: { area: string; description: string }[] } | null>(null);
  const [aiAccepted, setAiAccepted] = useState(false), [photoAccepted, setPhotoAccepted] = useState(false);
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [generationId, setGenerationId] = useState(initial?.generationId || "");
  const [createdAt, setCreatedAt] = useState(initial?.createdAt || "");
  const [recovery, setRecovery] = useState<string | null>(null), [ready, setReady] = useState(false);
  const recorder = useRef<ObservationRecorderHandle>(null);
  const revealStory = useRef(false);
  const revealAnalysis = useRef(false);
  const lock = useRef(false), urls = useRef(new Set<string>());
  const draftKey = `record-fairy:steam:v1:${userId}:${initial?.generationId || "new"}`;
  const selectedPhotos = [...photoIds.map(id => ({ key: `saved:${id}`, url: `/api/photos/${id}` })), ...files.map(file => ({ key: file.key, url: file.url }))];
  const photoObservations = selectedPhotos.map((photo, index) => ({ photo: index + 1, speech: photoNotes[photo.key]?.speech || "", action: photoNotes[photo.key]?.action || "", flow: photoNotes[photo.key]?.flow || "" }));
  const sourceObservation = [observation.trim(), ...photoObservations.filter(note => photoObservationText(note)).map(note => `[사진 ${note.photo} · 별개의 놀이]\n${photoObservationText(note)}`)].filter(Boolean).join("\n\n");
  const signature = JSON.stringify({ age, observation: sourceObservation.trim(), photoIds, files: files.map(file => file.key), photoObservations });
  const stale = Boolean(analysis) && analyzedSignature !== signature;
  const storyStale = story && JSON.stringify(story.source) !== JSON.stringify({ age, confirmedObservation: confirmed.trim(), interpretation, process: { interest: process.interest, attempt: process.attempt, change: process.change, repeat: process.repeat, teacher: process.teacher } });
  const payload = JSON.stringify({ step, age, observation, title, photoIds, photoNotes, recordingIds, analysis, analyzedSignature, confirmed, selectedAreas, selectedCards, interpretation, extension, process, draft, story, generationId, createdAt, missingPhotos: files.map(file => file.file.name), run, previousRuns });
  useEffect(() => {
    const allocated = urls.current;
    return () => allocated.forEach(url => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    // Hydrate account-scoped drafts after mounting; offer recovery before writing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const raw = localStorage.getItem(draftKey); const value = raw ? steamDraftSchema.parse(JSON.parse(raw)) : null; if (value && Date.now() >= value.updatedAt && Date.now() - value.updatedAt < 86400000) setRecovery(raw); else { localStorage.removeItem(draftKey); setReady(true); } } catch { setReady(true); }
  }, [draftKey, initial]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => { try { localStorage.setItem(draftKey, JSON.stringify({ ...JSON.parse(payload), updatedAt: Date.now() })); } catch { setNotice("임시 저장 실패 · 화면을 떠나기 전에 글을 복사해 주세요."); } };
    const timer = window.setTimeout(flush, 500);
    window.addEventListener("pagehide", flush);
    return () => { clearTimeout(timer); flush(); window.removeEventListener("pagehide", flush); };
  }, [ready, initial, draftKey, payload]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (files.length || observation || draft) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [files.length, observation, draft]);
  const onActivity = useCallback(() => {}, []);
  useEffect(() => {
    if (analysisPending || !revealAnalysis.current) return;
    revealAnalysis.current = false;
    const target = document.getElementById("steam-analysis-result");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }, [analysisPending]);
  const finishAnalysis = useCallback(() => {
    revealAnalysis.current = true; setAnalysisPending(false); setAnalysisReady(null); setBusy(""); lock.current = false;
  }, []);
  useEffect(() => {
    if (storyPending) { document.getElementById("steam-play-story")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); return; }
    if (!story || !revealStory.current) return;
    revealStory.current = false;
    const result = document.getElementById("steam-play-story");
    result?.focus({ preventScroll: true });
  }, [storyPending, story]);

  function restore() {
    try {
      const value = steamDraftSchema.parse(JSON.parse(recovery!));
      const result = value.analysis ? steamAnalysisSchema.parse(value.analysis) : null;
      setAge(value.age); setObservation(value.observation); setTitle(value.title); setPhotoIds(value.photoIds); setRecordingIds(value.recordingIds); setAnalysis(result); setAnalyzedSignature(value.analyzedSignature);
      setConfirmed(value.confirmed); setSelectedAreas(value.selectedAreas); setInterpretation(value.interpretation); setExtension(value.extension); setProcess(value.process); setDraft(value.draft); setGenerationId(value.generationId); setCreatedAt(value.createdAt); setStep(value.step);
      setRun(value.run || null); setPreviousRuns(value.previousRuns || []);
      setStory(value.story || null);
      setPhotoNotes(value.photoNotes || {});
      setSelectedCards(value.selectedCards || value.selectedAreas.map(area => `0:${area}`));
      setNotice(value.missingPhotos?.length ? `글은 복원했습니다. 새 사진 ${value.missingPhotos.length}장은 다시 첨부한 뒤 분석해 주세요.` : "작성 내용과 수정 내용을 복원했습니다.");
      setRecovery(null); setReady(true);
    } catch (cause) { setError(failure(cause)); }
  }
  async function loadGallery(offset = 0) {
    if (lock.current) return;
    lock.current = true; setBusy("사진 불러오는 중"); setError("");
    try {
      const response = await fetch(`/api/photos?offset=${offset}`, { cache: "no-store" }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setGallery(current => offset ? [...current, ...data.photos] : data.photos); setGalleryOffset(offset + data.photos.length); setHasMore(data.hasMore);
    } catch (cause) { setError(failure(cause)); } finally { lock.current = false; setBusy(""); }
  }
  async function addFiles(list: FileList | null) {
    if (!list || lock.current) return;
    lock.current = true; setBusy("사진 준비 중"); setError("");
    try {
      const incoming = Array.from(list).filter(file => !files.some(item => item.key === `${file.name}:${file.size}:${file.lastModified}`));
      if (incoming.length + files.length + photoIds.length > 5) throw new Error("사진은 기존 사진과 합쳐 최대 5장입니다.");
      const prepared: LocalPhoto[] = [];
      for (const file of incoming) {
        const result = await preparePhoto(file);
        const url = URL.createObjectURL(result.file); urls.current.add(url);
        prepared.push({ key: `${file.name}:${file.size}:${file.lastModified}`, file: result.file, url });
      }
      setFiles(current => [...current, ...prepared]);
    } catch (cause) { setError(failure(cause)); } finally { lock.current = false; setBusy(""); }
  }
  async function analyze() {
    if (lock.current) return;
    lock.current = true; setBusy("STEAM 분석 중"); setAnalysisPending(true); setAnalysisReady(null); setError(""); setNotice(""); setCandidate(null);
    try {
      const form = new FormData(); form.set("input", JSON.stringify({ age, observation: sourceObservation, photoIds, photoObservations }));
      form.set("consent", JSON.stringify({ version: AI_CONSENT_VERSION, aiAccepted, photoAccepted }));
      files.forEach(photo => form.append("images", photo.file));
      const response = await fetch("/api/steam/analyze", { method: "POST", body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = steamAnalysisSchema.parse(data.analysis);
      const nextRun = data.run ? steamRunSchema.parse(data.run) : null;
      if (analysis) { setCandidate({ analysis: next, signature, run: nextRun }); setNotice("새 분석 후보를 받았습니다. 기존 카드·교사 수정 글은 유지됩니다."); }
      else { setAnalysis(next); setRun(nextRun); setAnalyzedSignature(signature); setConfirmed(sourceObservation.trim()); }
      setAnalysisReady({ curriculumLinks: next.cards.map(card => ({ area: card.area, description: card.interpretation })) });
    } catch (cause) { setError(failure(cause)); setAnalysisPending(false); lock.current = false; setBusy(""); }
  }
  function makeDraft() {
    if (draft && !window.confirm("과정 초안을 새로 만들면 현재 초안이 바뀝니다. 계속할까요?")) return;
    setDraft(processDraft({ ...process, attempt: process.attempt || confirmed }, interpretation));
    window.requestAnimationFrame(() => { const result = document.getElementById("steam-process-draft"); result?.focus({ preventScroll: true }); result?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); });
  }
  const finishStory = useCallback(() => {
    revealStory.current = true;
    setStory(storyCandidate); setStoryCandidate(null); setStoryPending(false);
    setBusy(""); lock.current = false;
    setNotice("놀이 이야기를 만들었습니다. 실제 관찰과 비교해 수정하고 확인한 뒤 저장하세요.");
  }, [storyCandidate]);
  async function makeStory() {
    if (lock.current || stale || !analysis || !aiAccepted) return;
    if (story && !window.confirm("놀이 이야기를 다시 만들면 현재 이야기의 수정 글이 바뀝니다. 계속할까요?")) return;
    lock.current = true; setBusy("관찰을 연결해 놀이 이야기 만드는 중"); setStoryPending(true); setStoryCandidate(null); setError("");
    try {
      const input = storySource({ age, confirmedObservation: confirmed, interpretation, process });
      const response = await fetch("/api/steam/story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, consent: { version: AI_CONSENT_VERSION, aiAccepted, photoAccepted } }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = steamStorySchema.parse(data.story);
      if (JSON.stringify(next.source) !== JSON.stringify(input)) throw new Error("이야기의 관찰 연결을 확인하지 못했습니다. 다시 시도해 주세요.");
      setStoryCandidate(next);
    } catch (cause) { setError(failure(cause)); setStoryPending(false); setBusy(""); lock.current = false; }
  }
  async function save() {
    if (lock.current || !analysis || stale || storyStale) return;
    lock.current = true; setBusy("과정 기록 저장 중"); setError("");
    const id = generationId || crypto.randomUUID(), date = createdAt || new Date().toISOString();
    setGenerationId(id); setCreatedAt(date);
    let recordWritten = false;
    try {
      const input = recordInputSchema.parse({ playName: title, ageGroup: age, childAlias: "놀이 관찰", recordType: "놀이 이야기", observation: confirmed, curriculumAreas: [], teacherInterpretation: interpretation, supportPlan: extension });
      const result = generatedSchema.parse({ observation: confirmed, interpretation, connection: extension, integratedRecord: story?.text || draft });
      let ids = [...photoIds];
      const body = () => ({ generationId: id, createdAt: date, kind: "record", input, result, consent: { version: AI_CONSENT_VERSION, aiAccepted, photoAccepted },
        steam: { version: 1, age, sourceObservation: sourceObservation.trim(), commonObservation: observation, photoIds: ids, photoObservations, recordingIds, analysis, confirmedObservation: confirmed, selectedAreas, selectedCards, interpretation, extension, process, draft, story: story || undefined, reviewed: true, analyzedInput: { age, observation: sourceObservation.trim(), photoIds: ids, photoObservations }, run: run || undefined, previousRuns } });
      const write = async () => { const response = await fetch("/api/records/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body()) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); };
      // Use the existing save-before-photo policy and idempotent per-photo upload keys.
      await write();
      recordWritten = true;
      for (const photo of files) {
        const form = new FormData(); form.set("sessionId", id); form.set("slot", String(ids.length)); form.set("photo", photo.file); form.set("photoKey", photo.key);
        const response = await fetch("/api/photos", { method: "POST", body: form }); const data = await response.json();
        if (!response.ok || !data.saved || !data.id) throw new Error(data.error || "기록 글은 저장됐지만 사진 보관을 완료하지 못했습니다. 사진을 유지했으니 저장을 다시 시도해 주세요.");
        ids = [...ids, data.id];
      }
      await write();
      setPhotoNotes(current => ({ ...current, ...Object.fromEntries(ids.map((id, index) => [`saved:${id}`, photoObservations[index] || { speech: "", action: "", flow: "" }])) }));
      setPhotoIds(ids); setFiles([]); setAnalyzedSignature(JSON.stringify({ age, observation: sourceObservation.trim(), photoIds: ids, files: [], photoObservations }));
      setNotice("과정 기록과 사진 연결을 저장했습니다. 내 기록에서 다시 열 수 있습니다.");
      window.history.replaceState(null, "", `/records/steam?session=${id}`);
    } catch (cause) { setError(`${recordWritten ? "기록 글은 저장됐지만 사진 연결 또는 최종 갱신을 완료하지 못했습니다. 사진과 글을 유지했으니 저장을 다시 시도해 주세요. " : ""}${failure(cause)}`); } finally { lock.current = false; setBusy(""); }
  }
  const edit = () => { setNotice(""); };
  const analysisGroups = analysis?.plays ? analysis.plays.map((play, index) => ({ photo: play.photo, cards: play.analysis.cards, offset: analysis.plays!.slice(0, index).reduce((total, item) => total + item.analysis.cards.length, 0) })) : [{ photo: 0, cards: analysis?.cards || [], offset: 0 }];
  function updateCard(index: number, key: "interpretation" | "watch" | "extension", value: string) {
    setAnalysis(current => {
      if (!current) return current;
      const cards = current.cards.map((item, i) => i === index ? { ...item, [key]: value } : item);
      let offset = 0;
      const plays = current.plays?.map(play => { const count = play.analysis.cards.length; const result = { ...play, analysis: { ...play.analysis, cards: cards.slice(offset, offset + count) } }; offset += count; return result; });
      return { ...current, cards, plays };
    });
  }
  function field(label: string, value: string, change: (value: string) => void, maxLength = 4000, rows = 3) {
    return <label className={styles.field}>{label}<textarea aria-label={label} rows={rows} maxLength={maxLength} value={value} onChange={event => { change(event.target.value); edit(); }} /></label>;
  }
  if (!ready) return <section className="panel"><p>이 계정의 임시 작성 내용이 있습니다. 새 사진 파일은 임시 저장에 포함되지 않습니다.</p><button className="button primary" onClick={restore}>작성 내용 복원</button><button className="button secondary" onClick={() => { setRecovery(null); setReady(true); }}>새로 시작</button>{error && <p role="alert">{error}</p>}</section>;
  return <div className={styles.workflow}>
    <nav className={styles.steps} aria-label="STEAM 단계">{steps.map((name, index) => <button key={name} type="button" aria-current={step === index ? "step" : undefined} disabled={Boolean(busy)} onClick={() => setStep(index)}>{index + 1}. {name}</button>)}</nav>
    {busy && !analysisPending && !storyPending && <div className={styles.progress} role="status"><span className={styles.spinner} aria-hidden="true" /><div><strong>{busy}…</strong><p>완료되면 이 화면에서 이어집니다.</p></div></div>}{error && <p className="error" role="alert">{error}</p>}{notice && !analysisPending && !storyPending && <p role="status">{notice}</p>}
    {analysisPending && <RecordAssembly mode="play" task="사진과 관찰에서 STEAM 읽기" fragments={[{ label: "교사가 입력한 관찰", text: observation }, { label: "함께 살펴볼 사진", text: `선택한 놀이 사진 ${photoIds.length + files.length}장` }, { label: "놀이 지원 연령", text: `만 ${age}의 직접 시도와 반복을 살펴봐요.` }]} files={files.map(photo => photo.file)} result={analysisReady} onComplete={finishAnalysis} />}
    {stale && <p className="error" role="alert">사진·연령·관찰 입력이 달라졌습니다. 기존 수정 글은 유지됩니다. 다시 분석하고 새 후보를 반영한 뒤 글을 확인해 주세요.</p>}

    <fieldset disabled={Boolean(busy)} className={styles.controls}>
      <label>연령 <select aria-label="연령" value={age} onChange={event => { setAge(event.target.value as SteamSaved["age"]); edit(); }}>{["0세", "1세", "2세", "3세", "4세", "5세"].map(value => <option key={value} value={value}>만 {value}</option>)}</select></label>
      <section className="panel" id={step === 2 ? "steam-analysis-result" : undefined} tabIndex={step === 2 ? -1 : undefined}><h2>{step + 1}. {steps[step]}</h2>
        {step === 0 && <>
          <p>한 장 또는 여러 장을 선택하세요. 분석은 최대 5장입니다. 새 사진은 저장 확인 후 비공개 보관합니다.</p>
          <label className={styles.field}>새 사진 선택<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { void addFiles(event.target.files); event.target.value = ""; }} /></label>
          <button type="button" className="button secondary" onClick={() => void loadGallery()}>기존 사진 보관함 열기</button>
          <div className={styles.photos}>{gallery.map(photo => <label key={photo.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.original_file_name || "보관 사진"} />
            <input type="checkbox" checked={photoIds.includes(photo.id)} disabled={!photoIds.includes(photo.id) && photoIds.length + files.length >= 5} onChange={event => { setPhotoIds(current => event.target.checked ? [...current, photo.id] : current.filter(id => id !== photo.id)); edit(); }} />{photo.original_file_name}
          </label>)}</div>{hasMore && <button type="button" onClick={() => void loadGallery(galleryOffset)}>사진 더 보기</button>}
        </>}
        {step <= 1 && <><h3>선택 사진 {photoIds.length + files.length}장</h3><div className={styles.photos}>{photoIds.map((id, index) => <figure key={id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${id}`} alt={`선택한 보관 사진 ${index + 1}`} /><figcaption>사진 {index + 1}<button type="button" onClick={() => { setPhotoIds(current => current.filter(value => value !== id)); edit(); }}>선택 해제</button></figcaption>
        </figure>)}{files.map((photo, index) => <figure key={photo.key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={`새 놀이 사진 ${photoIds.length + index + 1}`} /><figcaption>사진 {photoIds.length + index + 1}<button type="button" onClick={() => { setFiles(current => current.filter(value => value.key !== photo.key)); edit(); }}>선택 해제</button></figcaption>
        </figure>)}</div></>}
        {step === 1 && <>
          <p><strong>사진마다 서로 다른 놀이로 기록합니다.</strong> 사진을 하나의 연속된 놀이로 묶지 않습니다. 말·행동·흐름은 해당 사진에서 직접 확인한 것만 적으세요.</p>
          {!selectedPhotos.length && <p>먼저 사진을 선택해 주세요.</p>}
          {selectedPhotos.map((photo, index) => <article className={styles.card} key={photo.key}><h3>사진 {index + 1}의 놀이 · 다른 사진과 별개</h3><ObservationPhoto src={photo.url} alt={`관찰을 작성할 사진 ${index + 1}`} />{([ ["speech", "아이의 말"], ["action", "아이의 행동"], ["flow", "놀이 흐름"] ] as const).map(([key, label]) => <div key={key}>{field(`사진 ${index + 1} · ${label}`, photoNotes[photo.key]?.[key] || "", value => setPhotoNotes(current => ({ ...current, [photo.key]: { speech: current[photo.key]?.speech || "", action: current[photo.key]?.action || "", flow: current[photo.key]?.flow || "", [key]: value } })), 750)}</div>)}<button type="button" className="button secondary" onClick={() => { setRecordingPhoto(photo.key); recorder.current?.open(); }}>사진 {index + 1} 관찰 녹음 · 파일 업로드</button></article>)}
          {field("공통 메모 · 사진별 분석 근거와 별도", observation, setObservation, 3000)}
          <button className="button secondary" type="button" onClick={() => { setRecordingPhoto(null); recorder.current?.open(); }}>관찰 녹음 · 녹음 파일 업로드</button>
          <p>녹음하거나 따로 저장한 음성 파일을 업로드하세요. 전사문을 원본과 비교하고 선택하면 현재 관찰에 추가됩니다. 원본 음성·전사문은 자동 보관되지 않습니다.</p>
        </>}
        {step === 2 && <>
          <label className={styles.check}><input type="checkbox" checked={aiAccepted} onChange={event => setAiAccepted(event.target.checked)} /><span>{AI_CONSENT_TEXT}</span></label>
          <label className={styles.check}><input type="checkbox" checked={photoAccepted} onChange={event => setPhotoAccepted(event.target.checked)} /><span>{PHOTO_CONSENT_TEXT}</span></label>
          <button className="button primary" type="button" disabled={!sourceObservation.trim() || !photoIds.length && !files.length || !aiAccepted || !photoAccepted} onClick={() => void analyze()}>{analysis ? "다시 분석하기" : "사진과 관찰 함께 분석"}</button>
          {(!sourceObservation.trim() || !photoIds.length && !files.length) && <p>사진 1장 이상과 해당 사진에서 직접 관찰한 내용을 입력해 주세요.</p>}
          {candidate && <section className={styles.candidate}><h3>새 분석 후보</h3><p>기존 카드만 교체합니다. 확인 관찰·해석·제안·과정 초안의 교사 수정은 유지됩니다.</p><pre>{candidate.analysis.cards.map(card => `${card.area}: ${card.interpretation}`).join("\n\n") || "관련 영역은 추가 관찰이 필요합니다."}</pre><button type="button" onClick={() => {
            if (run) {
              if (previousRuns.length >= 100) { setError("보관 가능한 분석 이력을 초과했습니다. 현재 기록을 저장한 뒤 새 기록에서 이어가 주세요."); return; }
              const summary = steamRunSchema.omit({ originalAnalysis: true, checks: true }).parse(run);
              setPreviousRuns(current => [...current, summary]);
            }
            setAnalysis(candidate.analysis); setRun(candidate.run); setAnalyzedSignature(candidate.signature); setCandidate(null); edit(); setNotice("새 카드 반영 완료 · 기존 교사 수정 글을 확인해 주세요.");
          }}>새 카드 반영</button><button type="button" onClick={() => setCandidate(null)}>기존 카드 유지</button></section>}
          {run && <details className={styles.card}><summary>분석 근거와 확인 내역 · AI 최초 제안 보기</summary>
            <p>인용 일치는 원문에 있는 문장이라는 뜻입니다. 배움의 해석이 타당한지는 교사가 확인해야 합니다.</p>
            <ul>{run.checks.map((check, index) => <li key={index}><strong>{check.area} · {check.verdict === "passed" ? "원문 인용 일치" : check.verdict === "failed" ? "근거 불일치 · 카드에서 제외" : "교사 확인 필요"}</strong><p>{check.quote}</p><p>{check.reason}</p>{check.startOffset !== null && <small>교사 관찰 원문의 {check.startOffset + 1}~{check.endOffset}번째 문자</small>}</li>)}</ul>
            <h3>현재 분석의 AI 최초 제안</h3><ul>{run.originalAnalysis.cards.map((card, index) => <li key={index}>{card.area}: {card.interpretation}</li>)}</ul><p>이전 분석 실행 {previousRuns.length}회 · 최초 제안은 교사의 카드 수정과 별도로 보관합니다.</p>
          </details>}
          {analysis && <><h3>{analysis.plays ? "사진별로 다른 놀이를 읽었어요" : "이전 분석 · 사진별 구분은 다시 분석해 주세요"}</h3><p><strong>사진 {selectedPhotos.map((_, index) => index + 1).join("·")}은 각각 별개의 놀이입니다.</strong> 사진 사이의 말·행동·놀이 흐름을 서로 섞거나 연속된 과정으로 해석하지 않습니다.</p><h3>확인된 관찰 후보 · 교사 확인 필요</h3><ul>{analysis.photoFacts.map((fact, index) => <li key={index}>사진 {fact.photo}: {fact.fact}</li>)}</ul><p>교사 입력: {sourceObservation}</p>{field("교사가 확인한 관찰 (사진 후보를 확인해 직접 추가하세요)", confirmed, setConfirmed, 15000)}
            {!analysis.cards.length && <p>현재 근거로 읽을 수 있는 STEAM 영역이 없습니다. 추가 관찰이 필요합니다.</p>}
            {analysisGroups.map(group => <section key={group.photo} aria-label={group.photo ? `사진 ${group.photo}의 놀이 분석` : "기존 분석"}><h3>{group.photo ? `사진 ${group.photo}의 놀이 · 다른 사진과 별개` : "이전 방식의 분석 · 다시 분석하면 사진별로 나뉩니다"}</h3>{group.photo > 0 && !stale && selectedPhotos[group.photo - 1] && <ObservationPhoto src={selectedPhotos[group.photo - 1].url} alt={`사진 ${group.photo}의 놀이 분석 미리보기`} />}{!group.cards.length && <p>이 사진은 추가 관찰이 필요합니다. 다른 사진의 근거로 채우지 않습니다.</p>}{group.cards.map((card, localIndex) => { const index = group.offset + localIndex; return <article className={styles.card} key={`${index}:${card.area}`}><h3>{areaNames[card.area]}</h3>{card.area === "T 기술" && <p>어떤 도구를 어떻게 써 보았나요? 예를 들면 숟가락으로 물을 떠 옮기거나 집게로 천을 집어 보는 모습이에요. 아래에는 이 사진에서 확인한 내용만 담습니다.</p>}{card.area === "E 공학" && <p>어떻게 놓거나 이어서 만들어 보았나요? 예를 들면 블록을 이어 길을 만들거나 무너지면 놓는 자리를 바꿔 보는 모습이에요. 아래에는 이 사진에서 확인한 내용만 담습니다.</p>}<p>{card.status}</p><h4>사진·관찰에서 본 모습</h4><ul>{card.evidence.map((evidence, i) => <li key={i}>{evidence.source === "photo" ? `사진 ${evidence.photo}` : "교사 관찰"}: {evidence.quote}</li>)}</ul>
              {([ ["interpretation", "이 행동에서 배울 수 있는 것 · 교사의 해석"], ["watch", "다음에 눈여겨볼 행동"], ["extension", "지금 놀이에서 이어 해볼 지원 · 아직 하지 않은 제안"] ] as const).map(([key, label]) => <div key={key}>{field(label, card[key], value => updateCard(index, key, value))}</div>)}
              <label><input type="checkbox" checked={selectedCards.includes(`${group.photo}:${card.area}`)} onChange={event => { const key = `${group.photo}:${card.area}`; const next = event.target.checked ? [...selectedCards, key] : selectedCards.filter(item => item !== key); setSelectedCards(next); setSelectedAreas([...new Set(next.map(item => item.split(":")[1]))]); edit(); }} />과정 기록의 해석으로 선택</label>
            </article>; })}</section>)}
            <button type="button" onClick={() => { if (interpretation && !window.confirm("선택한 카드의 해석으로 현재 해석 글을 바꿀까요?")) return; setInterpretation(analysisGroups.flatMap(group => group.cards.filter(card => selectedCards.includes(`${group.photo}:${card.area}`)).map(card => `${group.photo ? `사진 ${group.photo}의 놀이 · ` : ""}${areaNames[card.area]}: ${card.interpretation}`)).join("\n\n")); edit(); }}>선택한 해석 가져오기</button>
            {field("기록에 사용할 교사 해석", interpretation, setInterpretation, 3000)}
          </>}
        </>}
        {step === 3 && (analysis ? <>
          <aside className={styles.guide}><strong>이 단계 안내</strong><p>앞서 확인한 관찰을 바탕으로 다음 놀이를 준비해요. 아래 내용은 AI가 제안한 지원 방법이며, 이미 일어난 관찰 사실이 아닙니다. 필요한 제안을 골라 내 지원 계획을 작성해 주세요.</p></aside>
          {analysis.plays?.map(play => <article className={styles.supportCard} key={play.photo}><span className={styles.proposalLabel}>AI의 확장 제안 · 아직 실행하지 않음</span><h3>사진 {play.photo}의 놀이 이어가기</h3><p className={styles.supportHint}>이 사진의 놀이만을 위한 제안입니다.</p><PlaySupport support={play.analysis.support} /><button type="button" onClick={() => { const next = [`사진 ${play.photo}의 놀이 · 아직 실행하지 않은 지원 계획`, ...play.analysis.support.materials, `교사 지원 제안: ${play.analysis.support.teacher}`, ...play.analysis.support.watch.map(value => `관찰 계획: ${value}`), `안전: ${play.analysis.support.safety}`].join("\n"); if (next.length > 2000) { setError("지원 제안이 깁니다. 아래 계획 칸에 필요한 부분만 골라 적어 주세요."); return; } if (extension && !window.confirm("현재 계획을 이 사진의 지원 계획으로 바꿀까요?")) return; setExtension(next); edit(); }}>사진 {play.photo}의 제안을 내 계획으로 가져오기</button></article>)}
          {!analysis.plays && <article className={styles.supportCard}>
          <span className={styles.proposalLabel}>AI의 확장 제안 · 아직 실행하지 않음</span><h3>현재 놀이에서 이어갈 제안</h3><PlaySupport support={analysis.support} />
          <button type="button" onClick={() => { if (extension && !window.confirm("현재 확장 계획을 AI 제안으로 바꿀까요?")) return; setExtension([...analysis.support.materials, `교사 지원 제안: ${analysis.support.teacher}`, ...analysis.support.watch.map(value => `관찰 계획: ${value}`), `안전: ${analysis.support.safety}`].join("\n")); edit(); }}>제안을 내 지원 계획으로 가져오기</button>
          </article>}
          <section className={styles.planEditor}><h3>내 지원 계획 · 교사 작성</h3><p>위 제안 중 필요한 내용을 가져와 아이의 관심에 맞게 수정해 주세요. 이 계획은 확인된 관찰과 별도로 저장됩니다.</p>{field("교사가 조절할 확장 계획 · 관찰 사실과 별도 저장", extension, setExtension, 2000)}</section>
        </> : <p>먼저 사진과 관찰을 분석해 주세요.</p>)}
        {step === 4 && <>
          <label className={styles.field}>기록명<input value={title} maxLength={100} onChange={event => { setTitle(event.target.value); edit(); }} /></label>
          {field("확인된 관찰", confirmed, setConfirmed, 15000)}{field("교사가 선택·수정한 배움의 해석", interpretation, setInterpretation, 3000)}
          <p>입력되지 않은 과정은 채우지 않습니다. 실제 확인한 과정만 보충해 주세요.</p>
          {([ ["interest", "처음 무엇에 관심을 보였나요?"], ["attempt", "어떤 행동을 시도했나요?"], ["change", "시도 중 무엇이 달라졌나요?"], ["repeat", "무엇을 반복하거나 바꾸었나요?"], ["teacher", "교사가 실제로 어떻게 지원했나요?"], ["next", "다음에 더 관찰할 점 (아직 실행하지 않음)"] ] as const).map(([key, label]) => <div key={key}>{field(label, process[key], value => setProcess(current => ({ ...current, [key]: value })))}</div>)}
          <button type="button" className="button secondary" disabled={!confirmed.trim()} onClick={makeDraft}>확인한 과정으로 초안 만들기</button>
          <section id="steam-process-draft" className={styles.recordResult} tabIndex={-1} aria-label="과정 기록 초안 결과"><h3>{draft ? "생성된 과정 기록 초안" : "과정 기록 초안이 표시될 곳"}</h3><p>{draft ? "초안 생성이 완료되었습니다. 아래 결과를 읽고 실제 관찰에 맞게 수정해 주세요." : "위에서 확인한 과정을 입력하고 초안 만들기를 누르면 여기에 결과가 표시됩니다."}</p>{field("과정 중심 관찰기록 초안 · 직접 수정", draft, setDraft, 25000, 10)}</section>
          {(storyPending || story) && <section className={styles.recordResult} id="steam-play-story" tabIndex={-1} aria-label="생성된 놀이 이야기"><h3>{storyPending ? "놀이 이야기를 만들고 있어요" : "생성된 놀이 이야기"}</h3>{storyPending && <RecordAssembly mode="play" scrollOnMount={false} fragments={[{ label: "확인된 관찰", text: confirmed }, { label: "실제로 확인한 과정", text: [process.interest, process.attempt, process.change, process.repeat].filter(Boolean).join("\n") }, { label: "실제 교사 지원", text: process.teacher }, { label: "잠정적 배움의 해석", text: interpretation }]} files={files.map(photo => photo.file)} result={storyCandidate ? { integratedRecord: storyCandidate.text } : null} onComplete={finishStory} />}{!storyPending && story && <>{field("놀이 이야기 · 직접 수정", story.text, text => setStory(current => current ? { ...current, text } : null), 25000, 12)}<p>과정 초안은 그대로 보존됩니다. 저장하면 이 이야기가 내 기록과 문서의 본문으로 연결됩니다.</p>{storyStale && <p role="alert">이야기의 근거 관찰·과정·해석이 바뀌었습니다. 수정 글은 유지됩니다. 다시 생성하거나 이야기를 제외한 뒤 저장하세요.</p>}<button type="button" onClick={() => { if (window.confirm("이야기를 제외하고 과정 초안만 저장할까요?")) { setStory(null); edit(); } }}>이야기 제외하고 과정 초안 유지</button></>}</section>}
          <p>관찰·배움의 해석·확장 계획은 각각 별도 저장됩니다. 초안에도 제안이 실행 사실로 들어가지 않았는지 확인하세요.</p>
          <h3>AI 활용 확인</h3>
          <label className={styles.check}><input type="checkbox" checked={aiAccepted} onChange={event => setAiAccepted(event.target.checked)} /><span>{AI_CONSENT_TEXT}</span></label>
          <label className={styles.check}><input type="checkbox" checked={photoAccepted} onChange={event => setPhotoAccepted(event.target.checked)} /><span>{PHOTO_CONSENT_TEXT}</span></label>
          {(!aiAccepted || !photoAccepted) && <p>위 동의 항목을 확인하면 이 화면에서 바로 놀이 이야기를 만들고 저장할 수 있습니다.</p>}
          <p className={styles.saveConfirmation}>실제 관찰과 결과를 비교해 수정한 뒤 저장해 주세요. ‘확인한 기록 저장’을 누르면 해석과 미실행 제안을 구분하여 확인한 내용으로 저장합니다.</p>
          <button type="button" className="button primary" disabled={!analysis || stale || storyStale || !aiAccepted || !photoAccepted || confirmed.trim().length < 10 || draft.trim().length < 10} onClick={() => void save()}>확인한 기록 저장</button>
          <button type="button" className="button secondary" disabled={!analysis || stale || !aiAccepted || confirmed.trim().length < 10} onClick={() => void makeStory()}>확인된 관찰로 놀이 이야기 만들기</button>
          <Link className="button secondary" href="/records">내 기록 보기</Link>
        </>}
        <div hidden={step !== 5}><PlayReferences observation={confirmed || observation} age={age} /></div>
      </section>
      <div className={styles.navigation}><button type="button" className="button secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>이전 단계</button><span>{step + 1} / 6</span><button type="button" className="button primary" disabled={step === 5} onClick={() => setStep(step + 1)}>다음 단계</button></div>
    </fieldset>
    <ObservationRecorder ref={recorder} userId={userId} onActivity={onActivity} onApply={(text, id) => { if (!recordingIds.includes(id) && recordingIds.length >= 50) throw new Error("연결 녹음은 최대 50개입니다."); if (recordingPhoto) { const note = photoNotes[recordingPhoto] || { speech: "", action: "", flow: "" }; const next = appendObservation(note.flow, text); if (next.length > 750) throw new Error("이 사진의 놀이 흐름은 750자 이내로 정리해 주세요. 전사문을 수정한 뒤 다시 추가할 수 있습니다."); setPhotoNotes(current => ({ ...current, [recordingPhoto]: { ...note, flow: next } })); } else { const next = appendObservation(observation, text); setObservation(next); } setRecordingIds(current => current.includes(id) ? current : [...current, id]); edit(); }} />
    <p className="capture-note">작성 글은 계정별로 이 브라우저에 하루 동안 복원할 수 있습니다. 새 사진 파일은 화면 이동 중 유지되며, 저장 전 새로고침 시 다시 첨부해야 합니다.</p>
  </div>;
}
