import type { RecordInput } from "./schema";

// Preview, saved records and Word must read the same teacher-authored fields.
export function teacherDocumentSections(input: RecordInput): [string, string][] {
  const sections: [string, string][] = [];
  const add = (label: string, value: string) => {
    if (value?.trim()) sections.push([label, value]);
  };
  add("교사의 해석", input.teacherInterpretation);
  const planLabel = input.curriculumAreas.includes("기본생활") ? "다음 지원 계획" : "다음 놀이 지원 계획";
  if (input.recordType === "알림장") {
    add("원 내 확장 지원", input.centerSupport);
    add("가정 연계", input.homeConnection);
    add(planLabel, input.supportPlan);
  } else {
    // Earlier saved stories used centerSupport for the next play support plan.
    const plan = input.supportPlan?.trim() ? input.supportPlan : input.centerSupport;
    if (input.centerSupport?.trim() && input.centerSupport.trim() !== plan?.trim()) {
      add("원 내 확장 지원", input.centerSupport);
    }
    add("가정 연계", input.homeConnection);
    add(planLabel, plan);
  }
  return sections;
}
