export function supportPlanFeedback(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const method = /준비|제공|배치|옮기|넓히|구성|추가|교체|기다|질문|함께|조정|마련/.test(text);
  const concrete = /폼폼|공을|공이|블록|종이|물감|그림책|바구니|점토|천을|상자|모래|물통|매트|책상|의자|창가|바닥|놀이 공간|휴식 공간|동선|\d+\s*분|[“"].+?[”"]/.test(text);
  const purpose = /하도록|할 수|이어|연결|비교|탐색|쌓|굴리|만지|살펴|선택|쉴|쉬도/.test(text);
  if (method && concrete && purpose) return { positive: true, text: "준비할 자료나 환경과 아이가 이어갈 활동을 함께 적어, 다음 지원을 어떻게 실행할지 이해하기 쉬워요." };
  if (!method) return { positive: false, text: "다음 놀이에서 교사가 무엇을 준비하거나 어떻게 도울 예정인가요? 환경 구성이나 지원 방법을 적어주세요." };
  if (!concrete) return { positive: false, text: "준비할 자료나 바꿀 공간, 교사가 할 말·행동을 조금 더 구체적으로 적어볼까요? 해당하는 지원 한 가지면 충분해요." };
  return { positive: false, text: "준비한 자료나 환경으로 어떤 놀이가 이어지도록 도울 예정인가요? 지원 방법과 이어갈 활동을 연결해 적어주세요." };
}
