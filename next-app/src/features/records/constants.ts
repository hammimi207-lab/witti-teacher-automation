export const AGES = ["0세", "1세", "2세", "3세", "4세", "5세"] as const;
// 일지 구현과 기존 저장 기록은 보존하고 새 작성 선택지만 숨깁니다.
export const RECORD_TYPES = ["놀이 이야기", "알림장"] as const;
// 2024 revised curriculum (effective March 2025): five areas. Legacy saved
// records keep their original labels through the string-based input schema.
export const STANDARD_AREAS = ["신체운동·건강", "의사소통", "사회관계", "예술경험", "자연탐구"] as const;
export const NURI_AREAS = ["신체운동·건강", "의사소통", "사회관계", "예술경험", "자연탐구"] as const;
export const PARENT_TYPES = ["일반형", "예민형", "공격형", "불안형"] as const;
export const PLAY_STORY_DETAILS = ["관심의 시작", "탐색과 반복", "표현과 구성", "관계와 상호작용", "확장과 심화"] as const;
export const TEACHER_SUPPORTS = ["시간 지원", "공간 지원", "자료 지원", "상호작용 지원"] as const;

export const PLAY_DETAIL_GUIDANCE: Record<string, string> = {
  "관심의 시작": "아이가 무엇에 처음 관심을 보였고, 어떤 행동이나 말로 놀이를 시작했는지 적어 주세요. 시선이 머문 대상, 다가가거나 손을 뻗은 행동 등 직접 관찰한 시작 장면을 중심으로 기록해 주세요.",
  "탐색과 반복": "아이가 재료나 대상을 어떤 방법으로 살펴보고 다루었는지 적어 주세요. 반복한 행동, 방법을 바꾸어 시도한 과정, 그때 나타난 반응이나 변화를 관찰한 범위에서 기록해 주세요.",
  "표현과 구성": "아이가 생각이나 경험을 말, 몸짓, 그림, 만들기 등으로 어떻게 표현했는지 적어 주세요. 재료를 배치하거나 조합한 과정과 만들어 낸 형태, 아이가 직접 설명한 내용을 중심으로 기록해 주세요.",
  "관계와 상호작용": "놀이 중 아이가 친구나 교사와 어떤 말과 행동을 주고받았는지 적어 주세요. 제안과 반응, 역할을 나누거나 의견을 조율한 과정 등 실제로 확인한 상호작용을 기록해 주세요.",
  "확장과 심화": "처음의 놀이가 어떤 계기로 달라지거나 더 깊어졌는지 적어 주세요. 새로운 재료·방법·역할·규칙이 더해진 과정이나 아이가 궁금한 점을 더 알아보려 한 시도를 이전 장면과 연결해 기록해 주세요.",
};

export const TEACHER_SUPPORT_GUIDANCE: Record<string, string> = {
  "시간 지원": "아이의 어떤 놀이 흐름을 보고 시간이 더 필요하다고 판단했는지, 교사가 놀이 시간이나 일과를 어떻게 조정했는지 적어 주세요. 기다려 주거나 다시 이어갈 시간을 마련한 실제 지원과 이후 관찰한 반응을 기록해 주세요.",
  "공간 지원": "아이의 놀이와 이동, 안전을 살펴보고 교사가 공간을 어떻게 마련하거나 바꾸었는지 적어 주세요. 영역의 배치, 놀이 범위, 동선 등을 조정한 이유와 실제 변화, 이후 관찰한 아이의 이용 모습을 기록해 주세요.",
  "자료 지원": "아이의 관심이나 시도에 맞추어 어떤 자료를 제공·추가·교체했는지 적어 주세요. 자료를 선택한 이유, 제공한 방식과 아이가 실제로 자료를 사용한 모습을 관찰한 범위에서 기록해 주세요.",
  "상호작용 지원": "아이의 말이나 행동에 교사가 어떻게 반응했는지 적어 주세요. 경청, 기다림, 질문, 말이나 행동을 되짚어 주기, 함께 참여하기 등 실제로 한 지원과 그 뒤에 확인한 아이의 반응을 기록해 주세요.",
};

export function curriculumAreas(age: string) {
  if (["0세", "1세", "2세"].includes(age)) return STANDARD_AREAS;
  if (["3세", "4세", "5세"].includes(age)) return NURI_AREAS;
  return [];
}
