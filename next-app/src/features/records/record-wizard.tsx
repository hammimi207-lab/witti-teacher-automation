"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { RecordAssembly } from "./record-assembly";
import { AGES, curriculumAreas, PLAY_DETAIL_GUIDANCE, PLAY_STORY_DETAILS, RECORD_TYPES, TEACHER_SUPPORT_GUIDANCE, TEACHER_SUPPORTS } from "./constants";
import type { GeneratedRecord } from "./schema";
import { PhotoPreview } from "./photo-preview";
import { CheckedTextarea } from "./checked-textarea";
import { TeacherGrowthTable } from "./teacher-growth-table";
import { collectTeacherRevisions } from "./teacher-revisions";
import { SaveRecordControls } from "./save-record-controls";
import { GeneratedRecordEditor } from "./generated-record-editor";
import { ObservationChoiceDialog } from "./observation-choice-dialog";
import { ClassAnnouncements, announcementText, type ClassAnnouncement } from "./class-announcements";
import { NoticeObservations } from "./notice-observations";
import { NoticePreferences } from "./notice-preferences";
import { NoticeGreetings } from "./notice-greetings";
import { missingPlaceholders, seoulToday } from "./notice-workflow";
import { WordDownload } from "./word-download";
import { PlayNameTip } from "./play-name-tip";
import { StoryDocumentPreview, type RecordSnapshot } from "./story-document-preview";
import { AI_CONSENT_TEXT, PHOTO_CONSENT_TEXT, AI_CONSENT_VERSION } from "./ai-consent";
import { emptyWritingForm, nextChild, noticeFromWriting, hasPersonalWriting, combinedObservation, prepareWriting, type WritingForm } from "./writing-workflow";
import { useWritingDraft } from "./use-writing-draft";
import { preparePhoto } from "./document-photos";
import { useRevealedInput } from "./use-revealed-input";
import { SavedSupportPlans } from "./saved-support-plans";
import { ObservationImport } from "./observation-import";
import { appendObservation } from "../home/observation-handoff";

type RecordFormInput = WritingForm;

type MissingField = { id: string; message: string };

const initial = () => ({ ...structuredClone(emptyWritingForm), writingDate: seoulToday() });

