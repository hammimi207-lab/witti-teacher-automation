import { revisionDiff } from "./revision-diff";
import { questionRevisionFeedback, revisionFeedback } from "./revision-feedback";

export function revisionExplanation(before: string, after: string, context: string) {
  const changes = revisionDiff(before, after).filter(part => part.added && part.text.trim()).map(part => part.text).join(" ");
  const sentences = after.match(/[^.!?\n]+[.!?]?/g) || [after];
  const supported = sentences.filter(sentence => !/(?:않|없|못했|아니)/.test(sentence)).join(" ");
  const items = [
    ...(context === "계획" ? [] : questionRevisionFeedback(before, after, context)),
    ...revisionFeedback(before, supported, context),
  ].map(({ evidence, why }) => ({ evidence, why }));
  const planned = /지원|계획|연계/.test(context);
  const rules = [
    { pattern: /들어\s*보|들어보|들어\s*올|만져|살펴|반복|비교/, why: planned ? "자료를 어떻게 다룰 수 있도록 도왔는지 적어 지원 방식이 더 구체적으로 드러나요." : "대상을 살펴본 방법이나 이어진 행동을 덧붙여 탐색 과정을 이해하기 쉬워졌어요." },
    ...(planned ? [
      { pattern: /자유롭게|스스로|직접|선택/, why: "아이가 스스로 탐색하거나 선택할 수 있도록 한 점을 적어, 지원에서 아이의 주도성을 어떻게 고려했는지 알 수 있어요." },
      { pattern: /준비|마련|놓아|놓고|넓혀/, why: "자료나 환경을 마련하는 방법을 적어 지원을 어떻게 실행할지 더 분명하게 표현했어요." },
    ] : []),
  ];
  for (const rule of rules) {
    if (!rule.pattern.test(changes)) continue;
    const evidence = sentences.find(sentence => rule.pattern.test(sentence) && !before.includes(sentence.trim()) && !/(?:않|없|못했|아니)/.test(sentence));
    if (evidence) items.push({ evidence: evidence.trim(), why: rule.why });
  }
  const unique = items.filter((item, index) => items.findIndex(other => other.why === item.why) === index);
  return { items: unique, fallback: changes ? `‘${changes}’ 표현을 추가하거나 바꾸었어요. 달라진 표현은 확인했지만, 이 수정만으로 ${planned ? "지원 방법" : "관찰 근거"}이 더 구체적이 되었다고 판단하기는 어려워요.` : "기존 표현의 일부를 삭제해 문장을 정리했어요. 필요한 내용까지 빠지지 않았는지 확인해 주세요." };
}
