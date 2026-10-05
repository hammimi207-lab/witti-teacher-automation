"use client";
import { useCallback, useEffect, useState } from "react";
import type { SavedPhoto } from "./document-photos";

export function PhotoGallery({ sessionId, lazy = false, photoIds }: { sessionId?: string | null; lazy?: boolean; photoIds?: number[] }) {
  const [open, setOpen] = useState(!lazy);
  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (start = 0) => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ offset: String(start), ...(photoIds?.length ? { ids: photoIds.join(",") } : sessionId ? { sessionId } : {}) });
      const response = await fetch(`/api/photos?${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "사진을 불러오지 못했습니다.");
      setPhotos(current => start ? [...current, ...payload.photos] : payload.photos);
      setOffset(start + payload.photos.length); setHasMore(payload.hasMore); setLoaded(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "사진 조회 실패"); }
    finally { setLoading(false); }
  }, [sessionId, photoIds]);
  // Fetching this private gallery is an external synchronization on first open.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open && !loaded) void load(); }, [open, loaded, load]);
  async function remove() {
    if (busy || !selected.length || !window.confirm(`선택한 사진 ${selected.length}장을 영구 삭제할까요?\n기록 본문은 유지되며, 이후 Word 다운로드에서 사진이 제외됩니다. 이미 내려받은 파일은 별도로 삭제해 주세요.`)) return;
    setBusy(true); setError("");
    try {
      for (const id of selected) {
        const response = await fetch(`/api/photos/${id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("일부 사진을 삭제하지 못했습니다. 남은 사진을 확인하고 다시 시도해 주세요.");
        setPhotos(current => current.filter(photo => photo.id !== id));
        setSelected(current => current.filter(value => value !== id));
      }
      // Refresh pagination after deletion so the next page cannot skip shifted rows.
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "사진 삭제 실패"); }
    finally { setBusy(false); }
  }
  return <details className="saved-record-details" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary>내 사진{sessionId ? " · 이 기록에 사용한 사진" : ""}</summary>
    <div className="saved-record-body"><p>본인 계정으로 보관한 사진만 표시됩니다. 사진 삭제와 기록 삭제는 별개입니다.</p>
      {error && <p className="error" role="alert">{error} <button type="button" disabled={loading || busy} onClick={() => void load()}>다시 불러오기</button></p>}
      {loading && <p role="status">사진을 불러오는 중…</p>}
      {loaded && !photos.length && <p>보관된 사진이 없습니다. 저장하지 않았거나 이미 삭제한 사진은 표시되지 않습니다.</p>}
      {!!photos.length && <><div className="photo-actions"><label><input type="checkbox" disabled={busy} checked={photos.length === selected.length} onChange={event => setSelected(event.target.checked ? photos.map(photo => photo.id) : [])} />현재 표시된 사진 전체 선택</label><button className="button secondary" type="button" disabled={busy || !selected.length} onClick={remove}>{busy ? "삭제 중…" : `선택한 사진 ${selected.length}장 삭제`}</button></div>
        <div className="saved-photo-grid">{photos.map(photo => <figure key={photo.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.original_file_name || "보관된 놀이 사진"} loading="lazy" />
          <figcaption><label><input type="checkbox" disabled={busy} checked={selected.includes(photo.id)} onChange={event => setSelected(current => event.target.checked ? [...current, photo.id] : current.filter(id => id !== photo.id))} />{photo.original_file_name || "놀이 사진"}</label></figcaption>
        </figure>)}</div></>}
      {hasMore && <button className="button secondary" type="button" disabled={loading || busy} onClick={() => void load(offset)}>사진 더 보기</button>}
    </div></details>;
}
