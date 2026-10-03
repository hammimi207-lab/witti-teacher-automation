"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ImageOff, Layers } from "lucide-react";
import type { LocalPhoto } from "./photo-analysis";

type Props = { photos: LocalPhoto[]; limitReached: boolean; onToggle: (id: string, checked: boolean) => void; onRemove: (id: string) => void; onDownload: (photo: LocalPhoto) => void };
const PAGE_SIZE = 60;

export function PhotoGallery({ photos, limitReached, onToggle, onRemove, onDownload }: Props) {
  const [view, setView] = useState<"groups" | "all" | "selected">("groups");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const groups = useMemo(() => {
    const map = new Map<string, LocalPhoto[]>();
    photos.forEach(photo => { if (photo.status === "ready" && photo.group) { const group = map.get(photo.group) || []; group.push(photo); map.set(photo.group, group); } });
    return Array.from(map.entries());
  }, [photos]);
  const stacks = groups.filter(([, members]) => members.length > 1);
  const singles = new Set(groups.filter(([, members]) => members.length === 1).map(([id]) => id));
  const inGroup = activeGroup ? photos.filter(photo => photo.group === activeGroup) : [];
  const items = activeGroup ? inGroup : view === "selected" ? photos.filter(photo => photo.selected) : view === "all" ? photos : photos.filter(photo => photo.status === "error" || (photo.group && singles.has(photo.group)));

  function switchView(next: typeof view) { setView(next); setActiveGroup(null); setVisibleCount(PAGE_SIZE); }

  function tile(photo: LocalPhoto) {
    return <article key={photo.id} className={`library-photo ${photo.selected ? "is-selected" : ""}`}>
      <label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo.url ? <img src={photo.url} alt="" loading="lazy" decoding="async" /> : <div className="photo-unavailable"><ImageOff size={28} aria-hidden="true" /><span>{photo.status === "loading" ? "준비 중" : "미리보기 불가"}</span></div>}
        <span className="library-photo-check"><input type="checkbox" aria-label={photo.file.name} checked={photo.selected} disabled={photo.status !== "ready" || (!photo.selected && limitReached)} aria-describedby="photo-selection-limit-hint" onChange={event => onToggle(photo.id, event.target.checked)} /><Check size={14} aria-hidden="true" /></span>
        <span className="library-photo-name" title={photo.file.name}>{photo.file.name}</span>
      </label>
      {photo.error && <p className="error">{photo.error}</p>}
      <div className="selection-photo-actions">{photo.selected && <button type="button" onClick={() => onDownload(photo)}>내려받기</button>}<button type="button" aria-label={`${photo.file.name} 목록에서 제거`} onClick={() => onRemove(photo.id)}>제거</button></div>
    </article>;
  }

  return <section className="photo-library" aria-label="사진 선별 결과">
    <div className="photo-library-views" role="group" aria-label="사진 보기 방식">
      <button type="button" aria-pressed={view === "groups"} onClick={() => switchView("groups")}><Layers size={16} aria-hidden="true" />비슷한 사진</button>
      <button type="button" aria-pressed={view === "all"} onClick={() => switchView("all")}>전체 사진</button>
      <button type="button" aria-pressed={view === "selected"} onClick={() => switchView("selected")}>선택한 사진</button>
    </div>
    {activeGroup ? <div className="photo-library-heading"><button type="button" className="photo-group-back" onClick={() => { setActiveGroup(null); setVisibleCount(PAGE_SIZE); }}><ChevronLeft size={18} />묶음으로 돌아가기</button><h3>비슷한 장면 {inGroup.length}장</h3></div> : view === "groups" && <>
      <div className="photo-library-heading"><h3>비슷한 장면끼리 모았어요</h3><span>{stacks.length}개 묶음</span></div>
      <p className="capture-note">화면의 세부 형태와 구도가 가까운 사진만 모았어요. 파일명에서 촬영 날짜를 확인할 수 있으면 같은 날짜끼리 비교해요. 얼굴이나 놀이 종류를 판별하는 기능은 아니므로 마지막으로 직접 확인해 주세요.</p>
      <div className="photo-stack-grid">{stacks.slice(0, visibleCount).map(([id, members], index) => <button key={id} type="button" className="photo-stack" onClick={() => { setActiveGroup(id); setVisibleCount(PAGE_SIZE); }} aria-label={`비슷한 장면 ${index + 1} · ${members.length}장 열기`}>
        <span className="photo-stack-images">{members.slice(0, 3).reverse().map(photo =>
          // eslint-disable-next-line @next/next/no-img-element
          <img key={photo.id} src={photo.url} alt="" loading="lazy" decoding="async" />
        )}<span className="photo-stack-count"><Layers size={14} />{members.length}장</span></span>
        <strong>비슷한 장면 {index + 1}</strong><small>{members.filter(photo => photo.selected).length}장 선택</small>
      </button>)}</div>
      {items.length > 0 && <h3 className="photo-other-heading">{stacks.length ? "다른 장면과 확인할 사진" : "사진 둘러보기"}</h3>}
    </>}
    <div className="photo-library-grid">{items.slice(0, visibleCount).map(tile)}</div>
    {view === "selected" && !items.length && <p className="capture-note">아직 선택한 사진이 없어요.</p>}
    {(items.length > visibleCount || (!activeGroup && view === "groups" && stacks.length > visibleCount)) && <button type="button" className="button secondary photo-load-more" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>더 보기</button>}
  </section>;
}
