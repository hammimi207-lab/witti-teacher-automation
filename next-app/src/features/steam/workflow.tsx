"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ObservationRecorder, type ObservationRecorderHandle } from "../home/observation-recorder";
import { appendObservation, openObservationRecord } from "../home/observation-handoff";
import { preparePhoto, type SavedPhoto } from "../records/document-photos";
import { AI_CONSENT_TEXT, PHOTO_CONSENT_TEXT, AI_CONSENT_VERSION } from "../records/ai-consent";
import { recordInputSchema } from "../records/schema";
import { generatedSchema } from "../records/result-schema";
import type { SavedEnvelope } from "../records/save-contract";
import { steamAnalysisSchema, steamDraftSchema, steamRunSchema, processDraft, type SteamAnalysis, type SteamSaved, type SteamRun } from "../records/steam-schema";
import styles from "./workflow.module.css";

const steps = ["사진 올리기", "관찰 더하기", "STEAM 읽기", "놀이 이어가기", "과정 기록하기", "근거 더 보기"];
const emptyProcess = { interest: "", attempt: "", change: "", repeat: "", teacher: "", next: "" };
type LocalPhoto = { key: string; file: File; url: string };
const failure = (cause: unknown) => cause instanceof Error ? cause.message : "연결하지 못했습니다. 다시 시도해 주세요.";