export function RecordWizard({ userId, observationToken }: { userId: string; observationToken?: string }) {
  const revealInput = useRevealedInput();
  const [formVersion, setFormVersion] = useState(0);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState<ClassAnnouncement[]>([]);
  const firstDrafts = useRef<Record<string, string>>({});
  const [input, setInput] = useState<RecordFormInput>(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [aiAccepted, setAiAccepted] = useState(false);
  const [photoAccepted, setPhotoAccepted] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [result, setResult] = useState<GeneratedRecord | null>(null);
  const [generationId, setGenerationId] = useState("");
  const [languageSaveTarget, setLanguageSaveTarget] = useState<HTMLDivElement | null>(null);
  const [snapshot, setSnapshot] = useState<RecordSnapshot | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const finishAssembly = useCallback(() => {
    setPending(false);
    window.requestAnimationFrame(() => document.getElementById("daily-record-result")?.focus());
  }, []);
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [copied, setCopied] = useState(false);
  const [showObservationChoice, setShowObservationChoice] = useState(false);
  const [dialogSaveTarget, setDialogSaveTarget] = useState<HTMLDivElement | null>(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const draft = useWritingDraft(userId, { input, result, generationId, selectedAnnouncements, snapshot: snapshot ? { input: snapshot.input, createdAt: snapshot.createdAt } : null });
  const detailed = input.recordType !== "알림장";
  const effectiveObservation = combinedObservation(input);
  const areas = useMemo(() => curriculumAreas(input.ageGroup), [input.ageGroup]);
  const noticeReady = input.recordType !== "알림장" || Boolean(input.parentType && input.teacherStyle);
  const isBasicLife = input.curriculumAreas.includes("기본생활");
  const supportPlanLabel = isBasicLife ? "다음 지원 계획" : "다음 놀이 지원 계획";

  function rememberDraft(field: EventTarget) {
    if (!(field instanceof HTMLTextAreaElement) || !field.value.trim()) return;
    const key = field.id.startsWith("playDetailNote-") ? `play:${input.playSubcategories[Number(field.id.split("-")[1])]}` : field.id.startsWith("teacherSupportNote-") ? `support:${input.teacherSupports[Number(field.id.split("-")[1])]}` : field.id;
    firstDrafts.current[key] ??= field.value;
  }

  function update<K extends keyof RecordFormInput>(key: K, value: RecordFormInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setMissingFields(current => current.filter(field => field.id !== key && !(key === "observation" && field.id.startsWith("playDetailNote-"))));
  }
  function clearResult() {
    setResult(null); setSnapshot(null); setGenerationId(""); setCopied(false); setError(""); setMissingFields([]); setShowObservationChoice(false);
  }
  function applyGreetings() {
    if (!result || !snapshot || savingRecord) return;
    if ([input.openingGreeting, input.closingGreeting].some(text => missingPlaceholders(text).length)) { setError("인사말의 자리표시자를 채워 주세요."); return; }
    let text = result.finalNotice || "";
    const oldOpening = snapshot.input.openingGreeting?.trim();
    const oldClosing = snapshot.input.closingGreeting?.trim();
    if (oldOpening && text.startsWith(oldOpening)) text = text.slice(oldOpening.length).trimStart();
    if (oldClosing && text.endsWith(oldClosing)) text = text.slice(0, -oldClosing.length).trimEnd();
    if ((oldOpening && text.includes(oldOpening)) || (oldClosing && text.includes(oldClosing))) { setError("기존 인사말의 위치가 바뀌었어요. 본문 편집에서 기존 인사를 정리한 뒤 다시 적용해 주세요."); return; }
    const openingGreeting = input.openingKind === "none" ? "" : input.openingGreeting.trim();
    const closingGreeting = input.closingKind === "none" ? "" : input.closingGreeting.trim();
    setResult({ ...result, finalNotice: [openingGreeting, text.trim(), closingGreeting].filter(Boolean).join("\n\n") });
    setSnapshot({ ...snapshot, input: { ...snapshot.input, openingGreeting, closingGreeting, openingKind: input.openingKind, closingKind: input.closingKind } });
    setCopied(false); setError("");
  }
  function startNew() {
    if (pending || savingRecord) return;
    draft.clear();
    setInput(initial()); setSelectedAnnouncements([]); setFiles([]); setPhotoMessage("");
    setPhotoAccepted(false); setAiAccepted(false); firstDrafts.current = {}; setFormVersion(value => value + 1); clearResult();
    window.setTimeout(() => document.getElementById("childAlias")?.focus(), 0);
  }
  function restoreDraft() {
    const saved = draft.candidate;
    if (!saved) return;
    setInput(saved.input); setResult(saved.result); setGenerationId(saved.generationId); setSelectedAnnouncements(saved.selectedAnnouncements);
    setSnapshot(saved.snapshot ? { ...saved.snapshot, files: [] } : null); setFiles([]); setAiAccepted(false); setPhotoAccepted(false);
    setFormVersion(value => value + 1); draft.resolve();
  }
  function toggleArea(area: string) { update("curriculumAreas", input.curriculumAreas.includes(area) ? input.curriculumAreas.filter((item) => item !== area) : [...input.curriculumAreas, area]); }
  function togglePlayDetail(detail: string) {
    const removing = input.playSubcategories.includes(detail);
    update("playSubcategories", removing ? input.playSubcategories.filter(item => item !== detail) : [...input.playSubcategories, detail]);
    revealInput(removing ? null : `playDetailNote-${input.playSubcategories.length}`);
  }
  function toggleTeacherSupport(support: string) {
    const removing = input.teacherSupports.includes(support);
    update("teacherSupports", removing ? input.teacherSupports.filter(item => item !== support) : [...input.teacherSupports, support]);
    revealInput(removing ? null : `teacherSupportNote-${input.teacherSupports.length}`);
  }
  function updateNote(kind: "playSubcategoryNotes" | "teacherSupportNotes", key: string, value: string) { update(kind, { ...input[kind], [key]: value }); setMissingFields([]); }

  function changeRecordType(recordType: RecordFormInput["recordType"]) {
    if (pending || recordType === input.recordType) return;
    setInput(current => recordType === "알림장" && current.recordType
      ? noticeFromWriting(current)
      : ({ ...(current.recordType ? nextChild(current) : current), recordType, childAlias: current.childAlias }));
    setSelectedAnnouncements([]);
    setFiles([]); setPhotoAccepted(false); firstDrafts.current = {};
    setFormVersion(value => value + 1);
    setResult(null);
    setSnapshot(null);
    setGenerationId("");
    setCopied(false);
    setError("");
    setMissingFields([]);
    setShowObservationChoice(false);
  }

  function chooseObservation(keep: boolean) {
    if (!keep) { startNew(); return; }
    setShowObservationChoice(false);
    window.setTimeout(() => document.getElementById(keep ? "type" : "observation")?.focus(), 0);
  }

  function addPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = ""; // 삭제한 사진도 같은 파일 선택으로 다시 추가할 수 있습니다.
    if (!selected.length) return;
    const next = [...files];
    const messages = new Set<string>();
    for (const file of selected) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
        messages.add("사진은 JPG, PNG, WEBP 형식의 10MB 이하 파일만 등록할 수 있습니다.");
        continue;
      }
      if (next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
        messages.add("이미 등록된 사진은 중복 추가하지 않았습니다.");
        continue;
      }
      if (next.length >= 5) {
        messages.add("사진은 최대 5장까지 등록할 수 있습니다. 기존 사진을 삭제한 뒤 추가해 주세요.");
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    setPhotoAccepted(false);
    setPhotoMessage([...messages].join(" "));
  }

  function validateRequiredFields() {
    const missing: MissingField[] = [];
    if (!aiAccepted) missing.push({ id: "aiConsent", message: "AI 활용 안내를 읽고 확인란에 체크해 주세요." });
    if (files.length && !photoAccepted) missing.push({ id: "photoConsent", message: "보호자 동의와 사진 활용 안내를 확인해 주세요." });
    if (input.recordType !== "알림장" && !input.playName.trim()) missing.push({ id:"playName", message:"놀이명 또는 기록명을 입력해 주세요." });
    if (!input.childAlias.trim()) missing.push({ id:"childAlias", message:"아이 별칭을 입력해 주세요." });
    if (!input.ageGroup) missing.push({ id:"age", message:"기록할 영유아의 연령을 선택해 주세요." });
    if (!input.recordType) missing.push({ id:"type", message:"만들고 싶은 기록 유형을 선택해 주세요." });
    if (input.recordType !== "알림장" && !input.curriculumAreas.length) missing.push({ id:"curriculumAreas", message:"교육과정 영역을 한 가지 이상 선택해 주세요." });
    if (input.recordType === "놀이 이야기" && !input.playSubcategories.length) missing.push({ id:"playDetails", message:"놀이 세부 구분을 한 가지 이상 선택해 주세요." });
    if (input.recordType === "놀이 이야기") input.playSubcategories.forEach((detail, index) => { if (!input.playSubcategoryNotes[detail]?.trim() && !input.observation.trim()) missing.push({ id:`playDetailNote-${index}`, message:`‘${detail}’에서 아이가 무엇을 어떻게 했는지 적어 주세요.` }); });
    if (input.recordType === "놀이 이야기" && !input.teacherSupports.length) missing.push({ id:"teacherSupports", message:"교사의 지원을 한 가지 이상 선택해 주세요." });
    if (input.recordType === "놀이 이야기") input.teacherSupports.forEach((support, index) => { if (!input.teacherSupportNotes[support]?.trim()) missing.push({ id:`teacherSupportNote-${index}`, message:`‘${support}’의 구체적인 지원 내용을 입력해 주세요.` }); });
    if (!effectiveObservation.trim()) missing.push({ id: input.recordType === "알림장" ? "dailyObservation" : "observation", message:"아이가 한 행동이나 말을 한 장면만 적어 주세요." });
    else if (effectiveObservation.trim().length < 10) missing.push({ id: input.recordType === "알림장" ? "dailyObservation" : "observation", message:"관찰한 장면을 조금 더 구체적으로 10자 이상 입력해 주세요." });
    if (input.recordType === "알림장") {
      if (selectedAnnouncements.some(item => item.applied === false)) missing.push({ id: "noticeAnnouncements", message: "수정한 공지를 이번 공지에 적용하거나 선택을 해제해 주세요." });
      for (const field of ["classAnnouncement"] as const) if (missingPlaceholders(input[field]).length) missing.push({ id: field, message: "날짜·준비물 등의 자리표시자를 채워 주세요." });
    }
    setMissingFields(missing);
    if (missing.length) window.setTimeout(() => {
      const field = document.getElementById(missing[0].id);
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (!(field instanceof HTMLTextAreaElement)) field?.focus();
    }, 0);
    return missing.length === 0;
  }

  async function copyFinalNotice() {
    if (!result?.finalNotice) return;
    try { await navigator.clipboard.writeText(result.finalNotice); } catch { setError("복사하지 못했어요. 최종 글을 선택해 직접 복사해 주세요."); return; }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!noticeReady) { document.getElementById("noticePreferences")?.focus(); return; }
    if (!validateRequiredFields()) return;
    setPending(true); setError(""); setResult(null); setGenerationId("");
    try {
      const submittedInput = structuredClone(prepareWriting(input));
      if (submittedInput.recordType === "알림장") { submittedInput.openingGreeting = ""; submittedInput.closingGreeting = ""; }
      const submittedFiles = await Promise.all(files.map(async file => (await preparePhoto(file, file.name)).file));
      const consent = { version: AI_CONSENT_VERSION, aiAccepted: true, photoAccepted } as const;
      const teacherRevisions = collectTeacherRevisions(submittedInput, firstDrafts.current);
      const body = new FormData(); body.set("input", JSON.stringify(submittedInput)); submittedFiles.forEach((file) => body.append("images", file));
      body.set("consent", JSON.stringify(consent));
      const response = await fetch("/api/records/generate", { method:"POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "기록을 만들지 못했습니다.");
      setResult(payload.data); setGenerationId(payload.generationId);
      setSnapshot({ teacherRevisions, consent, input: submittedInput, files: submittedFiles, createdAt: new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date()) });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "기록을 만들지 못했습니다."); setPending(false); }
  }

  return (
    <>
      {!userId && <section className="panel" role="status"><h2>비회원으로 기록하고 있어요</h2><p>기록은 작성할 수 있지만, 작성한 내용은 저장되지 않아요. 새로고침하거나 화면을 떠나기 전에 필요한 글을 복사해 주세요.</p></section>}
      {draft.candidate && <section className="panel draft-recovery"><h2>작성하던 기록이 있어요</h2><p>{draft.candidate.input.childAlias || "아이 미입력"} · {new Date(draft.candidate.updatedAt).toLocaleString("ko-KR")}</p><button type="button" className="button primary" onClick={restoreDraft}>이 기록 이어쓰기</button><button type="button" className="button secondary" onClick={() => { startNew(); draft.resolve(); }}>이전 내용 비우고 새로 쓰기</button></section>}
      {draft.ready && <>
      <ObservationImport userId={userId} token={observationToken} disabled={pending || savingRecord} onApply={text => {
        const field = input.recordType === "알림장" ? "playObservation" : "observation";
        const observation = appendObservation(input[field], text);
        clearResult(); setInput(current => ({ ...current, [field]: observation }));
        window.setTimeout(() => document.getElementById("observation")?.focus(), 0);
      }} />
      <div className="writing-toolbar"><button type="button" className="button secondary" disabled={pending || savingRecord} onClick={startNew}>전체 초기화 · 새 기록 작성</button><span role="status">{draft.status}</span></div>
      <form key={formVersion} className="panel" onSubmit={submit} onBlur={event => rememberDraft(event.target)} onKeyUp={event => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) rememberDraft(event.target);
      }} onCompositionEnd={event => {
        if (event.target instanceof HTMLTextAreaElement && event.target.value.includes("\n")) rememberDraft(event.target);
      }}>
        <fieldset className="writing-fields" disabled={pending || savingRecord}><div className="form-grid">
          <div className="field"><label htmlFor="playName">기존 놀이명 또는 기록명</label><input id="playName" value={input.playName} onChange={(e)=>update("playName",e.target.value)} placeholder="예: 블록으로 만든 우리 동네" />{input.recordType === "놀이 이야기" && <small>기록 생성 시 사진과 관찰을 종합해 놀이명 3개와 추천 근거를 알려드립니다. 기존 이름은 보존됩니다.</small>}</div>
          <div className="field"><label htmlFor="childAlias">아이 별칭</label><input id="childAlias" value={input.childAlias} onChange={(e)=>{
 const alias = e.target.value;
 const hasPersonal = hasPersonalWriting(input) || Boolean(files.length || result);
 if (input.childAlias && hasPersonal) {
   if (!window.confirm("아이 별칭을 바꾸면 이전 아이의 관찰·해석·지원·생활 정보와 사진을 비웁니다. 새 아이를 작성할까요?")) return;
   startNew(); setInput({ ...nextChild(input), childAlias: alias }); setSelectedAnnouncements(selectedAnnouncements);
 } else update("childAlias", alias);
}} placeholder="예: 민들레반 A" /></div>
          <div className="field"><label htmlFor="age">연령</label><select id="age" value={input.ageGroup} onChange={(e)=>{ update("ageGroup",e.target.value as RecordFormInput["ageGroup"]); update("curriculumAreas",[]); }}><option value="">연령을 선택해 주세요</option>{AGES.map((age)=><option key={age}>{age}</option>)}</select></div>
          <div className="field"><label htmlFor="type">기록 유형</label><select id="type" value={input.recordType} disabled={pending} onChange={(e)=>changeRecordType(e.target.value as RecordFormInput["recordType"])}><option value="">기록 유형을 선택해 주세요</option>{RECORD_TYPES.map((type)=><option key={type}>{type}</option>)}</select></div>
          {userId && input.recordType === "놀이 이야기" && input.childAlias.trim() && <details className="field full"><summary>지난 지원 계획과 아이의 반응 돌아보기</summary><SavedSupportPlans childAlias={input.childAlias} onObservation={text => { const next = input.observation.trim() ? `${input.observation}\n\n${text}` : text; if (next.length > 15000) { setError("관찰 내용은 15,000자까지 입력할 수 있어요. 내용을 줄인 뒤 덧붙여 주세요."); return; } update("observation", next); }} /></details>}
          {input.recordType === "알림장" && <NoticePreferences parentType={input.parentType} teacherStyle={input.teacherStyle} disabled={pending} onParentChange={value => update("parentType", value)} onStyleChange={value => update("teacherStyle", value)} />}
          {input.recordType === "알림장" && <label className="field full" htmlFor="writingDate">작성일 · 한국 기준<input type="date" id="writingDate" value={input.writingDate || seoulToday()} onChange={event => { if (event.target.value) { update("writingDate", event.target.value); update("commonActivity", ""); } }} /></label>}
          {noticeReady && <>

          {input.recordType !== "알림장" && <div className="field full" id="curriculumAreas" tabIndex={-1}><label>교육과정 영역</label><div className="choice-grid">{areas.map((area)=><label className="choice" key={area}><input type="checkbox" checked={input.curriculumAreas.includes(area)} onChange={()=>toggleArea(area)} /><span>{area}</span></label>)}</div>{!input.ageGroup&&<small>연령을 선택하면 해당 교육과정 영역이 표시됩니다.</small>}</div>}
          {input.recordType === "놀이 이야기" && <div className="field full story-details"><div className="detail-heading"><b>놀이 이야기 세부 구성</b><span>해당하는 과정을 선택하면 단계별 관찰 입력란이 나타납니다.</span></div><div id="playDetails" className="field" tabIndex={-1}><label>놀이 세부 구분 <small>(복수 선택)</small></label><div className="choice-grid">{PLAY_STORY_DETAILS.map((detail)=><label className="choice" key={detail}><input type="checkbox" checked={input.playSubcategories.includes(detail)} onChange={()=>togglePlayDetail(detail)} /><span>{detail}</span></label>)}</div></div>{input.playSubcategories.length > 0 && <div className="detail-note-list"><small>선택한 놀이 과정마다 사진 또는 실제 관찰에 근거한 장면을 입력해 주세요.</small>{input.playSubcategories.map((detail,index)=><div className="detail-note" key={detail}><label htmlFor={`playDetailNote-${index}`}>{detail} <em>필수</em></label><p className="detail-guidance" id={`playDetailGuidance-${index}`}>{PLAY_DETAIL_GUIDANCE[detail]}</p><CheckedTextarea requiredHint={input.observation.trim() ? undefined : `‘${detail}’에서 아이가 무엇을 어떻게 했는지 적어 주세요.`} missingHint={missingFields.find(item => item.id === `playDetailNote-${index}`)?.message} ageGroup={input.ageGroup} context={detail} aria-describedby={`playDetailGuidance-${index}`} id={`playDetailNote-${index}`} value={input.playSubcategoryNotes[detail] || ""} onChange={(e)=>updateNote("playSubcategoryNotes",detail,e.target.value)} placeholder="직접 관찰한 장면을 입력해 주세요." /></div>)}</div>}<div id="teacherSupports" className="field support-choice" tabIndex={-1}><label>교사의 지원 <small>(복수 선택)</small></label><div className="choice-grid">{TEACHER_SUPPORTS.map((support)=><label className="choice" key={support}><input type="checkbox" checked={input.teacherSupports.includes(support)} onChange={()=>toggleTeacherSupport(support)} /><span>{support}</span></label>)}</div></div>{input.teacherSupports.length > 0 && <div className="detail-note-list"><small>이번 장면에서 교사가 실제로 제공한 지원과 그때 아이가 보인 반응을 직접 입력해 주세요.</small>{input.teacherSupports.map((support,index)=><div className="detail-note" key={support}><label htmlFor={`teacherSupportNote-${index}`}>{support} <em>필수</em></label><p className="detail-guidance" id={`teacherSupportGuidance-${index}`}>{TEACHER_SUPPORT_GUIDANCE[support]}</p><CheckedTextarea requiredHint={support === "자료 지원" ? "교사가 제공한 자료와 아이가 사용한 모습을 적어 주세요." : `‘${support}’에서 교사가 실제로 한 도움을 적어 주세요.`} missingHint={missingFields.find(item => item.id === `teacherSupportNote-${index}`)?.message} ageGroup={input.ageGroup} context={support} supportObservation={{ playName: input.playName, observation: effectiveObservation }} aria-describedby={`teacherSupportGuidance-${index}`} id={`teacherSupportNote-${index}`} value={input.teacherSupportNotes[support] || ""} onChange={(e)=>updateNote("teacherSupportNotes",support,e.target.value)} placeholder="교사가 실제로 제공한 지원을 입력해 주세요." /></div>)}</div>}</div>}
          {input.recordType === "알림장" && <>
            <NoticeObservations userId={userId} input={input} onChange={update} disabled={pending} />
            {input.observation && <details className="field full"><summary>이전에 입력·이어받은 관찰 · 생성에 함께 활용</summary><pre>{input.observation}</pre><button type="button" className="button secondary" onClick={() => update("observation", "")}>이어받은 관찰 제외</button></details>}
            <div className="field full" id="noticeAnnouncements"><ClassAnnouncements userId={userId} selected={selectedAnnouncements} disabled={pending} onChange={items => { setSelectedAnnouncements(items); update("classAnnouncement", announcementText(items)); }} /></div>
          </>}
          {input.recordType !== "알림장" && <><div className="field full"><label htmlFor="observation">교사가 관찰한 실제 장면 {effectiveObservation && input.playSubcategories.length > 0 && <small>단계별 관찰을 함께 활용해요 · 추가 입력은 선택</small>}</label><p className="detail-guidance" id="observation-guidance">이전 기록을 재사용하지 않고, 이번에 직접 관찰한 아이의 표정, 행동, 말, 횟수, 시간, 양을 새로 적어 주세요.</p><CheckedTextarea requiredHint={effectiveObservation ? undefined : "아이가 한 행동이나 말을 한 장면만 적어 주세요."} missingHint={missingFields.find(item => item.id === "observation")?.message} ageGroup={input.ageGroup} childAlias={input.childAlias} id="observation" aria-describedby="observation-guidance" value={input.observation} onChange={(e)=>update("observation",e.target.value)} /></div>
            <details className="field full optional-interpretation" open={detailed}><summary onClick={event => { if (!(event.currentTarget.parentElement as HTMLDetailsElement).open) revealInput("teacherInterpretation"); }}>{detailed ? "교사의 해석과 지원" : "해석·지원 더하기 (선택)"}</summary><div className="field full"><label htmlFor="teacherInterpretation">교사의 해석</label><p className="detail-guidance" id="interpretation-guidance">관찰한 행동을 발달, 놀이, 관계 또는 생활습관의 맥락에서 어떻게 이해했는지 적어 주세요.</p><CheckedTextarea requiredHint={undefined} missingHint={missingFields.find(item => item.id === "teacherInterpretation")?.message} ageGroup={input.ageGroup} context="해석" id="teacherInterpretation" aria-describedby="interpretation-guidance" value={input.teacherInterpretation} onChange={(e)=>update("teacherInterpretation",e.target.value)} /></div>
          <div className="field full"><label htmlFor="support">{supportPlanLabel} <small>(선택)</small></label><p className="detail-guidance" id="support-guidance">{isBasicLife ? "다음 일상생활에서 이어갈 지원을 적어 주세요." : "다음 놀이에서 이어갈 환경 구성이나 지원을 적어 주세요."}</p><CheckedTextarea ageGroup={input.ageGroup} context="계획" supportReview={{ ageGroup: input.ageGroup, curriculumAreas: input.curriculumAreas, observation: effectiveObservation, interpretation: input.teacherInterpretation, aiAccepted, onConsent: setAiAccepted, onApply: value => update("supportPlan", value), limit: 2000 }} id="support" aria-describedby="support-guidance" value={input.supportPlan} onChange={(e)=>update("supportPlan",e.target.value)} /></div>
          </details></>}
          <div className="field full upload-box"><label htmlFor="photos"><Upload size={18} /> 사진 등록 <small>(선택, 최대 5장)</small></label><input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={pending} onChange={addPhotos} /><small aria-live="polite">등록된 사진 {files.length}장 · 다시 선택하면 기존 사진 옆에 추가됩니다. 사진은 AI 장면 분석과 Word 문서에 사용하며, 종합 기록을 저장하면 비공개로 보관합니다.</small>{photoMessage && <p className="error" role="status">{photoMessage}</p>}{files.length > 0 && <ul className="photo-preview-list" aria-label="등록된 사진">{files.map((file) => <PhotoPreview key={`${file.name}-${file.size}-${file.lastModified}`} file={file} disabled={pending} onRemove={() => { setFiles((current) => current.filter((item) => item !== file)); setPhotoMessage(""); }} />)}</ul>}</div>
          </>}
        </div>
        {noticeReady && <>
        <fieldset className="ai-consent-panel" disabled={pending}><legend>AI 활용 및 사진 보호 확인</legend>
          <label><input id="aiConsent" type="checkbox" checked={aiAccepted} onChange={event => setAiAccepted(event.target.checked)} />{AI_CONSENT_TEXT}</label>
          {files.length > 0 && <label><input id="photoConsent" type="checkbox" checked={photoAccepted} onChange={event => setPhotoAccepted(event.target.checked)} />{PHOTO_CONSENT_TEXT}</label>}
          <p>{userId ? "사진은 기록 저장을 선택한 경우에만 보관합니다. 저장한 사진은 직접 삭제할 때까지 내 사진에서 관리할 수 있습니다. 사진 삭제와 기록 삭제는 별개이며, 이미 다운로드한 Word 파일은 기기에서 직접 삭제해야 합니다." : "비회원이 첨부한 사진은 기록 생성에만 사용하며 내 사진에 보관하지 않습니다."}</p>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="submit-row"><span>{input.recordType === "알림장" ? "입력된 관찰을 충분히 풀어 써요" : `${input.curriculumAreas.length}개 영역 선택`}</span><button className="button primary" disabled={pending}><Sparkles size={18}/>{pending ? "관찰한 순간들을 모으는 중" : "AI 기록 만들기"}</button></div>
        </>}
        </fieldset>
      </form>
      {pending && <RecordAssembly mode="daily" observation={[effectiveObservation, input.mealObservation, input.toiletingObservation, input.peerInteraction, input.activityLearning].filter(Boolean).join("\n")} files={files} result={result} onComplete={finishAssembly} />}
      {showObservationChoice && <ObservationChoiceDialog saveTargetRef={setDialogSaveTarget} saving={savingRecord} onChoose={chooseObservation} onWriteNotice={snapshot?.input.recordType === "놀이 이야기" ? () => { changeRecordType("알림장"); window.setTimeout(() => { document.getElementById("noticePreferences")?.focus(); }, 0); } : undefined} />}
      {!pending && result && snapshot?.input.recordType === "놀이 이야기" && <PlayNameTip result={result} />}
      {missingFields.some(field => !["observation", "teacherInterpretation", "centerSupport"].includes(field.id) && !field.id.startsWith("playDetailNote-") && !field.id.startsWith("teacherSupportNote-")) && <p className="error" role="alert">{missingFields.filter(field => !["observation", "teacherInterpretation", "centerSupport"].includes(field.id) && !field.id.startsWith("playDetailNote-") && !field.id.startsWith("teacherSupportNote-")).map(field => field.message).join(" ")}</p>}
      {!pending && result && <section id="daily-record-result" tabIndex={-1} className="panel result record-unfold-result" aria-live="polite"><span className="section-kicker">{userId ? "생성 완료 · 검토 후 저장" : "생성 완료 · 비회원 기록은 저장되지 않아요"}</span>{snapshot?.input.recordType !== "알림장" && <TeacherGrowthTable revisions={snapshot?.teacherRevisions} />}{snapshot?.input.recordType !== "알림장" && <div ref={setLanguageSaveTarget} />}<GeneratedRecordEditor guest={!userId} key={generationId} result={result} onChange={(updated) => { setResult(updated); setCopied(false); }} disabled={savingRecord} isNotice={snapshot?.input.recordType === "알림장"} onCopy={copyFinalNotice} copied={copied} />{snapshot?.input.recordType === "알림장" && <NoticeGreetings input={{ ...input, writingDate: snapshot.input.writingDate }} onChange={(field, value) => update(field, value as RecordFormInput[typeof field])} onApply={applyGreetings} disabled={savingRecord} />}{snapshot?.input.recordType === "알림장" && userId && snapshot && <WordDownload title={snapshot.input.playName} result={result} input={snapshot.input} createdAt={snapshot.createdAt} files={snapshot.files} sessionId={snapshot.photoSessionId} />}{snapshot?.input.recordType === "알림장" && <details className="record-result-disclosure"><summary>관찰 언어 자료 보관</summary><div ref={setLanguageSaveTarget} /></details>}{snapshot?.input.recordType === "놀이 이야기" ? <StoryDocumentPreview result={result} snapshot={snapshot} allowDownload={Boolean(userId)} /> : snapshot?.input.recordType !== "알림장" && result.integratedRecord && <><h2>종합 기록</h2><pre>{result.integratedRecord}</pre></>}{snapshot?.input.recordType === "일지" && result.observationEvaluation && <><h2>관찰 및 평가</h2><pre>{result.observationEvaluation}</pre></>}</section>}
      {!pending && userId && result && snapshot && generationId && <SaveRecordControls onNeedsAction={(id, message) => { setShowObservationChoice(false); setMissingFields([{ id, message }]); window.setTimeout(() => { const field = document.getElementById(id); field?.scrollIntoView({ behavior: "smooth", block: "center" }); field?.focus({ preventScroll: true }); }, 0); }} onPhotosSaved={() => setSnapshot(current => current ? { ...current, photoSessionId: generationId } : current)} dialogTarget={dialogSaveTarget} onBusyChange={setSavingRecord} languageTarget={languageSaveTarget} key={generationId} generationId={generationId} result={result} snapshot={{ ...snapshot, consent: snapshot.consent || (aiAccepted ? { version: AI_CONSENT_VERSION, aiAccepted: true, photoAccepted } : undefined) }} onRecordDecision={() => setShowObservationChoice(true)} />}
      </>}
    </>
  );
}
