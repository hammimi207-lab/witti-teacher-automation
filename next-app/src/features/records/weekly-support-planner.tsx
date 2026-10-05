"use client";
import { useRef, useState } from "react";
import { AI_CONSENT_VERSION } from "./ai-consent";
import { collectPlans, directions, nextWeek, type SupportIdea } from "./weekly-support";
import type { WeeklyResult, WeeklySource } from "./weekly-story";
import { WeeklyPlayMap } from "./weekly-play-map";
import { WeekPicker } from "./week-picker";

export function WeeklySupportPlanner({ monday, sources, result, onSaved }: { monday: string; sources: WeeklySource[]; result: WeeklyResult; onSaved: () => void }) {
  const [playIndex, setPlayIndex] = useState(0);
  const [direction, setDirection] = useState<typeof directions[number]>(directions[0]);
  const [constraints, setConstraints] = useState("");
  const [consent, setConsent] = useState(false);
  const [ideas, setIdeas] = useState<SupportIdea[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<{ title: string; plan: string; watchFor: string; sourceIds: string[] } | null>(null);
  const [targetWeek, setTargetWeek] = useState(nextWeek(monday));
  const [saving, setSaving] = useState(false);
  const requestId = useRef("");
  const lock = useRef(false);
  const play = result.plays[playIndex];
  const selectedSources = sources.filter(source => play.sourceIds.includes(source.id));
  const collected = collectPlans(selectedSources);
  function playLabel(item: WeeklyResult["plays"][number]) {
    const names = [...new Set(sources.filter(source => item.sourceIds.includes(source.id)).map(source => source.childAlias.trim()).filter(Boolean))];
    if (!names.length) return item.title;
    const title = item.title.trim();
    const last = title.charCodeAt(title.length - 1);
    const particle = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0 ? "을" : "를";
    return `${title}${particle} 한 ${names.join(" / ")}`;
  }
  function reset() { setIdeas([]); setDraft(null); setMessage(""); requestId.current = ""; }
  async function generate() {
    if (lock.current || !consent) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/records/weekly/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day: monday, sourceIds: play.sourceIds, direction, constraints, previousTitles: ideas.map(idea => idea.title), weeklyProposal: play.nextSupportPlan,
        consent: { version: AI_CONSENT_VERSION, aiAccepted: true, photoAccepted: false } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "아이디어를 가져오지 못했어요.");
      setIdeas(body.ideas);
    } catch (error) { setMessage(error instanceof Error ? error.message : "아이디어를 가져오지 못했어요."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save() {
    if (!draft || lock.current) return;
    lock.current = true; setSaving(true); setMessage("");
    requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/records/weekly/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestId.current, plan: { version: 1, sourceWeek: monday, targetWeek, childAliases: [], direction, ...draft, status: "planned", reflection: "" } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "저장하지 못했어요.");
      setDraft(null); requestId.current = ""; setMessage("내 지원 계획에 저장했어요. 아래 목록에서 수정하거나 실행 후 반응을 남길 수 있어요."); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했어요."); }
    finally { lock.current = false; setSaving(false); }
  }
  return <section className="panel support-planner" aria-label="다음 주 놀이 지원 함께 구상하기"><span className="section-kicker">관찰에서 다음 지원으로</span><h2>다음 주 놀이 지원 함께 구상하기</h2><p>교사가 남긴 계획을 모아, 우리 반에서 이어갈 방법을 골라 보세요.</p>
    <fieldset disabled={busy || saving}><label>살펴볼 놀이<select value={playIndex} onChange={event => { if (draft && !window.confirm("놀이를 바꾸면 작성 중인 계획이 초기화됩니다. 바꿀까요?")) return; setPlayIndex(Number(event.target.value)); reset(); }}>{result.plays.map((item, i) => <option value={i} key={i}>{playLabel(item)}</option>)}</select></label>
      <div className="support-collected"><h3>교사가 기록한 지원 계획</h3>{collected.length ? collected.map((item, i) => <div key={i}><p>{item.text}</p><small>{item.sources.map(id => { const source = sources.find(s => s.id === id)!; return `${source.date} · ${source.childAlias}`; }).join(" / ")}</small><button type="button" className="library-view-all" onClick={() => { if (draft && !window.confirm("작성 중인 계획을 이 계획으로 바꿀까요?")) return; requestId.current = ""; setDraft({ title: play.title.slice(0, 90) + " 지원", plan: item.text, watchFor: "", sourceIds: item.sources }); setMessage(""); }}>이 계획으로 이어가기</button></div>) : <p>직접 작성한 계획은 없어요. 관찰 내용을 바탕으로 함께 구상할 수 있어요.</p>}</div>
      <details className="support-ai-proposal"><summary>주간 분석에서 제안한 방향 보기 · AI 제안</summary><p>{play.nextSupportPlan}</p></details>
      <fieldset className="support-directions"><legend>어떤 방향으로 이어가 볼까요?</legend>{directions.map(item => <label key={item}><input type="radio" name={`support-direction-${monday}`} checked={direction === item} onChange={() => { if (draft && !window.confirm("방향을 바꾸면 작성 중인 계획이 초기화됩니다. 바꿀까요?")) return; setDirection(item); reset(); }} />{item}</label>)}</fieldset>
      <label>우리 반의 조건 <small>선택</small><textarea value={constraints} maxLength={1000} rows={2} placeholder="예: 교실 안에서, 기존 재료만으로, 놀이를 정리하지 않고 이어가기" onChange={event => setConstraints(event.target.value)} /></label>
      <label className="weekly-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>선택한 놀이의 관찰·계획과 조건을 OpenAI에 전달해 아이디어를 만드는 데 동의합니다.</span></label>
      <button type="button" className="button primary" disabled={!consent} onClick={generate}>{busy ? "관찰에 맞는 지원을 생각하고 있어요…" : ideas.length ? "다른 아이디어 보기" : "지원 아이디어 함께 보기"}</button>
    </fieldset>
    <div className="support-ideas">{ideas.map((idea, i) => <article className="support-idea" key={i}><span className="section-kicker">선택 가능한 아이디어</span><h3>{idea.title}</h3><details><summary>관찰에서 찾은 단서</summary>{idea.evidence.map((item, j) => <p key={j}>“{item.quote}”<small>{sources.find(source => source.id === item.sourceId)?.childAlias} · {sources.find(source => source.id === item.sourceId)?.date}</small></p>)}</details><h4>지원 방법</h4><p>{idea.plan}</p><h4>교사의 말과 행동 예시</h4><p>{idea.teacherWords}</p><h4>다음에 살펴볼 반응</h4><p>{idea.watchFor}</p><button type="button" className="button secondary" disabled={busy || saving} onClick={() => { if (draft && !window.confirm("작성 중인 계획을 이 아이디어로 바꿀까요?")) return; requestId.current = ""; setDraft({ title: idea.title, plan: `${idea.plan}\n\n교사의 말과 행동 예시\n${idea.teacherWords}`, watchFor: idea.watchFor, sourceIds: [...new Set(idea.evidence.map(item => item.sourceId))] }); setMessage(""); }}>놀이 흐름 지도에 담기</button></article>)}</div>
    <WeeklyPlayMap result={result} playIndex={playIndex} sources={sources} direction={direction}
      support={draft ? <fieldset disabled={saving}><p className="capture-note">연결된 아이 · {[...new Set(sources.filter(source => draft.sourceIds.includes(source.id)).map(source => source.childAlias))].join(", ")}</p><label>지원 계획 제목<input value={draft.title} maxLength={100} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><WeekPicker label="지원할 주" value={targetWeek} onChange={setTargetWeek} /><label>실제로 준비할 지원<textarea rows={5} value={draft.plan} maxLength={4000} onChange={event => setDraft({ ...draft, plan: event.target.value })} /></label></fieldset> : undefined}
      response={draft ? <fieldset disabled={saving}><label>다음에 살펴볼 말·행동·놀이 변화<textarea rows={3} placeholder="지원한 뒤 어떤 장면을 살펴볼까요? 실제 반응은 실행 후 남겨요." value={draft.watchFor} maxLength={1000} onChange={event => setDraft({ ...draft, watchFor: event.target.value })} /></label></fieldset> : undefined}
      actions={draft ? <button type="button" className="button primary" disabled={saving || !draft.title.trim() || !draft.plan.trim()} onClick={save}>{saving ? "저장 중…" : "지도의 지원 계획 저장"}</button> : undefined}
    />
    {message && <p role="status">{message}</p>}
  </section>;
}
