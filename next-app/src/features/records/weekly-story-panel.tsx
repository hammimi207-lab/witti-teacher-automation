"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { AI_CONSENT_VERSION } from "./ai-consent";
import { weekRange, type WeeklyResult, type WeeklySource } from "./weekly-story";
import { WeekPicker } from "./week-picker";
import { RecordAssembly } from "./record-assembly";
import { WeeklySupportPlanner } from "./weekly-support-planner";
import { WeeklyWordDownload } from "./weekly-word-download";
import { SavedSupportPlans } from "./saved-support-plans";

type WeekData = { range: ReturnType<typeof weekRange>; sources: WeeklySource[]; excluded: number; result?: WeeklyResult; saveError?: string };
export function WeeklyStoryPanel({ today }: { today: string }) {
  const [day, setDay] = useState(today);
  const [data, setData] = useState<WeekData | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const finishAssembly = useCallback(() => {
    setBusy(false);
    window.requestAnimationFrame(() => document.getElementById("weekly-record-result")?.focus());
  }, []);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [plansRevision, setPlansRevision] = useState(0);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [stories, setStories] = useState<{ id: string; monday: string; saturday: string; count: number }[]>([]);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/records/weekly/history", { signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setStories(body.stories); setHistoryError("");
    }).catch(error => { if (!controller.signal.aborted) setHistoryError(error.message || "보관함을 불러오지 못했어요."); });
    return () => controller.abort();
  }, [historyRevision]);
  const sequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++sequence.current;
    fetch(historyId ? `/api/records/weekly/history?id=${encodeURIComponent(historyId)}` : `/api/records/weekly?day=${encodeURIComponent(day)}`, { signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "기록을 불러오지 못했어요.");
      if (current === sequence.current) setData(body);
    }).catch(caught => { if (!controller.signal.aborted) setError(caught.message || "기록을 불러오지 못했어요."); })
      .finally(() => { if (current === sequence.current) setLoading(false); });
    return () => controller.abort();
  }, [day, reload, historyId]);

  async function analyze() {
    if (busy || !accepted || !data?.sources.length) return;
    const current = sequence.current;
    setBusy(true); setError("");
    setData({ ...data, result: undefined });
    try {
      const response = await fetch("/api/records/weekly", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day, consent: { version: AI_CONSENT_VERSION, aiAccepted: true, photoAccepted: false } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "분석을 완료하지 못했어요.");
      if (current === sequence.current) { setData(body); setHistoryRevision(n => n + 1); }
    } catch (caught) { if (current === sequence.current) { setData(data); setError(caught instanceof Error ? caught.message : "분석을 완료하지 못했어요."); } setBusy(false); }
  }
  function sourceLabels(ids: string[]) {
    return ids.map(id => { const source = data?.sources.find(item => item.id === id); return source ? `${source.date} · ${source.childAlias} · ${source.playName}` : ""; }).filter(Boolean).join(" / ");
  }
  return <div className="weekly-story">
    <section className="panel" aria-label="주간 놀이 이야기 보관함">
      <h2 style={{ fontSize: "1rem", margin: "0 0 8px" }}>우리반 주간 놀이 이야기 보관함</h2>
      <p className="capture-note">최근 분석한 5주를 자동 보관해요. 같은 주는 최신 분석으로 바뀌며, 5주를 넘으면 가장 먼저 보관한 분석부터 정리해요.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {stories.map(story => <button key={story.id} className="button secondary" disabled={busy} aria-pressed={historyId === story.id}
          style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 18px", fontSize: 13, background: historyId === story.id ? "#e8f7f6" : undefined }}
          onClick={() => { setError(""); setData(null); setLoading(true); setDay(story.monday); setHistoryId(story.id); setReload(n => n + 1); }}>
          <BookOpen size={26} aria-hidden="true" /><strong>{story.monday} ~ {story.saturday.slice(5)}</strong><span>놀이 기록 {story.count}개 · 열어보기</span>
        </button>)}
      </div>
      {!stories.length && !historyError && <p className="capture-note">분석을 완료하면 이곳에 주간 이야기 아이콘이 생겨요.</p>}
      {historyError && <p role="alert">{historyError} <button className="button secondary" onClick={() => setHistoryRevision(n => n + 1)}>다시 불러오기</button></p>}
    </section>
    <section className="panel weekly-controls">
      <WeekPicker value={day} disabled={busy} onChange={monday => { if (historyId || monday !== weekRange(day).monday) { setHistoryId(null); setData(null); setError(""); setLoading(true); setDay(monday); } }} />
      <p className="capture-note">내 계정에 저장한 놀이 이야기의 종합 기록을 모아요. 별도 관찰일이 없는 기존 기록은 한국 시간의 저장일을 기준으로 불러옵니다. 반별 구분 정보는 없어, 이 계정에 저장된 기록을 함께 살펴봅니다.</p>
      <p role="status">{loading ? "이 주의 기록을 불러오고 있어요…" : data ? `${data.sources.length}개의 놀이 이야기${data.sources.length === 1 ? " · 한 건의 기록으로는 반복되는 주간 패턴을 판단하기 어려워요." : ""}` : ""}</p>
      {data && data.excluded > 0 && <p className="capture-note">원문 관찰이 없거나 종합 기록으로 저장하지 않은 기록, 중복 기록 {data.excluded}건은 분석에서 제외했어요.</p>}
      {data && data.sources.length === 0 && <p>선택한 주에 분석할 기록이 없어요. 다른 주를 선택하거나 <a href="/records/new">놀이 이야기를 작성해 저장</a>해 주세요.</p>}
      {!!data?.sources.length && <>
        <details className="weekly-sources"><summary>분석할 원본 기록 {data.sources.length}건 확인하기</summary>{data.sources.map(source => <article key={source.id}><h3>{source.date} · {source.playName}</h3><small>{source.childAlias} · {source.ageGroup}</small><p>{source.observation}</p><details><summary>세부 관찰과 교사의 지원·해석·계획</summary>{[...Object.entries(source.playSubcategoryNotes), ...Object.entries(source.teacherSupportNotes), ["친구와의 관계", source.peerInteraction], ["놀이와 배움", source.activityLearning], ["교사의 해석", source.teacherInterpretation], ["다음 지원 계획", source.supportPlan]].filter(([, value]) => value).map(([label, value], i) => <p key={i}><b>{label}</b><br />{value}</p>)}</details></article>)}</details>
        <label className="weekly-consent"><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} /><span>선택한 주의 관찰·지원·해석 기록을 OpenAI에 전달해 분석하는 데 동의합니다. 사진은 전송하지 않으며, 결과는 실제 관찰과 비교해 검토하겠습니다.</span></label>
        <button className="button primary" disabled={!accepted || busy || loading} onClick={analyze}><Sparkles size={17} aria-hidden="true" />{busy ? "놀이의 흐름을 살펴보고 있어요…" : data.result ? "다시 분석하기" : "이 주의 놀이 분석하기"}</button>
      </>}
      {error && <div role="alert"><p className="error">{error}</p>{!data && <button className="button secondary" onClick={() => { setError(""); setLoading(true); setReload(n => n + 1); }}>기록 다시 불러오기</button>}</div>}
    </section>
    {busy && data && <RecordAssembly mode="weekly" sources={data.sources} weeklyResult={data.result} onComplete={finishAssembly} />}
    {!busy && data?.result && <section id="weekly-record-result" tabIndex={-1} className="weekly-results record-unfold-result" aria-label="주간 분석 결과">
      <header className="library-section-heading"><div><h2>한 주의 놀이 흐름</h2><p>{data.range.monday} ~ {data.range.saturday} · {data.sources.length}개 기록</p></div><WeeklyWordDownload content={{ range: data.range, sources: data.sources, result: data.result }} /></header>
      <p className="capture-note">AI가 정리한 교사 검토용 내용입니다. 보관함에서 당시 분석과 원본 내용을 다시 확인하고 Word로 내려받을 수 있어요. 다시 분석하면 현재 저장된 놀이 기록을 기준으로 갱신해요.</p>
      {data.saveError && <p className="error" role="alert">{data.saveError}</p>}
      <section className="panel"><h3>이번 주에 드러난 흥미</h3><p>{data.result.overview}</p>{data.result.interests.map((item, i) => <div className="weekly-interest" key={i}><h4>{item.interest}</h4><p>{item.evidence}</p><small>근거 · {sourceLabels(item.sourceIds)}</small></div>)}</section>
      {data.result.plays.map((play, i) => <article className="panel weekly-play" key={i}><span className="section-kicker">놀이 {i + 1}</span><h2>{play.title}</h2><h3>교사가 관찰한 실제 장면</h3><ol className="weekly-timeline">{play.scenes.map((scene, j) => <li key={j}><small>{sourceLabels(scene.sourceIds)}</small><p>{scene.observation}</p></li>)}</ol>{[["교사의 지원", play.teacherSupport], ["교사의 해석", play.teacherInterpretation], ["다음 놀이 지원 계획", play.nextSupportPlan]].map(([title, content]) => <section key={title}><h3>{title}</h3><p>{content}</p></section>)}<small>관련 기록 · {sourceLabels(play.sourceIds)}</small></article>)}
      <p className="capture-note">{data.result.limitations}</p>
      <WeeklySupportPlanner key={`${data.range.monday}-${reload}`} monday={data.range.monday} sources={data.sources} result={data.result} onSaved={() => setPlansRevision(n => n + 1)} />
    </section>}
    <SavedSupportPlans revision={plansRevision} />
  </div>;
}
