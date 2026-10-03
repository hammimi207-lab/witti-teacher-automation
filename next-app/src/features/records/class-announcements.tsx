"use client";
import { useEffect, useRef, useState } from "react";
import { missingPlaceholders, reusableAnnouncement, announcementTemplate } from "./notice-workflow";

export type ClassAnnouncement = { id: string; content: string; created_at: string; title?: string; category?: string; applied?: boolean };
export function announcementText(items: ClassAnnouncement[]) { return [...new Set(items.filter(item => item.applied !== false).map(item => item.content.trim()).filter(Boolean))].join("\n\n"); }
export function toggleAnnouncement(selected: ClassAnnouncement[], item: ClassAnnouncement) {
  return selected.some(entry => entry.id === item.id) ? selected.filter(entry => entry.id !== item.id) : [...selected, { ...item, title: item.title || "공지 양식", category: item.category || "일반", content: reusableAnnouncement(item.content), applied: false }];
}
export function applyAnnouncements(selected: ClassAnnouncement[]) {
  const placeholders = selected.flatMap(item => missingPlaceholders(item.content));
  if (placeholders.length) throw new Error(`빈 자리표시자를 채워 주세요: ${[...new Set(placeholders)].join(", ")}`);
  if (selected.some(item => !item.content.trim())) throw new Error("선택한 공지 내용을 적거나 선택을 해제해 주세요.");
  if (announcementText(selected.map(item => ({ ...item, applied: true }))).length > 3000) throw new Error("전체 공지는 합계 3,000자까지 담을 수 있어요.");
  return selected.map(item => ({ ...item, applied: true }));
}
export function ClassAnnouncements({ selected, onChange, disabled = false, userId = "" }: {
  selected: ClassAnnouncement[]; onChange: (items: ClassAnnouncement[]) => void; disabled?: boolean; userId?: string;
}) {
  const [items, setItems] = useState<ClassAnnouncement[]>([]);
  const [sources, setSources] = useState<ClassAnnouncement[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sourceStatus, setSourceStatus] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [original, setOriginal] = useState<ClassAnnouncement | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setItems([]); setSources([]); setOriginal(null);
    Promise.allSettled([
      fetch("/api/records/announcements", { signal: controller.signal, cache: "no-store" }).then(async response => {
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) { setItems(data.announcements); setError(""); }
      }),
      fetch("/api/records/announcement-sources", { signal: controller.signal, cache: "no-store" }).then(async response => {
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) { setSources(data.announcements); setSourceStatus(data.scope); }
      }).catch(caught => { if (!controller.signal.aborted) setSourceStatus(caught.message); }),
    ]).then(results => {
      if (!controller.signal.aborted) { if (results[0].status === "rejected") setError(results[0].reason.message); setLoading(false); }
    });
    return () => controller.abort();
  }, [reload, userId]);
  function edit(id: string, patch: Partial<ClassAnnouncement>) {
    onChange(selected.map(item => item.id === id ? { ...item, ...patch, applied: false } : item)); setMessage("");
  }
  async function mutate(method: "POST" | "PATCH" | "DELETE", item: ClassAnnouncement) {
    if (lock.current || disabled || !userId) return;
    if (method !== "DELETE" && (!item.title?.trim() || !item.category?.trim() || !item.content.trim())) { setError("양식의 제목·분류·본문을 적어 주세요."); return; }
    if (method === "DELETE" && !window.confirm("이 공지 양식을 삭제할까요? 이번 작성 문구와 저장된 알림장은 유지됩니다.")) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/records/announcements", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(method === "DELETE" ? { id: item.id } : { id: method === "PATCH" ? item.id : undefined, title: item.title, category: item.category, content: announcementTemplate(item.content) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (method === "DELETE") setItems(current => current.filter(entry => entry.id !== item.id));
      else setItems(current => [data.announcement, ...current.filter(entry => entry.id !== data.announcement.id)]);
      setOriginal(null);
      setMessage(method === "POST" ? "재사용 양식으로 저장했어요. 이번 알림장 적용은 별도로 눌러 주세요." : method === "PATCH" ? "원본 양식을 수정했어요. 이번 작성 문구는 유지돼요." : "양식을 삭제했어요.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "양식을 처리하지 못했습니다."); }
    finally { lock.current = false; setBusy(false); }
  }
  const available = [...items, ...sources].filter(item => `${item.title || ""} ${item.category || ""} ${item.content}`.includes(query));
  const direct = selected.find(item => item.id === "direct-entry");
  function editDirect(content: string) {
    const others = selected.filter(item => item.id !== "direct-entry");
    onChange(content ? [...others, { id: "direct-entry", title: direct?.title || "직접 작성", category: direct?.category || "일반", created_at: "", content, applied: false }] : others);
    setMessage("");
  }
  return <section className="common-activity full">
    <h4>오늘 반 공통 공지</h4>
    <fieldset className="field full class-announcements" disabled={disabled || busy}>
    <details open={!direct?.applied}>
      <summary>{direct?.applied ? "반 공통 공지 수정하기" : "반 공통 공지 한 번 등록하기"}</summary>
      <p>주임교사나 반 선생님에게 받은 안내를 그대로 붙여 넣어 주세요. 필요한 내용만 고쳐 모든 아이의 알림장에 함께 담을 수 있어요.</p>
      <textarea aria-label="오늘 반 공통 공지" rows={4} maxLength={3000} value={direct?.content || ""} onChange={event => editDirect(event.target.value)} placeholder={"전달받은 공지를 여기에 붙여 넣어 주세요.\n• 내일 바깥놀이가 있어요.\n• 물통과 모자를 준비해 주세요."} />
      <button type="button" className="button secondary" disabled={!direct?.content.trim()} onClick={() => {
        if (!direct) return;
        try {
          const applied = applyAnnouncements([direct])[0];
          applyAnnouncements([...selected.filter(item => item.id !== direct.id && item.applied !== false), applied]);
          onChange(selected.map(item => item.id === direct.id ? applied : item));
          setError(""); setMessage("반 공통 공지를 이번 알림장에 적용했어요.");
        } catch (caught) { setError((caught as Error).message); }
      }}>공통 공지 등록</button>
      {direct && <button type="button" className="button secondary" onClick={() => editDirect("")}>공지 해제</button>}
      {direct && userId && <details><summary>이 공지를 양식으로 저장</summary>
        <label>양식 제목<input maxLength={100} value={direct.title || "직접 작성"} onChange={event => edit(direct.id, { title: event.target.value })} /></label>
        <label>분류<input maxLength={50} value={direct.category || "일반"} onChange={event => edit(direct.id, { category: event.target.value })} /></label>
        <button type="button" className="button secondary" onClick={() => mutate("POST", direct)}>공지 양식으로 저장</button>
      </details>}
    </details>
    {direct?.applied && <p>이번 알림장에 적용된 공지: {direct.content}</p>}
    <details><summary>저장한 공지 불러오기 · 선택 사항</summary>
    <p>스티커를 선택하고 내용을 수정한 뒤 ‘이번 공지에 적용’을 눌러 주세요.</p>
    <label>공지 양식·기존 전달사항 검색<input value={query} onChange={event => setQuery(event.target.value)} placeholder="예: 준비물, 행사" /></label>
    {loading && <p role="status">내 공지 자료를 검색하는 중…</p>}
    <div className="choice-grid notice-template-chips">{available.map(item => <button type="button" className="button secondary" key={item.id} aria-pressed={selected.some(entry => entry.id === item.id)} onClick={() => onChange(toggleAnnouncement(selected, item))}>{selected.some(entry => entry.id === item.id) ? "✓ " : "+ "}{item.title || "공지 양식"} · {item.category || "일반"}</button>)}
      <button type="button" className="button secondary" onClick={() => onChange([...selected, { id: `custom-${crypto.randomUUID()}`, title: "직접 작성", category: "일반", content: "", created_at: "", applied: false }])}>＋ 직접 작성</button>
    </div>
    <details><summary>불러올 수 있는 자료 안내</summary><p>{sourceStatus || "등록한 공지 양식과 본인의 저장된 알림장 전달사항을 활용해요."}</p>
    <small>학습 업로드 원문을 검색하는 저장소는 연결되어 있지 않아요. 필요한 문구는 직접 공지 양식으로 등록해 주세요.</small></details>
    {selected.filter(item => item.id !== "direct-entry").map(item => <section className="announcement-register" key={item.id}>
      <label>공지 내용<textarea rows={4} maxLength={3000} value={item.content} onChange={event => edit(item.id, { content: event.target.value })} placeholder="전달받은 공지를 붙여 넣거나 필요한 내용을 적어 주세요." /></label>
      {!!missingPlaceholders(item.content).length && <p>수정할 항목: {missingPlaceholders(item.content).join(", ")}</p>}
      <button type="button" className="button secondary" onClick={() => onChange(selected.filter(entry => entry.id !== item.id))}>선택 해제</button>
      {userId && <details><summary>다음에도 사용할 공지로 저장</summary>
        <label>양식 제목<input maxLength={100} value={item.title || "공지 양식"} onChange={event => edit(item.id, { title: event.target.value })} /></label>
        <label>분류<input maxLength={50} value={item.category || "일반"} onChange={event => edit(item.id, { category: event.target.value })} /></label>
        <p>저장할 양식의 날짜·시간 등은 수정 가능한 빈칸으로 바뀌어요. 이번에 적용할 공지 내용은 그대로 유지돼요.</p>
        <button type="button" className="button secondary" onClick={() => mutate("POST", item)}>공지 양식으로 저장</button>
      </details>}
      <span role="status">{item.applied ? "이번 공지에 적용됨" : "수정 후 적용해 주세요"}</span>
    </section>)}
    {selected.length > 0 && <button type="button" className="button primary" onClick={() => { try { onChange(applyAnnouncements(selected)); setError(""); setMessage("선택한 공지를 이번 알림장에 적용했어요."); } catch (caught) { setError((caught as Error).message); } }}>이번 공지에 적용</button>}
    {userId && <details><summary>저장된 원본 양식 관리</summary>{items.map(item => <div className="announcement-row" key={item.id}><span>{item.title || "공지 양식"} · {item.category || "일반"}</span><button type="button" className="button secondary" onClick={() => setOriginal({ ...item })}>원본 수정</button><button type="button" className="button secondary" onClick={() => mutate("DELETE", item)}>양식 삭제</button></div>)}</details>}
    {original && <section aria-label="원본 양식 수정"><h4>원본 양식 수정</h4><label>제목<input value={original.title || "공지 양식"} maxLength={100} onChange={event => setOriginal({ ...original, title: event.target.value })} /></label><label>분류<input value={original.category || "일반"} maxLength={50} onChange={event => setOriginal({ ...original, category: event.target.value })} /></label><label>본문<textarea rows={4} maxLength={3000} value={original.content} onChange={event => setOriginal({ ...original, content: event.target.value })} /></label><button type="button" className="button primary" onClick={() => mutate("PATCH", original)}>원본 양식 저장</button><button type="button" className="button secondary" onClick={() => setOriginal(null)}>취소</button></section>}
    </details>
    {!userId && <p>비회원도 공지를 직접 작성하고 적용할 수 있어요. 재사용 양식 저장은 로그인 후 이용해 주세요.</p>}
    {error && <div role="alert"><p className="error">{error}</p>{userId && <button type="button" className="button secondary" onClick={() => setReload(value => value + 1)}>목록 다시 조회</button>}</div>}
    {message && <p role="status">{message}</p>}
  </fieldset></section>;
}