export function SteamWorkflow({ userId, initial }: { userId: string; initial: SavedEnvelope | null }) {
  const saved = initial?.steam;
  const [step, setStep] = useState(saved ? 4 : 0);
  const [age, setAge] = useState<SteamSaved["age"]>(saved?.age || "2세");
  const [observation, setObservation] = useState(saved?.sourceObservation || "");
  const [title, setTitle] = useState(initial?.input.playName || "STEAM 놀이 과정");
  const [alias, setAlias] = useState(initial?.input.childAlias || "");
  const [gallery, setGallery] = useState<SavedPhoto[]>([]);
  const [galleryOffset, setGalleryOffset] = useState(0), [hasMore, setHasMore] = useState(false);
  const [photoIds, setPhotoIds] = useState(saved?.photoIds || []);
  const [files, setFiles] = useState<LocalPhoto[]>([]);
  const [recordingIds, setRecordingIds] = useState(saved?.recordingIds || []);
  const [analysis, setAnalysis] = useState<SteamAnalysis | null>(saved?.analysis || null);
  const [run, setRun] = useState<SteamRun | null>(saved?.run || null);
  const [previousRuns, setPreviousRuns] = useState<NonNullable<SteamSaved["previousRuns"]>>(saved?.previousRuns || []);
  const [candidate, setCandidate] = useState<{ analysis: SteamAnalysis; signature: string; run: SteamRun | null } | null>(null);
  const [analyzedSignature, setAnalyzedSignature] = useState(saved ? JSON.stringify({ age: saved.age, observation: saved.sourceObservation.trim(), photoIds: saved.photoIds, files: [] }) : "");
  const [confirmed, setConfirmed] = useState(saved?.confirmedObservation || "");
  const [selectedAreas, setSelectedAreas] = useState<string[]>(saved?.selectedAreas || []);
  const [interpretation, setInterpretation] = useState(saved?.interpretation || "");
  const [extension, setExtension] = useState(saved?.extension || "");
  const [process, setProcess] = useState(saved?.process || emptyProcess);
  const [draft, setDraft] = useState(saved?.draft || "");
  const [reviewed, setReviewed] = useState(false);
  const [aiAccepted, setAiAccepted] = useState(false), [photoAccepted, setPhotoAccepted] = useState(false);
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [generationId, setGenerationId] = useState(initial?.generationId || "");
  const [createdAt, setCreatedAt] = useState(initial?.createdAt || "");
  const [recovery, setRecovery] = useState<string | null>(null), [ready, setReady] = useState(false);
  const recorder = useRef<ObservationRecorderHandle>(null);
  const lock = useRef(false), urls = useRef(new Set<string>());
  const draftKey = `record-fairy:steam:v1:${userId}:${initial?.generationId || "new"}`;
  const signature = JSON.stringify({ age, observation: observation.trim(), photoIds, files: files.map(file => file.key) });
  const stale = Boolean(analysis) && analyzedSignature !== signature;
  const payload = JSON.stringify({ step, age, observation, title, alias, photoIds, recordingIds, analysis, analyzedSignature, confirmed, selectedAreas, interpretation, extension, process, draft, generationId, createdAt, missingPhotos: files.map(file => file.file.name), run, previousRuns });
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

  function restore() {
    try {
      const value = steamDraftSchema.parse(JSON.parse(recovery!));
      const result = value.analysis ? steamAnalysisSchema.parse(value.analysis) : null;
      setAge(value.age); setObservation(value.observation); setTitle(value.title); setAlias(value.alias); setPhotoIds(value.photoIds); setRecordingIds(value.recordingIds); setAnalysis(result); setAnalyzedSignature(value.analyzedSignature);
      setConfirmed(value.confirmed); setSelectedAreas(value.selectedAreas); setInterpretation(value.interpretation); setExtension(value.extension); setProcess(value.process); setDraft(value.draft); setGenerationId(value.generationId); setCreatedAt(value.createdAt); setStep(value.step);
      setRun(value.run || null); setPreviousRuns(value.previousRuns || []);
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
      setFiles(current => [...current, ...prepared]); setReviewed(false);
    } catch (cause) { setError(failure(cause)); } finally { lock.current = false; setBusy(""); }
  }
  async function analyze() {
    if (lock.current) return;
    lock.current = true; setBusy("STEAM 분석 중"); setError(""); setCandidate(null);
    try {
      const form = new FormData(); form.set("input", JSON.stringify({ age, observation, photoIds }));
      form.set("consent", JSON.stringify({ version: AI_CONSENT_VERSION, aiAccepted, photoAccepted }));
      files.forEach(photo => form.append("images", photo.file));
      const response = await fetch("/api/steam/analyze", { method: "POST", body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = steamAnalysisSchema.parse(data.analysis);
      const nextRun = data.run ? steamRunSchema.parse(data.run) : null;
      if (analysis) { setCandidate({ analysis: next, signature, run: nextRun }); setNotice("새 분석 후보를 받았습니다. 기존 카드·교사 수정 글은 유지됩니다."); }
      else { setAnalysis(next); setRun(nextRun); setAnalyzedSignature(signature); setConfirmed(observation.trim()); }
      setReviewed(false);
    } catch (cause) { setError(failure(cause)); } finally { lock.current = false; setBusy(""); }
  }
  function makeDraft() {
    if (draft && !window.confirm("과정 초안을 새로 만들면 현재 초안이 바뀝니다. 계속할까요?")) return;
    setDraft(processDraft({ ...process, attempt: process.attempt || confirmed }, interpretation)); setReviewed(false);
  }
  async function save() {
    if (lock.current || !analysis || stale || !reviewed) return;
    lock.current = true; setBusy("과정 기록 저장 중"); setError("");
    const id = generationId || crypto.randomUUID(), date = createdAt || new Date().toISOString();
    setGenerationId(id); setCreatedAt(date);
    let recordWritten = false;
    try {
      const input = recordInputSchema.parse({ playName: title, ageGroup: age, childAlias: alias, recordType: "놀이 이야기", observation: confirmed, curriculumAreas: [], teacherInterpretation: interpretation, supportPlan: extension });
      const result = generatedSchema.parse({ observation: confirmed, interpretation, connection: extension, integratedRecord: draft });
      let ids = [...photoIds];
      const body = () => ({ generationId: id, createdAt: date, kind: "record", input, result, consent: { version: AI_CONSENT_VERSION, aiAccepted, photoAccepted },
        steam: { version: 1, age, sourceObservation: observation.trim(), photoIds: ids, recordingIds, analysis, confirmedObservation: confirmed, selectedAreas, interpretation, extension, process, draft, reviewed: true, analyzedInput: { age, observation: observation.trim(), photoIds: ids }, run: run || undefined, previousRuns } });
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
      setPhotoIds(ids); setFiles([]); setAnalyzedSignature(JSON.stringify({ age, observation: observation.trim(), photoIds: ids, files: [] }));
      setNotice("과정 기록과 사진 연결을 저장했습니다. 내 기록에서 다시 열 수 있습니다.");
      window.history.replaceState(null, "", `/records/steam?session=${id}`);
    } catch (cause) { setError(`${recordWritten ? "기록 글은 저장됐지만 사진 연결 또는 최종 갱신을 완료하지 못했습니다. 사진과 글을 유지했으니 저장을 다시 시도해 주세요. " : ""}${failure(cause)}`); } finally { lock.current = false; setBusy(""); }
  }
  const edit = () => { setReviewed(false); setNotice(""); };
  function field(label: string, value: string, change: (value: string) => void, maxLength = 4000) {
    return <label className={styles.field}>{label}<textarea aria-label={label} rows={3} maxLength={maxLength} value={value} onChange={event => { change(event.target.value); edit(); }} /></label>;
  }
  if (!ready) return <section className="panel"><p>이 계정의 임시 작성 내용이 있습니다. 새 사진 파일은 임시 저장에 포함되지 않습니다.</p><button className="button primary" onClick={restore}>작성 내용 복원</button><button className="button secondary" onClick={() => { setRecovery(null); setReady(true); }}>새로 시작</button>{error && <p role="alert">{error}</p>}</section>;
  return <div className={styles.workflow}>
    <nav className={styles.steps} aria-label="STEAM 단계">{steps.map((name, index) => <button key={name} type="button" aria-current={step === index ? "step" : undefined} disabled={Boolean(busy)} onClick={() => setStep(index)}>{index + 1}. {name}</button>)}</nav>
    {busy && <p role="status">{busy}…</p>}{error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {stale && <p className="error" role="alert">사진·연령·관찰 입력이 달라졌습니다. 기존 수정 글은 유지됩니다. 다시 분석하고 새 후보를 반영한 뒤 글을 확인해 주세요.</p>}
    <fieldset disabled={Boolean(busy)} className={styles.controls}>
      <label>연령 <select aria-label="연령" value={age} onChange={event => { setAge(event.target.value as SteamSaved["age"]); edit(); }}>{["0세", "1세", "2세", "3세", "4세", "5세"].map(value => <option key={value} value={value}>만 {value}</option>)}</select></label>
      <section className="panel"><h2>{step + 1}. {steps[step]}</h2>
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
          {field("아이의 말·행동·놀이 흐름 (직접 확인한 내용)", observation, setObservation, 15000)}
          <button className="button secondary" type="button" onClick={() => recorder.current?.open()}>관찰 녹음 · 기존 녹음 불러오기</button>
          <p>전사문을 원본과 비교하고 선택하면 현재 관찰에 추가됩니다. 사진과 관찰은 이후 단계에서도 유지됩니다.</p>
        </>}
        {step === 2 && <>
          <label className={styles.check}><input type="checkbox" checked={aiAccepted} onChange={event => setAiAccepted(event.target.checked)} />{AI_CONSENT_TEXT}</label>
          <label className={styles.check}><input type="checkbox" checked={photoAccepted} onChange={event => setPhotoAccepted(event.target.checked)} />{PHOTO_CONSENT_TEXT}</label>
          <button className="button primary" type="button" disabled={!observation.trim() || !photoIds.length && !files.length || !aiAccepted || !photoAccepted} onClick={() => void analyze()}>{analysis ? "다시 분석하기" : "사진과 관찰 함께 분석"}</button>
          {(!observation.trim() || !photoIds.length && !files.length) && <p>사진 1장 이상과 직접 관찰한 내용을 입력해 주세요.</p>}
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
          {analysis && <><h3>확인된 관찰 후보 · 교사 확인 필요</h3><ul>{analysis.photoFacts.map((fact, index) => <li key={index}>사진 {fact.photo}: {fact.fact}</li>)}</ul><p>교사 입력: {observation}</p>{field("교사가 확인한 관찰 (사진 후보를 확인해 직접 추가하세요)", confirmed, setConfirmed, 15000)}
            {!analysis.cards.length && <p>현재 근거로 읽을 수 있는 STEAM 영역이 없습니다. 추가 관찰이 필요합니다.</p>}
            {analysis.cards.map((card, index) => <article className={styles.card} key={`${index}:${card.area}`}><h3>{card.area}</h3><p>{card.status}</p><h4>구체적 근거</h4><ul>{card.evidence.map((evidence, i) => <li key={i}>{evidence.source === "photo" ? `사진 ${evidence.photo}` : "교사 관찰"}: {evidence.quote}</li>)}</ul>
              {([ ["interpretation", "배움의 해석 · 잠정적 가능성"], ["watch", "추가 관찰하면 좋은 행동"], ["extension", "확장 제안 · 아직 실행하지 않음"] ] as const).map(([key, label]) => <div key={key}>{field(label, card[key], value => setAnalysis(current => current && ({ ...current, cards: current.cards.map((item, i) => i === index ? { ...item, [key]: value } : item) })))}</div>)}
              <label><input type="checkbox" checked={selectedAreas.includes(card.area)} onChange={event => { setSelectedAreas(current => event.target.checked ? [...current, card.area] : current.filter(area => area !== card.area)); edit(); }} />과정 기록의 해석으로 선택</label>
            </article>)}
            <button type="button" onClick={() => { if (interpretation && !window.confirm("선택한 카드의 해석으로 현재 해석 글을 바꿀까요?")) return; setInterpretation(analysis.cards.filter(card => selectedAreas.includes(card.area)).map(card => `${card.area}: ${card.interpretation}`).join("\n\n")); edit(); }}>선택한 해석 가져오기</button>
            {field("기록에 사용할 교사 해석", interpretation, setInterpretation, 3000)}
          </>}
        </>}
        {step === 3 && (analysis ? <>
          <h3>현재 놀이에서 이어갈 제안 · 아직 실행하지 않음</h3><ul>{analysis.support.materials.map((item, index) => <li key={index}>{item}</li>)}</ul><p>교사 말·지원: {analysis.support.teacher}</p><h3>관찰 포인트</h3><ul>{analysis.support.watch.map((item, index) => <li key={index}>{item}</li>)}</ul><p>안전 고려: {analysis.support.safety}</p>
          <button type="button" onClick={() => { if (extension && !window.confirm("현재 확장 계획을 AI 제안으로 바꿀까요?")) return; setExtension([...analysis.support.materials, `교사 지원 제안: ${analysis.support.teacher}`, ...analysis.support.watch.map(value => `관찰 계획: ${value}`), `안전: ${analysis.support.safety}`].join("\n")); edit(); }}>제안을 내 지원 계획으로 가져오기</button>
          {field("교사가 조절할 확장 계획 · 관찰 사실과 별도 저장", extension, setExtension, 2000)}
        </> : <p>먼저 사진과 관찰을 분석해 주세요.</p>)}
        {step === 4 && <>
          <label className={styles.field}>기록명<input value={title} maxLength={100} onChange={event => { setTitle(event.target.value); edit(); }} /></label><label className={styles.field}>아이 별칭<input value={alias} maxLength={50} onChange={event => { setAlias(event.target.value); edit(); }} /></label>
          {field("확인된 관찰", confirmed, setConfirmed, 15000)}{field("교사가 선택·수정한 배움의 해석", interpretation, setInterpretation, 3000)}
          <p>입력되지 않은 과정은 채우지 않습니다. 실제 확인한 과정만 보충해 주세요.</p>
          {([ ["interest", "처음 무엇에 관심을 보였나요?"], ["attempt", "어떤 행동을 시도했나요?"], ["change", "시도 중 무엇이 달라졌나요?"], ["repeat", "무엇을 반복하거나 바꾸었나요?"], ["teacher", "교사가 실제로 어떻게 지원했나요?"], ["next", "다음에 더 관찰할 점 (아직 실행하지 않음)"] ] as const).map(([key, label]) => <div key={key}>{field(label, process[key], value => setProcess(current => ({ ...current, [key]: value })))}</div>)}
          <button type="button" className="button secondary" disabled={!confirmed.trim()} onClick={makeDraft}>확인한 과정으로 초안 만들기</button>
          {field("과정 중심 관찰기록 초안 · 직접 수정", draft, setDraft, 25000)}
          <p>관찰·배움의 해석·확장 계획은 각각 별도 저장됩니다. 초안에도 제안이 실행 사실로 들어가지 않았는지 확인하세요.</p>
          <label className={styles.check}><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />초안을 실제 관찰과 비교하여 수정했고, 해석과 미실행 제안을 확인했습니다.</label>
          {(!aiAccepted || !photoAccepted) && <p>STEAM 읽기 단계에서 AI·사진 활용 동의를 확인해 주세요.</p>}
          <button type="button" className="button primary" disabled={!analysis || stale || !reviewed || !aiAccepted || !photoAccepted || confirmed.trim().length < 10 || draft.trim().length < 10 || !alias.trim()} onClick={() => void save()}>확인한 기록 저장</button>
          <button type="button" className="button secondary" disabled={confirmed.trim().length < 10 || !reviewed} onClick={() => { try { openObservationRecord(userId, confirmed); } catch (cause) { setError(failure(cause)); } }}>확인된 관찰로 놀이 이야기 만들기</button>
          <Link className="button secondary" href="/records">내 기록 보기</Link>
        </>}
        {step === 5 && <><p role="status">연구 자료 검색은 현재 이용할 수 없습니다.</p><p>학술 검색 및 원문·초록 확인 연동이 필요합니다. 확인하지 않은 논문·DOI·링크는 표시하지 않습니다. 사진 분석과 과정 기록은 계속 사용할 수 있습니다.</p><p>연동 시 제목·저자/기관·연도·대상 연령·핵심 결과·한계·현재 놀이와 연결점·만 2세 직접 근거 여부·초록/원문 확인 범위·원문 링크를 구분해 제공합니다.</p></>}
      </section>
      <div className={styles.navigation}><button type="button" className="button secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>이전 단계</button><span>{step + 1} / 6</span><button type="button" className="button primary" disabled={step === 5} onClick={() => setStep(step + 1)}>다음 단계</button></div>
    </fieldset>
    <ObservationRecorder ref={recorder} userId={userId} onActivity={onActivity} onApply={(text, id) => { if (!recordingIds.includes(id) && recordingIds.length >= 50) throw new Error("연결 녹음은 최대 50개입니다."); const next = appendObservation(observation, text); setObservation(next); setRecordingIds(current => current.includes(id) ? current : [...current, id]); edit(); }} />
    <p className="capture-note">작성 글은 계정별로 이 브라우저에 하루 동안 복원할 수 있습니다. 새 사진 파일은 화면 이동 중 유지되며, 저장 전 새로고침 시 다시 첨부해야 합니다.</p>
  </div>;
}
