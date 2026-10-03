// Official sources checked 2026-09-18. These are coaching explanations, not
// quotations, developmental checklists or an assessment of an individual child.
export const STANDARD_CURRICULUM_SOURCE = "https://i-nuri.go.kr/teacher/board/view.do?board_idx=4331&data_type=normal&manage_idx=137&menu_idx=20";
export const CURRICULUM_SOURCE = "https://www.nccw.educare.or.kr/web/care/pag7/carePage.do";

export function curriculumObservationGuidance(topic: string, ageGroup: string) {
  const framework = ["0세", "1세", "2세"].includes(ageGroup) ? "2024 개정 표준보육과정" : ["3세", "4세", "5세"].includes(ageGroup) ? "2019 개정 누리과정" : "";
  let area = "영유아·놀이 중심 관찰과 지원";
  let why = "아이의 경험을 이해하고 다음 지원을 생각할 수 있도록, 기억나는 실제 장면 하나를 남기는 데 의미가 있어요. 모든 항목이나 시간·횟수를 채울 필요는 없어요.";
  if (/발화|표현한 방식|비언어|요구/.test(topic)) {
    area = "의사소통";
    why = ["0세", "1세"].includes(ageGroup)
      ? "눈길·몸짓·옹알이도 의사 표현이에요. 문장으로 말했는지보다 무엇에 어떻게 반응했는지 살펴보면 소통을 이해하는 데 도움이 돼요."
      : "아이가 자기 생각을 어떻게 표현했는지 이해하는 데 도움이 돼요. 말뿐 아니라 가리킴이나 고개 끄덕임도 기록할 수 있어요.";
  } else if (/상호작용의 상대|주고받은 과정/.test(topic)) {
    area = "사회관계 · 의사소통";
    why = "친구와 함께한 결과뿐 아니라 제안과 반응을 살피면 관계 맺는 과정을 이해할 수 있어요. 혼자 하거나 지켜보는 모습도 존중하며 기록해 주세요.";
  } else if (/탐색|앞선 놀이/.test(topic)) {
    area = "놀이를 통한 배움 · 자연탐구";
    why = "완성한 결과보다 아이가 다시 시도하거나 방법을 바꾼 과정에서 관심과 탐색을 읽을 수 있어요. 새 시도가 없었다면 억지로 변화를 찾지 않아도 돼요.";
  } else if (/지원|자료|시간|공간|교사의 반응|후속 반응/.test(topic)) {
    area = "교수·학습 · 놀이 지원";
    why = "아이의 관심에 맞춘 환경과 교사의 반응, 그 뒤 이어진 놀이를 함께 보면 지원을 돌아볼 수 있어요. 지원 직후 변화가 없었다고 부족한 지원은 아니에요.";
  } else if (/해석|발달|특성|기록 돌아보기/.test(topic)) {
    area = "평가 · 개별 영유아 이해";
    why = "평가는 아이를 비교하거나 성격을 정하기보다 아이의 경험과 필요한 지원을 이해하기 위한 것이에요. 해석의 근거가 된 장면과 교사의 생각을 구분해 주세요.";
  }
  return { why, basis: framework ? `${framework} · ${area}를 참고한 안내` : "", source: framework === "2024 개정 표준보육과정" ? STANDARD_CURRICULUM_SOURCE : CURRICULUM_SOURCE };
}
