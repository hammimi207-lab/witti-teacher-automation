"use client";
import { useEffect, useState } from "react";
import { type SavedSupportPlan } from "./weekly-support";
import { weekRange } from "./weekly-story";
import { WeekPicker } from "./week-picker";

function PlanCard({ value, onChange, onObservation }: { value: SavedSupportPlan; onChange: (plan: SavedSupportPlan) => void; onObservation?: (text: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/records/weekly/plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "저장하지 못했어요.");
      onChange(draft); setMessage("계획과 돌아보기를 저장했어요.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했어요."); }
    finally { setBusy(false); }
  }
  return <details className="saved-support-card"><summary><strong>{value.title}</strong><small>{value.targetWeek} 주 · {value.childAliases.join(", ")} · {value.status === "tried" ? "지원 후 돌아봄" : value.status === "deferred" ? "잠시 보류" : "지원 예정"}</small></summary><p>{value.plan}</p><p><b>다음에 살펴볼 반응</b><br />{value.watchFor}</p>
    <fieldset disabled={busy}><label>계획 제목<input value={draft.title} maxLength={100} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><WeekPicker label="지원할 주 선택" value={draft.targetWeek} onChange={targetWeek => setDraft({ ...draft, targetWeek })} /><label>지원 계획 수정<textarea rows={4} maxLength={4000} value={draft.plan} onChange={event => setDraft({ ...draft, plan: event.target.value })} /></label><label>살펴볼 반응 수정<textarea rows={2} maxLength={1000} value={draft.watchFor} onChange={event => setDraft({ ...draft, watchFor: event.target.value })} /></label><label>실제로 지원해 보셨나요?<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as SavedSupportPlan["status"] })}><option value="planned">아직 지원 예정이에요</option><option value="tried">지원해 보고 돌아봐요</option><option value="deferred">지금은 보류할게요</option></select></label><label>실제로 한 지원과 아이의 반응<textarea rows={4} value={draft.reflection} maxLength={2500} placeholder="어떻게 지원했나요? 그 뒤 아이가 한 말·행동·표정은 어땠나요? 반응이 없었다면 그 모습 그대로 적어도 좋아요." onChange={event => setDraft({ ...draft, reflection: event.target.value })} /></label><div className="support-plan-actions"><button type="button" className="button secondary" disabled={!draft.title.trim() || !draft.plan.trim()} onClick={save}>{busy ? "저장 중…" : "계획·돌아보기 저장"}</button>{onObservation && <button type="button" className="button secondary" disabled={draft.status !== "tried" || !draft.reflection.trim()} onClick={() => onObservation(draft.reflection)}>실제 반응만 이번 관찰에 덧붙이기</button>}</div></fieldset>{message && <p role="status">{message}</p>}
  </details>;
}
export function SavedSupportPlans({ revision = 0, childAlias, onObservation }: { revision?: number; childAlias?: string; onObservation?: (text: string) => void }) {
  const [plans, setPlans] = useState<SavedSupportPlan[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/records/weekly/plans", { signal: controller.signal }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "계획을 불러오지 못했어요."); setPlans(body.plans); setError(""); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message || "계획을 불러오지 못했어요."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, retry]);
  const monday = weekRange(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date())).monday;
  const shown = childAlias !== undefined ? plans.filter(plan => plan.childAliases.includes(childAlias.trim()) && plan.targetWeek <= monday && plan.status !== "deferred") : plans;
  return <section className="panel saved-support-plans"><h2>{childAlias !== undefined ? "지난 지원 계획, 아이는 어떻게 반응했나요?" : "내 지원 계획과 돌아보기"}</h2><p className="capture-note">{childAlias !== undefined ? "입력한 아이 별칭과 연결된 이번 주까지의 계획이에요. 실제로 한 지원과 반응만 이번 기록에 옮겨 주세요." : "계정에 저장한 최근 100개 계획입니다. 다음 놀이 기록을 쓸 때 아이 별칭에 맞는 계획을 다시 보여드려요."}</p>{loading ? <p role="status">계획을 불러오고 있어요…</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="button secondary" onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></div> : !shown.length ? <p>{childAlias !== undefined ? "이 별칭에 연결된 지난 지원 계획이 아직 없어요." : "위에서 아이디어를 고르고 다듬어 내 지원 계획에 담아 보세요."}</p> : shown.map(plan => <PlanCard key={plan.id} value={plan} onObservation={onObservation} onChange={updated => setPlans(items => items.map(item => item.id === updated.id ? updated : item))} />)}</section>;
}
