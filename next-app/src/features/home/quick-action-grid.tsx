"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileAudio, FilePlus2, FolderOpen, Images, Mic, Plus, Video, Sparkles } from "lucide-react";
import { QuickActionCard } from "./quick-action-card";
import { ObservationRecorder, type ObservationRecorderHandle } from "./observation-recorder";
import { PhotoSelector, type PhotoSelectorHandle } from "./photo-selector";
import { HomeActivitySummary } from "./home-activity-summary";
import { CaptureDialog, type CaptureDialogHandle } from "./capture-dialog";
import { VideoObservation } from "./video-observation";
import { AudioFileAnalysis } from "./audio-file-analysis";
import { readQuickMenu, EMPTY_QUICK_MENU, type QuickMenuId, type QuickMenuSlots } from "./quick-menu";
const actions = [
  { id: "steam", title: "STEAM 적용하기", description: "놀이 사진에서 배움의 가능성을 살펴보고, 다음 놀이와 관찰기록으로 이어가요.", icon: Sparkles },
  { id: "observation", title: "관찰 녹음", description: "지금 관찰한 행동과 말을 바로 녹음해요.", icon: Mic },
  { id: "audio", title: "녹음 파일 분석", description: "저장한 녹음을 전사하고 기록에 연결해요.", icon: FileAudio },
  { id: "video", title: "놀이 영상 분석", description: "영상 속 말과 장면으로 놀이 과정을 살펴봐요.", icon: Video },
  { id: "photos", title: "사진 선별", description: "여러 사진을 비교하고 필요한 사진을 골라요.", icon: Images },
  { id: "new", title: "새 기록 생성", description: "교사의 관찰로 알림장과 놀이 이야기를 만들어요.", icon: FilePlus2 },
  { id: "records", title: "내 기록 보기", description: "저장한 기록을 다시 보고 내려받아요.", icon: FolderOpen },
] as const;
export function QuickActionGrid({ userId = "", initialSlots = EMPTY_QUICK_MENU }: { userId?: string; initialSlots?: QuickMenuSlots }) {
  const recorder = useRef<ObservationRecorderHandle>(null), selector = useRef<PhotoSelectorHandle>(null);
  const picker = useRef<CaptureDialogHandle>(null), audioDialog = useRef<CaptureDialogHandle>(null), videoDialog = useRef<CaptureDialogHandle>(null);
  const [slots, setSlots] = useState(() => readQuickMenu(initialSlots)), [editing, setEditing] = useState(0);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const [observation, setObservation] = useState({ count: 0, dirty: false }), [photos, setPhotos] = useState({ count: 0, selected: 0 });
  const onObservation = useCallback((count: number, dirty: boolean) => setObservation({ count, dirty }), []);
  const onPhotos = useCallback((count: number, selected: number) => setPhotos({ count, selected }), []);
  useEffect(() => {
    if (!observation.dirty && !photos.count) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [observation.dirty, photos.count]);
  function choose(index: number) { setEditing(index); setError(""); picker.current?.open(); }
  async function saveSlot(id: QuickMenuId | null) {
    if (lock.current) return;
    const previous = slots, next = slots.map((value, index) => index === editing ? id : value);
    lock.current = true; setSaving(true); setError(""); setSlots(next);
    try {
      const response = await fetch("/api/account/quick-menu", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots: next }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "퀵메뉴를 저장하지 못했어요.");
      setSlots(readQuickMenu(data.slots)); picker.current?.close();
    } catch (cause) { setSlots(previous); setError(cause instanceof Error ? cause.message : "퀵메뉴를 저장하지 못했어요."); }
    finally { lock.current = false; setSaving(false); }
  }
  function open(id: QuickMenuId) {
    if (id === "observation") recorder.current?.open();
    if (id === "photos") selector.current?.open();
    if (id === "audio") audioDialog.current?.open();
    if (id === "video") videoDialog.current?.open();
  }
  function card(id: QuickMenuId) {
    const action = actions.find(item => item.id === id)!;
    const variant = id === "new" || id === "records" ? "record" as const : "capture" as const;
    return id === "new" || id === "records" || id === "steam"
      ? <QuickActionCard {...action} variant={variant} href={id === "steam" ? "/records/steam" : id === "records" ? "/records" : userId ? "/records/new" : "/records/new?guest=1"} />
      : <QuickActionCard {...action} variant={variant} onClick={() => open(id)} />;
  }
  return <>
    {userId && <p className="quick-menu-note">네 칸에 자주 사용하는 기능을 추가해 보세요. 선택은 회원 계정에 저장돼요.</p>}
    <section className="quick-action-grid" aria-label={userId ? "나의 퀵메뉴" : "바로 시작할 작업"}>
      {userId ? slots.map((id, index) => <div className="quick-menu-slot" key={index}>
        {id ? <>{card(id)}<button className="quick-menu-edit" type="button" disabled={saving} onClick={() => choose(index)} aria-label={`${index + 1}번 퀵메뉴 변경`}>변경</button></>
          : <button className="quick-action-card quick-menu-empty" type="button" disabled={saving} onClick={() => choose(index)} aria-label={`${index + 1}번 퀵메뉴에 기능 추가`}><Plus size={36} aria-hidden="true" /><span>기능 추가</span></button>}
      </div>) : (["observation", "photos", "new"] as const).map(id => <div key={id}>{card(id)}</div>)}
    </section>
    <HomeActivitySummary observations={observation.count} observationDirty={observation.dirty} photos={photos.count} selected={photos.selected} onObservations={() => recorder.current?.open()} onPhotos={() => selector.current?.open(false)} />
    <ObservationRecorder ref={recorder} userId={userId} onActivity={onObservation} />
    <PhotoSelector ref={selector} onActivity={onPhotos} />
    {userId && <>
      <CaptureDialog ref={picker} id="quick-menu-picker-title" title="퀵메뉴 기능 선택">
        <p className="quick-menu-invitation">기록 요정의 다양한 기능들 중 원하는 기능을 추가해서 사용해 보세요!</p>
        <div className="quick-menu-options">{actions.map(action => { const Icon = action.icon;
          const selectedElsewhere = slots.some((id, index) => id === action.id && index !== editing);
          return <button type="button" key={action.id} disabled={saving || selectedElsewhere} onClick={() => void saveSlot(action.id)}><Icon size={24} aria-hidden="true" /><span><strong>{action.title}</strong><small>{action.description}</small>{selectedElsewhere && <small>다른 칸에 추가됨</small>}</span></button>;
        })}</div>
        {slots[editing] && <button className="button secondary" type="button" disabled={saving} onClick={() => void saveSlot(null)}>이 칸 비우기</button>}
        {saving && <p role="status">퀵메뉴를 저장하고 있어요…</p>}{error && <p role="alert" className="error">{error}</p>}
      </CaptureDialog>
      <CaptureDialog ref={audioDialog} id="audio-file-title" title="녹음 파일 분석"><AudioFileAnalysis userId={userId} /></CaptureDialog>
      <CaptureDialog ref={videoDialog} id="video-analysis-title" title="놀이 영상 분석"><VideoObservation userId={userId} /></CaptureDialog>
    </>}
  </>;
}
