"use client";
import { FairyImage } from "./fairy-image";
import type { SupportObservationContext } from "./teacher-support-hints";
import { FairyComment } from "./fairy-comment";
import { useId, useState, type ComponentProps } from "react";
import { normalizeObservation, reflectionHints } from "./reflection-hints";
import { revisionExplanation } from "./revision-explanation";
import { supportPlanFeedback } from "./support-plan-feedback";
import { revisionDiff } from "./revision-diff";
import { observationPositive } from "./observation-positive";
import { SupportPlanReview, type SupportReviewContext } from "./support-plan-review";

export function CheckedTextarea({ context = "관찰", ageGroup = "", childAlias, supportObservation, requiredHint, missingHint, supportReview, ...props }: ComponentProps<"textarea"> & { context?: string; ageGroup?: string; childAlias?: string; supportObservation?: SupportObservationContext; requiredHint?: string; missingHint?: string; supportReview?: SupportReviewContext }) {
  const id = useId();
  const [checked, setChecked] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const value = String(props.value ?? "");
  const [visited, setVisited] = useState(false);
  const guide = missingHint || (visited && !value.trim() ? requiredHint : undefined);
  const isPlan = context === "계획";
  const plan = !supportReview && isPlan && checked === normalizeObservation(value) ? supportPlanFeedback(value) : null;
  const revised = !!baseline && !!value.trim() && checked === normalizeObservation(value) && checked !== normalizeObservation(baseline);
  const positive = !supportObservation && !supportReview && !isPlan && checked === normalizeObservation(value) ? observationPositive(value, context) : null;
  // Recheck unresolved questions after an edit; an edit alone is not evidence
  // that the missing observation was supplied.
  const hints = !supportReview && !isPlan && checked === normalizeObservation(value) ? reflectionHints(value, context, ageGroup, childAlias, supportObservation) : [];
  const explanation = revised ? revisionExplanation(baseline!, value, context) : null;
  const hasComment = !!((supportReview && checked === normalizeObservation(value) && value.trim()) || plan || positive || explanation || hints.length);
  const comment = <>
    {supportReview && <SupportPlanReview context={supportReview} plan={value} active={checked === normalizeObservation(value)} />}
    {revised && <div className="revision-comparison" aria-label="수정한 내용 비교"><b>수정한 내용</b><p className="revision-legend">기존 내용은 검정색, 추가·변경한 어절은 하늘색 밑줄로 표시합니다.</p><p className="revision-text">{revisionDiff(baseline!, value).map((part, index) => <span key={index} className={part.added ? "revision-added" : undefined}>{part.text}</span>)}</p></div>}
    {plan && <div id={id} className={`observation-hints${plan.positive ? " revision-feedback" : ""}`} role="status"><b>{plan.positive ? "지원 계획의 좋은 점" : "지원 계획을 구체화하는 질문"}</b><p>{plan.text}</p><small>앞으로 실행할 환경 구성이나 지원 계획을 중심으로 살펴보는 안내입니다.</small></div>}
    {positive && <div id={id} className="observation-hints revision-feedback" role="status"><b>입력 안내에 맞게 잘 작성했어요.</b><p>{positive}</p><small>작성한 표현을 살펴본 안내입니다. 실제로 관찰한 내용과 일치하는지도 확인해 주세요.</small></div>}
    {explanation && <div id={`${id}-improved`} className="observation-hints revision-feedback" role="status"><b>{explanation.items.length ? "이렇게 보완되었어요" : "수정한 내용을 살펴봤어요"}</b>{explanation.items.length ? <ul>{explanation.items.map(item => <li key={item.why}><strong>‘{item.evidence}’</strong> — {item.why}</li>)}</ul> : <p>{explanation.fallback}</p>}<small>{/지원|계획|연계/.test(context) ? "처음 작성한 문장과 비교한 안내입니다. 작성한 지원 내용과 일치하는지도 확인해 주세요." : "처음 작성한 문장과 비교한 안내입니다. 추가한 내용이 실제 관찰과 일치하는지도 확인해 주세요."}</small></div>}
    {hints.length > 0 && <div id={`${id}-hints`} className="observation-hints" role="status"><b>다음 관찰에 도움이 되는 코멘트</b><ul>{hints.map(hint => <li key={hint.topic}><strong>{hint.topic}</strong><p>{hint.question}</p><p>{hint.why}</p>{hint.basis && <small><a href={hint.source} target="_blank" rel="noreferrer">{hint.basis}</a></small>}</li>)}</ul><small>기억나는 장면 하나만 보완해도 좋아요. 확인하지 못한 내용은 채우지 말고 다음 놀이에서 살펴보세요.</small></div>}
  </>;
  return <FairyComment available={hasComment} comment={comment}>
    <div className={`checked-input-shell${guide ? " needs-check" : ""}`}>
    <textarea {...props} placeholder={guide ? "" : props.placeholder} aria-invalid={!!guide} aria-describedby={[props["aria-describedby"], guide ? `${id}-required` : null].filter(Boolean).join(" ") || undefined} onBlur={event => {
      setVisited(true);
      const next = normalizeObservation(event.currentTarget.value);
      setChecked(next);
      if (!next) setBaseline(null);
      else if (baseline === null) setBaseline(event.currentTarget.value);
      props.onBlur?.(event);
    }} onKeyUp={event => {
      if (event.key === "Enter" && !event.nativeEvent.isComposing) {
        const text = event.currentTarget.value;
        setChecked(normalizeObservation(text));
        if (text.trim() && baseline === null) setBaseline(text);
      }
      props.onKeyUp?.(event);
    }} onCompositionEnd={event => {
      if (event.currentTarget.value.includes("\n")) {
        setChecked(normalizeObservation(event.currentTarget.value));
        if (event.currentTarget.value.trim() && baseline === null) setBaseline(event.currentTarget.value);
      }
      props.onCompositionEnd?.(event);
    }} />
    {guide && <div className={`input-fairy-guide${value.trim() ? " with-text" : ""}`} id={`${id}-required`} role="status"><span aria-hidden="true"><FairyImage /></span><div><b>확인이 필요해요</b><p>{guide}</p></div></div>}
    </div>
  </FairyComment>;
}
