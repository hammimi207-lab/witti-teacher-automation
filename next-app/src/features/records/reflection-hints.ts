import { checkObservation } from "./observation-check";
import { curriculumObservationGuidance } from "./curriculum-observation-guidance";
import { teacherSupportHints, type SupportObservationContext } from "./teacher-support-hints";

export const normalizeObservation = (value: string) => value.replace(/\s+/g, " ").trim();

export function reflectionHints(value: string, context: string, ageGroup = "", childAlias?: string, supportObservation?: SupportObservationContext) {
  const text = normalizeObservation(value);
  if (!text) return [];
  const supportHints = supportObservation ? teacherSupportHints(text, context, supportObservation) : null;
  const hints = supportHints ?? (context === "해석"
    ? [{ topic: "관찰과 해석", question: "이 해석을 떠올리게 한 아이의 말이나 행동은 무엇인가요? 직접 본 장면과 연결하되, 확인되지 않은 의도나 능력을 사실로 단정하지 않아도 돼요." }]
    : checkObservation(text, context));
  if (!hints.length && ["지원", "연계"].includes(context)) hints.push({ topic: "다음 지원", question: "이 계획은 아이의 어떤 관심이나 시도에서 이어지나요? 이미 해 본 지원과 앞으로 해 볼 지원을 구분해 적어 주세요." });
  return hints.slice(0, 2).map(hint => ({
    ...hint,
    ...(context === "관찰" && hint.topic === "흥미" && childAlias !== undefined
      ? { question: `${childAlias.trim() ? `“${childAlias.trim()}”` : "아이"}에 대한 기록을 작성하셨나요? 흥미를 느꼈다고 판단한 행동을 적어 주세요.` }
      : {}),
    ...(["0세", "1세"].includes(ageGroup) && hint.topic === "아이의 실제 발화"
      ? { question: "아이가 눈길·몸짓·옹알이로 반응한 장면이 있나요? 말한 문장이 없어도 괜찮아요. 기억나는 표현과 그때의 상황 하나를 남겨 주세요." }
      : {}),
    ...curriculumObservationGuidance(hint.topic, ageGroup),
  }));
}
