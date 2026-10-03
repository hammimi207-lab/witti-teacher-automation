"use client";
import { FairyImage } from "./fairy-image";
import { useEffect, useState } from "react";
import { AI_CONSENT_TEXT, AI_CONSENT_VERSION } from "./ai-consent";
import { applySupportSuggestion, missingSupportContext, supportCurriculum, supportRequestSchema, supportResponseSchema, type SupportReview } from "./support-suggestions";

export type SupportReviewContext = {
  ageGroup: string; curriculumAreas: string[]; observation: string; interpretation: string;
  aiAccepted: boolean; onConsent: (accepted: boolean) => void;
  onApply: (value: string) => void; limit: number;
};
export function SupportPlanReview({ context, plan, active }: { context: SupportReviewContext; plan: string; active: boolean }) {
  const [response, setResponse] = useState<{ key: string; data?: SupportReview; error?: string }>({ key: "" });
  const [dismissed, setDismissed] = useState("");
  const [retry, setRetry] = useState(0);
  const [applyError, setApplyError] = useState("");
  const key = JSON.stringify({ ageGroup: context.ageGroup, curriculumAreas: context.curriculumAreas, observation: context.observation, interpretation: context.interpretation, plan });
  const parsed = supportRequestSchema.safeParse(JSON.parse(key));
  const clarification = parsed.success ? missingSupportContext(parsed.data) : null;
  const shouldRequest = active && !!plan.trim() && dismissed !== key && context.aiAccepted && parsed.success && !clarification;
  useEffect(() => {
    if (!shouldRequest) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await fetch("/api/records/support-suggestions", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ input: JSON.parse(key), consent: { version: AI_CONSENT_VERSION, aiAccepted: true, photoAccepted: false } }),
        });
        const payload = await result.json();
        if (!result.ok) throw new Error(payload.error || "지원 계획을 살펴보지 못했어요.");
        const data = supportResponseSchema.parse(payload.data);
        if (!controller.signal.aborted) setResponse({ key, data });
      } catch (caught) {
        if (!controller.signal.aborted) setResponse({ key, error: caught instanceof Error ? caught.message : "다시 시도해 주세요." });
      }
    }, 600);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [shouldRequest, key, retry]);
  if (!active || !plan.trim() || dismissed === key) return null;
  const review = clarification || (response.key === key ? response.data : undefined);
  const error = response.key === key ? response.error : undefined;
  const references = parsed.success ? supportCurriculum(parsed.data.ageGroup, parsed.data.curriculumAreas) : [];
  function apply(text: string, mode: "append" | "replace") {
    try {
      const next = applySupportSuggestion(plan, text, mode, context.limit);
      context.onApply(next); setDismissed(key); setApplyError("");
    } catch (caught) { setApplyError(caught instanceof Error ? caught.message : "반영하지 못했어요."); }
  }
  return <aside className="support-plan-review" aria-label="지원 계획 함께 살펴보기">
    <div className="support-review-heading"><span aria-hidden="true"><FairyImage /></span><div><strong>{review?.status === "keep" ? "지금 계획을 이어가도 좋겠어요" : review?.status === "clarify" || !parsed.success ? "이 장면을 조금 더 알려 주세요" : "이런 방향은 어떨까요?"}</strong><p>지원 계획 함께 살펴보기</p></div></div>
    {!parsed.success ? <p>연령과 교육과정 영역을 선택하고, 아이가 한 행동이나 말을 먼저 적어 주세요.</p> : clarification ? <p>{clarification.question}</p> : !context.aiAccepted ? <label className="support-review-consent"><input type="checkbox" checked={false} onChange={event => context.onConsent(event.target.checked)} /><span>{AI_CONSENT_TEXT}</span></label> : error ? <div role="alert"><p>{error}</p><button type="button" className="button secondary" onClick={() => { setResponse({ key: "" }); setRetry(value => value + 1); }}>다시 살펴보기</button></div> : !review ? <p role="status">관찰·해석과 교육과정 근거를 함께 살펴보고 있어요…</p> : <>
      <p>{review.message}</p>{review.question && <p>{review.question}</p>}
      {review.suggestions.map((suggestion, index) => {
        const reference = references.find(item => item.id === suggestion.curriculumId);
        return <article key={index} className="support-suggestion"><h4>{suggestion.title}</h4><p>{suggestion.plan}</p>
          <details><summary>관찰·해석과 교육과정 근거 보기</summary><p><b>관찰:</b> {suggestion.observationEvidence}</p><p><b>교사의 해석:</b> {suggestion.interpretationEvidence}</p><p>{suggestion.reason}</p>{reference && <p><b>{reference.framework} · {reference.area}</b><br />{reference.summary}<br /><a href={reference.source} target="_blank" rel="noreferrer">공식 고시문 {reference.section} 확인</a><small>교육과정 내용을 풀어 쓴 참고 안내입니다.</small></p>}</details>
          <div className="support-review-actions"><button type="button" className="button secondary" onClick={() => apply(suggestion.plan, "append")}>제안 더하기</button><button type="button" className="button secondary" onClick={() => apply(suggestion.plan, "replace")}>제안으로 바꾸기</button></div>
        </article>;
      })}
    </>}
    {applyError && <p role="alert">{applyError}</p>}
    <button type="button" className="button secondary" onClick={() => setDismissed(key)}>내 계획 유지</button>
  </aside>;
}
