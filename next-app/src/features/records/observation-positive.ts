import { checkObservation } from "./observation-check";

export function observationPositive(value: string, context: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || context === "계획" || checkObservation(text, context).length) return null;
  const action = text.match(/응시|바라보|만지|만졌|만짐|살펴|쌓|두드|가리|굴리|집어|옮기|옮겼|말했|말함|미소|웃/);
  const evidence: string[] = [];
  const duration = text.match(/\d+\s*(?:[~～-]\s*\d+)?\s*(?:분|초|시간|번|회|개)/);
  const expression = text.match(/미소|웃음|웃었|찡그|고개를|눈을|몸을|손을 뻗/);
  if (context === "관찰") {
    if (!action) return null;
    evidence.push(`‘${action[0]}’처럼 직접 확인할 수 있는 행동을 적었어요.`);
    if (duration) evidence.push(`‘${duration[0]}’으로 시간·횟수·양을 구체적으로 나타냈어요.`);
    if (expression) evidence.push(`‘${expression[0]}’라는 표정·몸짓도 담아 장면을 이해하기 좋아요.`);
  } else {
    const descriptions: Record<string, [RegExp, string]> = {
      "관심의 시작": [/다가|바라|가리|선택|집어|꺼내|손을/, "놀이를 시작할 때 보인 관심과 행동을 적었어요."],
      "탐색과 반복": [/반복|다시|계속|바꾸|비교/, "탐색을 반복하거나 방법을 바꾼 모습을 적었어요."],
      "표현과 구성": [/말|설명|그리|만들|쌓|배치|조합|흉내/, "아이의 표현이나 구성 방법을 적었어요."],
      "관계와 상호작용": [/대답|반응|따라|주고|받|말|기다/, "상호작용의 상대와 주고받은 과정을 함께 적었어요."],
      "확장과 심화": [/새로|추가|바꾸|달라|변형|연결|이어/, "앞선 놀이에서 더해지거나 달라진 시도를 적었어요."],
      "시간 지원": [/기다|시간|일과|연장|재개/, "시간 조정과 그 뒤 이어진 놀이를 함께 적었어요."],
      "공간 지원": [/자리|공간|동선|옮|배치|넓/, "어떤 공간이나 배치를 조정했는지 적었어요."],
      "자료 지원": [/제공|제시|추가|교체|놓|꺼내|준/, "자료를 제공한 방법, 선택한 근거와 사용 모습을 함께 적었어요."],
      "상호작용 지원": [/질문|말|되짚|기다|경청|반응/, "교사의 반응과 아이의 후속 반응을 함께 적었어요."],
      "해석": [/생각했|해석했|이해했|보았/, "교사의 생각임을 드러내어 관찰 사실과 해석을 구분할 단서를 주었어요."],
    };
    const rule = descriptions[context]; const match = rule && text.match(rule[0]);
    if (!match || /않|없|못했/.test(text)) return null;
    evidence.push(`‘${match[0]}’라는 표현으로 ${rule[1]}`);
  }
  return evidence.join(" ");
}
