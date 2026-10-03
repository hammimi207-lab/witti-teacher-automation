import { noticeStyleGuidance } from "./notice-style";
import type { RecordInput } from "./schema";
import { recordWritingGuidance } from "./record-writing-guidance";
import { parentNoticeGuidance } from "./parent-notice-guidance";

export function buildRecordPrompt(input: RecordInput) {
  const framework = ["0세", "1세", "2세"].includes(input.ageGroup) ? "표준보육과정" : "누리과정";
  const supportPlanLabel = input.curriculumAreas.includes("기본생활") ? "다음 지원 계획" : "다음 놀이 지원 계획";
  const namingGuidance = input.recordType === "놀이 이야기" ? `
[교사의 배움을 위한 놀이명 추천]
기존 놀이명을 정답으로 간주하지 말고, 첨부된 모든 사진과 교사의 실제 관찰, 단계별 관찰, 지원 내용을 종합 판단하세요.
playNameRecommendations에 핵심 행동과 탐색 과정이 드러나는 구체적인 놀이명 3개를 추천하세요. 가장 적합한 제목을 먼저 제시하세요.
각 항목의 title은 추천명, photoEvidence는 사진에서 직접 확인한 근거, observationEvidence는 교사 관찰의 근거, reason은 기존 놀이명과 비교해 이 이름이 놀이를 어떻게 더 잘 설명하는지 작성하세요.
사진이 없으면 photoEvidence에 '사진 미첨부 — 교사 관찰만 참고'라고 쓰세요. 사진과 관찰이 다르거나 불분명하면 차이와 한계를 명시하고 단정하지 마세요. 사진에서 대화·감정·의도·발달 수준을 추정하지 마세요.
playNameLearningTip에는 교사가 다음에 스스로 놀이명을 지을 때 살펴볼 행동·재료·변화와 성찰 질문 하나를 제시하세요. 교사를 평가하거나 기존 이름을 틀렸다고 표현하지 마세요.
기존 놀이명은 임의로 바꾸지 말고 추천을 별도로 제공하세요.
` : "";
  if (input.recordType === "알림장") {
    return `당신은 한국 어린이집·유치원 교사의 알림장 작성을 돕습니다. 입력된 실제 관찰만 충분히 풀어 쓰세요.
[입력]
작성일: ${input.writingDate || "미지정"}
기록명: ${input.playName}
연령: ${input.ageGroup}
아이 별칭: ${input.childAlias}
일상: ${input.dailyObservation || [input.mealObservation, input.toiletingObservation].filter(Boolean).join("\n") || "미입력 — 생략"}
놀이: ${input.playObservation || input.peerInteraction || "미입력 — 생략"}
활동: ${input.activityObservation || input.activityLearning || "미입력 — 생략"}
반 공통 활동(개별 아이의 발화·참여·성취를 추정하지 마세요): ${input.commonActivity || "미입력 — 생략"}
이어받은 실제 관찰(이미 위 영역에 있는 사실은 한 번만 전달): ${input.inheritedObservation || (!(input.dailyObservation || input.playObservation || input.activityObservation) ? input.observation : "미입력 — 생략")}
교사의 해석: ${input.teacherInterpretation || "미입력 — 생략"}
원 내 지원: ${input.centerSupport || "미입력 — 생략"}
가정 연계: ${input.homeConnection || "미입력 — 생략"}
보호자 전달 기준: ${parentNoticeGuidance(input.parentType)}

[자세한 서술 — 유일한 생성 방식]
일상·놀이·활동은 입력 구분입니다. 출력 순서를 고정하지 마세요. 입력에 실제 시간이 있으면 그 하루 흐름에 맞게 이어 쓰고, 시간이 없으면 오전·오후나 선후 관계를 만들어내지 마세요.
빈 영역은 자연스럽게 생략하세요. 짧은 관찰은 짧게 마쳐도 됩니다. 문장 반복이나 입력하지 않은 행동·발화·감정·발달 평가를 만들어 분량을 늘리지 마세요. 사진만으로 빈 영역을 채우지 마세요.
공통 활동은 반에서 제공한 내용만 전달하고 개별 아동의 참여나 반응을 추정하지 마세요. 다른 아동의 실명은 친구로 표현하세요.
finalNotice에는 관찰 본문만 작성하세요. 서두·마무리 인사와 공지는 서버에서 별도로 붙이므로 절대 생성하지 마세요. 소제목 없이 단락 사이에 빈 줄을 넣으세요.
observation에는 실제 관찰, interpretation에는 입력된 교사 해석만, connection에는 입력된 지원만 정리하세요. 미입력 해석·지원은 생략하세요.
observationRefinementRows에는 원문에서 핵심 표현 1~5개를 골라 teacherInput은 원문 그대로, accurateObservation과 firstImprovement는 확인된 사실을 보존하며 다듬으세요. 시간·횟수·대화·감정을 추가하지 마세요.
recommendedEmojis에는 어울리는 서로 다른 이모지 10개를 제시하세요.
${recordWritingGuidance(input)}${noticeStyleGuidance(input.teacherStyle)}`;
  }
  const playStoryContext = input.recordType === "놀이 이야기" ? `\n\n[놀이 이야기 세부 관찰]\n${input.playSubcategories.map((item) => `- ${item}: ${input.playSubcategoryNotes[item] || "미입력"}`).join("\n")}\n\n[교사의 지원]\n${input.teacherSupports.map((item) => `- ${item}: ${input.teacherSupportNotes[item] || "미입력"}`).join("\n")}\n\n선택한 놀이 과정의 순서를 바탕으로 관심·탐색·표현·관계·확장의 흐름을 작성하세요. 선택하지 않은 단계나 지원은 임의로 추가하지 마세요.` : "";
  const ending = input.recordType === "일지" ? "했음/보였음/지원하였음 형태의 공식 보육일지 문체" : "교사의 관찰과 지원이 자연스럽게 이어지는 문체";
  const refinementGuidance = `
[개인 장학을 위한 관찰 언어 비교표]
교사의 해석(관찰 사실과 구분): ${input.teacherInterpretation || "미입력"}
interpretation에는 입력된 교사의 해석을 중심으로 정리하고 observation의 관찰 사실과 구분하세요. 해석을 확정된 사실로 바꾸거나 입력하지 않은 발달 평가를 추가하지 마세요.
observationRefinementRows를 반드시 1~5개 작성하세요. 교사의 실제 관찰과 선택한 놀이 단계별 입력에서 핵심 문장을 골라 비교합니다.
teacherInput: 교사가 작성한 원문을 그대로 옮기세요.
accurateObservation: 감정 추측·평가·낙인 대신 직접 확인 가능한 행동 중심으로 바꾸세요.
firstImprovement: 입력과 사진에서 확인된 맥락을 연결해 구체적인 문장으로 다듬으세요.
입력하지 않은 시간·횟수·수량·직접 인용·감정·사건을 만들어 넣지 마세요. 사진만으로 지속 시간이나 평소와의 차이를 판단하지 마세요.
객관적 사실이 부족하면 '구체적인 행동 추가 관찰 필요'라고 명시하고 원문을 그럴듯한 다른 사실로 바꾸지 마세요. '성취감'도 관찰 사실이 아닌 해석임을 구분하세요.
`;
  return `당신은 한국 영유아교육 현장의 기록을 돕는 보조자입니다. 교사 입력과 첨부 사진에서 확인되는 실제 사실만 바탕으로 과정형 기록을 작성하세요.\n\n놀이명 또는 기록명: ${input.playName}\n연령: ${input.ageGroup}\n아이 별칭: ${input.childAlias}\n기록 유형: ${input.recordType}\n${framework} 선택 영역: ${input.curriculumAreas.join(", ")}\n교사가 관찰한 실제 장면: ${input.observation}\n${supportPlanLabel}: ${input.supportPlan || "미입력"}${playStoryContext}\n\n선택한 영역만 연결하고, 보이지 않은 대화·감정·사건·발달 상태를 만들지 마세요. 0~2세는 영아, 3~5세는 유아에 맞는 언어를 사용하세요. 종합 기록은 ${ending}로 작성하되 문장 수를 고정하지 말고 입력의 구체적인 장면과 발화를 모두 보존하세요. ${supportPlanLabel}은 새로 만들거나 바꾸지 마세요.\n${namingGuidance}\n${refinementGuidance}${recordWritingGuidance(input)}`;
}
