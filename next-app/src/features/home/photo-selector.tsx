"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ImagePlus, Pause, Play } from "lucide-react";
import { CaptureDialog, type CaptureDialogHandle } from "./capture-dialog";
import { closestVisualGroup, preparePhoto, type LocalPhoto, type VisualSignature } from "./photo-analysis";
import { PhotoGallery } from "./photo-gallery";

export type PhotoSelectorHandle = { open: (pick?: boolean) => void };
const fileKey = (file: File) => `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

export const PhotoSelector = forwardRef<PhotoSelectorHandle, { onActivity: (count: number, selected: number) => void }>(function PhotoSelector({ onActivity }, ref) {
  const dialog = useRef<CaptureDialogHandle>(null);
  const input = useRef<HTMLInputElement>(null);
  const records = useRef(new Map<string, LocalPhoto>());
  const keys = useRef(new Set<string>());
  const representatives = useRef(new Map<string, VisualSignature[]>());
  const signatures = useRef(new Map<string, VisualSignature>());
  const queue = useRef<string[]>([]);
  const urls = useRef(new Set<string>());
  const alive = useRef(true);
  const processing = useRef(false);
  const pausedRef = useRef(false);
  const generation = useRef(0);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectionLimit, setSelectionLimit] = useState(0);
  const [paused, setPaused] = useState(false);
  const pending = photos.filter(photo => photo.status === "loading").length;
  const selected = photos.filter(photo => photo.selected).length;
  const ready = photos.filter(photo => photo.status === "ready").length;
  const failed = photos.filter(photo => photo.status === "error").length;
  const previewBytes = photos.reduce((sum, photo) => sum + (photo.previewBytes || 0), 0);
  const limitReached = selectionLimit > 0 && selected >= selectionLimit;
  useImperativeHandle(ref, () => ({ open: (pick = true) => { dialog.current?.open(); if (pick) input.current?.click(); } }), []);
  useEffect(() => { onActivity(photos.length, selected); }, [photos.length, selected, onActivity]);
  useEffect(() => {
    alive.current = true;
    const allocated = urls.current;
    return () => { alive.current = false; allocated.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  function publish() { if (alive.current) setPhotos(Array.from(records.current.values())); }

  async function processQueue() {
    if (processing.current) return;
    processing.current = true;
    let lastPublish = 0;
    try {
      while (alive.current && !pausedRef.current && queue.current.length) {
        const id = queue.current.shift()!;
        const photo = records.current.get(id);
        if (!photo) continue;
        const version = generation.current;
        try {
          const result = await preparePhoto(photo.file);
          if (!alive.current || version !== generation.current || !records.current.has(id)) continue;
          const url = URL.createObjectURL(result.blob);
          urls.current.add(url);
          const group = closestVisualGroup(result.signature, representatives.current) || id;
          representatives.current.set(group, [...(representatives.current.get(group) || []), result.signature]);
          signatures.current.set(id, result.signature);
          records.current.set(id, { ...records.current.get(id)!, status: "ready", url, previewBytes: result.blob.size, group });
        } catch {
          if (alive.current && version === generation.current && records.current.has(id)) records.current.set(id, { ...records.current.get(id)!, status: "error", error: /\.(heic|heif)$/i.test(photo.file.name) ? "이 브라우저에서 HEIC 사진을 열지 못했어요. JPG로 변환한 사진을 선택해 주세요." : "사진을 열지 못했어요. 파일 형식과 손상 여부를 확인해 주세요." });
        }
        if (Date.now() - lastPublish > 150) { publish(); lastPublish = Date.now(); }
        // Decode just one file at a time and yield between files so scrolling stays responsive.
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
    } finally { processing.current = false; publish(); }
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    let unsupported = 0, empty = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i.test(file.name)) { unsupported++; continue; }
      if (!file.size) { empty++; continue; }
      const key = fileKey(file);
      if (keys.current.has(key)) continue;
      const id = crypto.randomUUID();
      keys.current.add(key);
      records.current.set(id, { id, file, selected: false, status: "loading" });
      queue.current.push(id);
    }
    setErrors([...(unsupported ? [`사진이 아닌 파일 ${unsupported}개는 제외했어요.`] : []), ...(empty ? [`내용이 없는 파일 ${empty}개는 제외했어요.`] : [])]);
    publish();
    if (input.current) input.current.value = "";
    void processQueue();
  }

  function togglePhoto(id: string, checked: boolean) {
    const photo = records.current.get(id);
    if (!photo || photo.status !== "ready") return;
    if (checked && selectionLimit > 0 && Array.from(records.current.values()).filter(item => item.selected).length >= selectionLimit) return;
    records.current.set(id, { ...photo, selected: checked }); publish();
  }

  function selectAll(checked: boolean) {
    records.current.forEach((photo, id) => records.current.set(id, { ...photo, selected: checked && photo.status === "ready" })); publish();
  }

  function removePhoto(id: string) {
    const photo = records.current.get(id);
    if (!photo) return;
    if (photo.url) { URL.revokeObjectURL(photo.url); urls.current.delete(photo.url); }
    keys.current.delete(fileKey(photo.file)); records.current.delete(id); signatures.current.delete(id);
    if (photo.group) {
      const survivor = Array.from(records.current.values()).find(item => item.group === photo.group);
      if (!survivor) representatives.current.delete(photo.group);
      else representatives.current.set(photo.group, Array.from(records.current.values()).filter(item => item.group === photo.group).flatMap(item => signatures.current.get(item.id) ? [signatures.current.get(item.id)!] : []));
    }
    publish();
  }

  function download(photo: LocalPhoto) {
    const url = URL.createObjectURL(photo.file); urls.current.add(url);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = photo.file.name; anchor.click();
    window.setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 10000);
  }

  function clearPhotos() {
    generation.current++; queue.current = []; records.current.clear(); keys.current.clear(); representatives.current.clear(); signatures.current.clear();
    urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); setErrors([]); publish();
  }

  return <CaptureDialog ref={dialog} id="photo-selector-title" title="사진 선별" className="photo-capture-dialog">
    <p className="capture-note">사진을 한 번에 모두 골라도 좋아요. 서버에 올리지 않고 이 기기에서 작은 미리보기로 정리해요. 원본은 그대로 유지돼요.</p>
    <input ref={input} type="file" hidden accept="image/*,.heic,.heif" multiple onChange={event => addFiles(event.target.files)} />
    <div className="capture-actions"><button className="button primary" type="button" onClick={() => input.current?.click()}><ImagePlus size={18} />사진 {photos.length ? "추가" : "선택"}</button>
      {selectionLimit === 0 && selected < ready && <button type="button" className="button secondary" onClick={() => selectAll(true)}>전체 선택</button>}
      {selected > 0 && <button type="button" className="button secondary" onClick={() => selectAll(false)}>선택 해제</button>}
      {pending > 0 && <button type="button" className="button secondary" onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); if (!pausedRef.current) void processQueue(); }}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "정리 계속" : "정리 잠시 멈춤"}</button>}
    </div>
    <p className="photo-local-note">서버 저장 0 · 장 수·전체 용량 제한 없음 · 한 장씩 처리</p>
    {pending > 0 && <div className="photo-processing"><progress value={photos.length - pending} max={photos.length} aria-label="사진 정리 진행률" /><span>{paused ? "정리 일시 정지" : "비슷한 사진을 모으고 있어요"} · {photos.length - pending}/{photos.length}장</span></div>}
    <div className="photo-selection-limit">
      <label htmlFor="photo-selection-limit">선별할 장 수</label>
      <input id="photo-selection-limit" type="number" inputMode="numeric" min={0} step={1} value={selectionLimit || ""} placeholder="제한 없음" aria-describedby="photo-selection-limit-hint" onChange={event => { const value = Number(event.target.value); setSelectionLimit(Number.isSafeInteger(value) && value > 0 ? value : 0); }} />
      <p id="photo-selection-limit-hint" role="status">{selectionLimit === 0 ? "필요한 사진을 원하는 만큼 직접 골라 주세요. 숫자를 입력하면 그 장 수까지 선택할 수 있어요." : selected > selectionLimit ? `${selected}장 선택 중 · ${selected - selectionLimit}장을 선택 해제해 주세요. 기존 선택은 유지했어요.` : selected === selectionLimit ? `${selected}/${selectionLimit}장 선택 완료 · 다른 사진으로 바꾸려면 먼저 선택을 해제해 주세요.` : `${selected}/${selectionLimit}장 선택 · ${selectionLimit - selected}장을 더 고를 수 있어요.`}</p>
    </div>
    <p role="status">{photos.length ? `${photos.length}장 중 ${selected}장 선택` : "여러 장을 한 번에 선택할 수 있어요."}</p>
    {photos.length > 0 && <p className="capture-note">미리보기 파일 {formatBytes(previewBytes)}{failed ? ` · 열지 못한 사진 ${failed}장` : ""}. 기기 성능에 따라 정리에 시간이 걸릴 수 있어요.</p>}
    {errors.length > 0 && <ul className="error" role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <PhotoGallery photos={photos} limitReached={limitReached} onToggle={togglePhoto} onRemove={removePhoto} onDownload={download} />
    <div className="photo-local-footer"><p className="capture-note">선택 내용은 현재 화면에서만 유지돼요. 얼굴별 분류·품질 평가·용도별 추천은 아직 제공하지 않아요.</p>{photos.length > 0 && <button className="button secondary" type="button" onClick={clearPhotos}>목록 비우기</button>}</div>
  </CaptureDialog>;
});
