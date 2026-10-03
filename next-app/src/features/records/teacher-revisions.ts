import type { RecordInput } from "./schema";
import { normalizeObservation } from "./reflection-hints";
import { revisionFeedback, questionRevisionFeedback } from "./revision-feedback";
import { revisionDiff } from "./revision-diff";

export type TeacherRevision = { context: string; before: string; after: string };
export function collectTeacherRevisions(input: RecordInput, first: Record<string, string>): TeacherRevision[] {
  const fields: [string, string, string][] = [
    ...input.playSubcategories.map(key => [`play:${key}`, key, input.playSubcategoryNotes[key]] as [string, string, string]),
    ...input.teacherSupports.map(key => [`support:${key}`, key, input.teacherSupportNotes[key]] as [string, string, string]),
    ["observation", "관찰", input.observation],
  ];
  return fields.filter(([, , value]) => value?.trim()).map(([key, context, after]) => ({ context, before: first[key] ?? after, after }));
}
export function describeGrowth(row: TeacherRevision): string[] {
  if (normalizeObservation(row.before) === normalizeObservation(row.after)) return ["아직 문구를 수정하지 않았어요. 처음 작성한 관찰 내용을 그대로 보관했어요."];
  const details = questionRevisionFeedback(row.before, row.after, row.context).map(item => `‘${item.evidence}’ — ${item.why}`);
  const extra = revisionFeedback(row.before, row.after, row.context).map(item => `‘${item.evidence}’ — ${item.why}`);
  const changes = revisionDiff(row.before, row.after).filter(part => part.added && part.text.trim()).map(part => part.text).join(" ");
  return [changes ? `수정한 내용을 확인했어요. ‘${changes}’ 표현을 추가하거나 바꾸었어요.` : "수정한 내용을 확인했어요. 기존 표현의 일부를 삭제해 문장을 정리했어요.", ...details, ...extra,
    ...(!details.length && !extra.length ? ["표현이 달라진 부분을 파란색으로 표시했어요. 이 변화만으로 관찰이 더 구체적이 되었다고 단정하지는 않아요."] : [])];
}
