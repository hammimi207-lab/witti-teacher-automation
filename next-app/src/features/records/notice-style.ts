export const TEACHER_STYLES = [
  { label: "팩트 중심형", description: "실제 말과 행동을 담백하게", guidance: "실제 말과 행동, 교사의 지원을 담백하고 명료하게 전달하세요. 간결함을 이유로 발화나 장면을 생략하지 마세요." },
  { label: "따뜻한 감성형", description: "구체적인 장면을 따뜻하게", guidance: "교사의 세심한 돌봄과 구체적인 장면이 드러나는 따뜻한 일상어로 쓰세요. 입력에 없는 감정이나 감상은 덧붙이지 마세요." },
  { label: "이모티콘 활용형", description: "자연스러운 글에 이모지 1~3개", guidance: "자연스러운 일상어에 이모지 1~3개를 절제해서 사용하세요. 직접 인용 안이나 갈등·건강·걱정 상황 및 공지에는 이모지를 넣지 마세요." },
  { label: "전문적 설명형", description: "관찰과 배움의 의미를 알기 쉽게", guidance: "관찰과 교사가 입력한 해석, 지원의 관계를 부모가 이해하기 쉬운 말로 설명하세요. 보고서 문체나 새로운 발달 평가를 추가하지 마세요." },
] as const;

export function noticeStyleGuidance(style?: string) {
  const selected = TEACHER_STYLES.find(item => item.label === style);
  return `\n[교사의 알림장 기록 스타일]\n${selected ? `${selected.label}: ${selected.guidance}` : "따뜻하고 자연스럽게 전달하세요."}\n스타일은 표현 방식에만 적용합니다. 아이의 직접 발화와 구체적인 장면은 축약하지 마세요. 보호자 전달 기준도 함께 적용하고, 보호자 유형명과 기록 스타일명은 부모용 본문에 넣지 마세요.\n${style === "이모티콘 활용형" ? "이번 전자알림장 본문에는 위 기준에 따라 이모지를 허용합니다." : "전자알림장 본문에는 이모지를 넣지 마세요."}`;
}
