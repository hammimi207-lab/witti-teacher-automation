"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { SavedRecordCard, type SavedRecord } from "./saved-record-library";

export function RecordList({ records, language }: { records: SavedRecord[]; language: boolean }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const visible = records.filter(record => !removed.includes(record.id));
  async function removeSelected() {
    if (lock.current || !selected.length) return;
    if (!window.confirm(`선택한 ${selected.length}개 기록을 삭제할까요?\n같은 기록의 종합 기록과 정확한 관찰 언어가 모두 목록에서 사라집니다.`)) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/records/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "삭제하지 못했습니다.");
      const deleted = payload.deletedIds as number[];
      setRemoved(previous => [...previous, ...deleted]); setSelected([]); setSelecting(false);
      setMessage(`${deleted.length}개 기록을 삭제했습니다. ${deleted.length !== selected.length ? "일부 기록은 삭제되지 않았습니다. 다시 확인해 주세요." : ""}`);
      router.refresh();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "삭제하지 못했습니다. 다시 시도해 주세요."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="record-list">
    <div className="record-list-toolbar"><span className="record-count-badge">기록 <b>{visible.length}</b>개</span><div>
      {selecting && <><label className="record-select-all"><input type="checkbox" disabled={busy} checked={visible.length > 0 && selected.length === visible.length} onChange={event => setSelected(event.target.checked ? visible.map(record => record.id) : [])} />전체 선택</label><button className="button secondary" type="button" disabled={busy || !selected.length} onClick={removeSelected}><Trash2 size={17} />{busy ? "삭제 중…" : `선택한 ${selected.length}개 삭제`}</button></>}
      <button type="button" className="button secondary" disabled={busy} aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setSelected([]); }}>{!selecting && <Trash2 size={18} />}{selecting ? "취소" : "삭제"}</button>
    </div></div>
    {message && <p role="status">{message}</p>}
    {selecting && <p>삭제할 기록을 선택해 주세요. 같은 기록의 두 탭 내용이 함께 삭제됩니다.</p>}
    {visible.map((record, index) => <div key={record.id} className="record-list-item"><div className="record-item-number">{selecting && <input aria-label={`${index + 1}번 기록 삭제 선택`} type="checkbox" disabled={busy} checked={selected.includes(record.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, record.id] : previous.filter(id => id !== record.id))} />}<span>{index + 1}.</span></div><SavedRecordCard record={record} language={language} /></div>)}
    {!visible.length && <p>표시할 기록이 없습니다.</p>}
  </section>;
}
