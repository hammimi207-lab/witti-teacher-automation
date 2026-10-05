import { normalizeObservation, reflectionHints } from "./reflection-hints";
import { revisionDiff } from "./revision-diff";

// 실제로 제시했던 질문에 연결되는 추가 표현만 설명합니다. 작성 사실의 진위는 판정하지 않습니다.
export function questionRevisionFeedback(before: string, after: string, context: string) {
  if (!before.trim() || !after.trim() || normalizeObservation(before) === normalizeObservation(after)) return [];
  const rules: Record<string, { pattern: RegExp; why: string }> = {
    "탐색 방법의 변화": { pattern: /반복(?:적으로)?|다시|여러\s*번|계속|바꾸|비교/, why: "무엇을 반복하거나 방법을 바꾸었는지 묻는 질문에 대해, 탐색이 어떻게 이어졌는지를 덧붙였어요." },
    "관심의 시작": { pattern: /다가|바라|가리|선택|집어|꺼내|손을/, why: "처음 관심을 보인 행동을 덧붙여 놀이를 시작한 모습을 알 수 있어요." },
    "표현한 방식": { pattern: /말했|말함|말하|설명|그리|그렸|만들|쌓|배치|조합|흉내|[“「"][^”」"]+[”」"]/, why: "아이의 말이나 표현·구성 방법을 덧붙여 생각을 어떻게 드러냈는지 알 수 있어요." },
    "상호작용의 상대": { pattern: /친구|교사|또래/, why: "상대를 명시해 누구와 상호작용했는지 분명해졌어요." },
    "주고받은 과정": { pattern: /대답|반응|따라|주고|받|말했|기다/, why: "상대의 행동에 이어진 말이나 행동을 적어 주고받은 과정을 보완했어요." },
    "앞선 놀이와의 차이": { pattern: /이어|새로|추가|바꾸|달라|변형|연결/, why: "새롭게 더한 시도나 달라진 방법을 적어 앞선 놀이와의 차이를 보완했어요." },
    "시간 조정": { pattern: /기다|시간|일과|연장|중단|재개|\d+\s*분/, why: "기다림이나 시간 조정 방법을 적어 교사가 어떻게 지원했는지 구체화했어요." },
    "시간 지원 이후": { pattern: /계속|이어|다시|재개|시작/, why: "지원 이후 놀이가 이어진 모습을 덧붙였어요." },
    "공간의 변화": { pattern: /자리|동선|옮|배치|넓|공간/, why: "바꾼 공간이나 배치를 적어 환경을 어떻게 조정했는지 보완했어요." },
    "자료 제공 방식": { pattern: /제공|제시|추가|교체|놓|꺼내|주었|준/, why: "자료를 제공한 방법을 덧붙여 교사가 실제로 한 지원을 구체화했어요." },
    "자료 선택의 근거": { pattern: /관심|시도|요청|찾|선택|요구/, why: "자료 선택과 관련된 아이의 관심이나 시도를 덧붙였어요." },
    "자료를 사용한 모습": { pattern: /만지|만졌|만짐|잡|살펴|두드|굴리|쌓|사용/, why: "자료를 준 사실에 더해 아이가 자료를 사용한 행동을 적었어요." },
    "교사의 반응": { pattern: /질문|되짚|기다|말했|경청|대답/, why: "교사가 어떤 말이나 행동으로 반응했는지 덧붙였어요." },
    "아이의 후속 반응": { pattern: /대답|웃|고개|미소|손을|말했/, why: "지원 뒤 아이가 보인 말·몸짓·표정을 덧붙였어요." },
    "비언어적 표현": { pattern: /미소|웃|찡그|고개|눈을|몸을|손을|입꼬리/, why: "표정이나 몸짓을 적어 느낌을 설명하는 데 그치지 않고 눈으로 본 반응을 보완했어요." },
    "주요 관찰 장면": { pattern: /응시|만지|만졌|만짐|쌓|두드|가리|굴리|집어|옮|바라/, why: "구체적인 행동을 적어 관찰 장면의 근거를 보완했어요." },
    "짧은 기록": { pattern: /응시|만지|만졌|만짐|쌓|두드|가리|굴리|집어|옮|바라/, why: "단순히 길이를 늘리지 않고 실제 행동을 덧붙여 장면을 구체화했어요." },
    "흥미": { pattern: /다시|선택|응시|바라|집어|손을/, why: "관심을 보여 주는 선택이나 행동을 덧붙였어요." },
    "요구": { pattern: /가리|내밀|요청|달라고|[“「"][^”」"]+[”」"]/, why: "원하는 것을 표현한 말이나 몸짓을 적어 요구의 근거를 보완했어요." },
    "기록 돌아보기": { pattern: /해석했|생각했|이해했|보았|보임/, why: "교사의 해석임을 나타내는 표현을 덧붙여 관찰 사실과 구분할 단서를 주었어요." },
  };
  const sentences = after.match(/[^.!?\n]+[.!?]?/g) || [after];
  const changes = revisionDiff(before, after).filter(part => part.added).map(part => part.text).join(" ");
  return reflectionHints(before, context).flatMap(hint => {
    const rule = rules[hint.topic];
    if (!rule || !rule.pattern.test(changes)) return [];
    const evidence = sentences.find(sentence => rule.pattern.test(sentence) && !normalizeObservation(before).includes(normalizeObservation(sentence)) && !/(?:않|없|못했|아니)/.test(sentence));
    if (!evidence) return [];
    return [{ topic: hint.topic, question: hint.question, evidence: evidence.trim(), why: rule.why }];
  });
}

export function revisionFeedback(before: string, after: string, context: string) {
  if (!before.trim() || !after.trim() || normalizeObservation(before) === normalizeObservation(after)) return [];
  const planned = /지원|계획|연계/.test(context);
  const rules = [
    { pattern: /\d+\s*(?:[~～-]\s*\d+)?\s*(?:분|초|시간|번|회|개)/, why: "시간·횟수·양을 구체적으로 적어 장면을 더 분명하게 이해할 수 있어요." },
    { pattern: /응시|바라보|만지|만졌|쌓|두드|가리키|굴리|집어|옮기|옮겼/, why: planned ? "구체적인 행동을 적어 지원 방식을 이해하기 쉬워졌어요." : "실제로 보인 행동을 덧붙여 관찰의 근거가 더 분명해졌어요." },
    { pattern: /미소|웃었|웃음|찡그|고개를|눈을|몸을|손을 뻗/, why: "표정이나 몸짓을 덧붙여 말 이외의 표현도 살펴볼 수 있어요." },
    { pattern: /[“"「][^”"」]+[”"」]/, why: "직접 들은 말을 인용해 아이가 표현한 내용을 구체적으로 전달할 수 있어요." },
  ];
  if (context === "관계와 상호작용") rules.push({ pattern: /친구|교사|또래/, why: "상호작용의 상대를 적어 누구와 주고받은 장면인지 분명해졌어요." });
  if (planned) rules.push({ pattern: /제공|추가|교체|배치|기다려|질문/, why: "교사가 한 지원 방법을 명시해 지원 내용을 구체적으로 이해할 수 있어요." });
  if (context === "해석") rules.push({ pattern: /보았|보임|이해했|해석했|생각했/, why: "교사의 해석임을 드러내는 표현을 사용해 관찰 사실과 구분하기 쉬워졌어요." });
  return rules.flatMap(({ pattern, why }) => {
    const matcher = new RegExp(pattern.source, "g");
    const previous = new Set(before.match(matcher) || []);
    const added = (after.match(matcher) || []).find(value => !previous.has(value));
    return added ? [{ evidence: added, why }] : [];
  });
}
