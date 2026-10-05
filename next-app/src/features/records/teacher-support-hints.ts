export type SupportObservationContext = { playName: string; observation: string };

const supportQuestions: Record<string, string> = {
  "시간 지원": "놀이 시간이 더 필요할 때 어떻게 시간을 지원했나요? 정리 시간을 늦추거나 충분히 기다려 주었는지, 일과를 조정하거나 나중에 이어 할 시간을 마련했는지 실제로 한 방법을 적어 주세요. 정확한 시간을 재지 않았다면 분 단위로 채우지 않아도 돼요.",
  "공간 지원": "교실 안의 공간을 조정했나요, 교실 밖의 공간을 활용했나요? 교실 안이라면 교구장 이동·책상 배치·놀이 자리와 동선 조정 중 실제로 바꾼 내용을, 교실 밖이라면 어린이집 공용 공간·복도·유희실·바깥 공간 등 어디를 어떻게 활용했는지 구분해 적어 주세요. 둘 다 이용했다면 각각 적어 주세요.",
  "자료 지원": "이 놀이에서 아이가 하던 시도나 관심을 보고 어떤 자료를 추가로 지원했나요? 자료의 이름과 제공한 방법, 그 자료를 선택한 계기를 연결해 주세요. 새 자료를 주지 않고 기존 자료를 보관하거나 다시 쓸 수 있게 했다면 그 내용을 적어도 좋아요.",
  "상호작용 지원": "이 놀이를 할 때 아이의 어떤 말이나 행동에 교사가 반응했나요? 교사가 실제로 던진 질문이나 들려준 말, 기다림·고개 끄덕임·함께 참여하기처럼 보여 준 반응을 그 상황과 함께 구체적으로 적어 주세요.",
};

// Only treat an observable action after a support/sequence cue as a response.
// A child's name or the word '아이' alone is not evidence of a reaction.
export function hasSupportResponse(text: string) {
  const after = text.match(/(?:주었어요|주었습니다|주었다|줬어요|해주자|해 주자|하자|하니|했더니|한 뒤|한 후|이후|그 뒤|그러자|주었고|주고 나서)([\s\S]*)/);
  if (!after) return false;
  return /(?:웃|미소|고개|끄덕|어깨|으쓱|우쭐|말했|말하며|이야기하|이야기 하|달라고|가리|손을|집어|만지|사용|쌓|옮기|옮겼|다시|이어|놀이했|놀이를 했|거절|떠났|참여하지|반응이 없)/.test(after[1]);
}

export function teacherSupportHints(text: string, context: string, source: SupportObservationContext) {
  const question = supportQuestions[context];
  if (!question) return null;
  const observed = source.observation.trim().split(/\r?\n/).find(line => line.trim())?.trim();
  const play = source.playName.trim() ? `‘${source.playName.trim()}’ 놀이` : "관찰한 놀이";
  const evidence = observed ? `관찰에 적어 주신 “${observed.length > 140 ? observed.slice(0, 140) + "…" : observed}” 장면을 떠올려 보세요. ` : "";
  const reaction = hasSupportResponse(text)
    ? "지원 뒤 아이의 반응도 적어 주셨어요. 그 반응이 앞서 적은 교사의 지원과 자연스럽게 연결되는지 살펴봐 주세요."
    : "지원한 뒤 아이는 어떻게 반응했나요? 이어진 행동·말·몸짓·표정이나 놀이의 변화를 함께 적어 주세요. 아직 반응을 관찰하지 못했다면 만들어 채우지 않아도 돼요.";
  return [{ topic: `${context} 함께 살펴보기`, question: `${play}에 대한 지원을 살펴볼게요. ${evidence}${question}\n\n${reaction}` }];
}
