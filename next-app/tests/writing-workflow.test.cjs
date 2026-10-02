/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
require.extensions[".css"] = module => { module.exports = { default: {} }; };
for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
const { nextChild, emptyWritingForm, combinedObservation, prepareWriting } = require("../src/features/records/writing-workflow.ts");
const { generationInputSchema } = require("../src/features/records/schema.ts");
const { readDraft, draftKey, hasDraftContent } = require("../src/features/records/writing-draft.ts");
const { buildRecordPrompt } = require("../src/features/records/prompt.ts");
const { GeneratedRecordEditor } = require("../src/features/records/generated-record-editor.tsx");
const { CheckedTextarea } = require("../src/features/records/checked-textarea.tsx");
const notice = { ...emptyWritingForm, recordType: "알림장", ageGroup: "3세", childAlias: "첫 아이", playName: "블록 놀이", parentType: "일반형", teacherStyle: "팩트 중심형", curriculumAreas: ["사회관계"], observation: '아이가 "같이 만들자"라고 말하며 친구에게 블록을 건넸다.' };

test("next child clears every individual field and requires fresh delivery choices", () => {
  const previous = { ...notice, teacherInterpretation: "이전 해석", centerSupport: "이전 지원", supportPlan: "이전 계획", homeConnection: "이전 가정", mealObservation: "식사", toiletingObservation: "배변", peerInteraction: "친구", activityLearning: "반응", classAnnouncement: "공지", playSubcategories: ["탐색과 반복"], playSubcategoryNotes: { "탐색과 반복": "이전 아이" }, teacherSupports: ["자료 지원"], teacherSupportNotes: { "자료 지원": "이전 지원" }, commonActivity: "오늘 반에서 산책했어요." };
  const next = nextChild(previous);
  for (const key of ["childAlias", "observation", "teacherInterpretation", "centerSupport", "supportPlan", "homeConnection", "mealObservation", "toiletingObservation", "peerInteraction", "activityLearning", "classAnnouncement", "parentType", "teacherStyle"]) assert.equal(next[key], "", key);
  assert.deepEqual(next.playSubcategoryNotes, {}); assert.deepEqual(next.teacherSupportNotes, {});
  assert.equal(next.commonActivity, previous.commonActivity);
  assert.equal(previous.centerSupport, "이전 지원");
});
test("stage observations are reused without losing dialogue or duplicating identical input", () => {
  const input = { ...notice, observation: "", playSubcategories: ["탐색과 반복", "표현과 구성"], playSubcategoryNotes: { "탐색과 반복": notice.observation, "표현과 구성": "새 장면" } };
  assert.equal(combinedObservation(input), `${notice.observation}\n\n새 장면`);
  assert.equal(combinedObservation({ ...input, observation: notice.observation }), combinedObservation(input));
  assert.equal(prepareWriting(input).observation, combinedObservation(input));
});
test("quick notice accepts missing interpretation and support; detailed mode requires them", () => {
  assert(generationInputSchema.safeParse(prepareWriting(notice)).success);
  assert(!generationInputSchema.safeParse(prepareWriting({ ...notice, noticeMode: "detailed" })).success);
  assert(generationInputSchema.safeParse(prepareWriting({ ...notice, noticeMode: "detailed", teacherInterpretation: "함께 하는 과정", centerSupport: "자료 제공 예정" })).success);
});
test("draft round-trip retains edited final text and cannot parse corrupt drafts", () => {
  assert(hasDraftContent({ ...emptyWritingForm, mealObservation: "밥을 먹었어요." }));
  assert(!hasDraftContent(emptyWritingForm));
  const draft = { version: 1, updatedAt: new Date().toISOString(), input: notice, result: { finalNotice: "교사가 직접 수정한 최종 글" }, generationId: "draft", snapshot: { input: prepareWriting(notice), createdAt: "오늘" }, selectedAnnouncements: [] };
  assert.equal(readDraft(JSON.stringify(draft)).result.finalNotice, draft.result.finalNotice);
  assert.equal(readDraft("invalid"), null); assert.equal(readDraft('{"version":99}'), null);
  assert.notEqual(draftKey("teacher-a"), draftKey("teacher-b"));
});
test("common activity is distinct from personal facts and quick mode does not invent support", () => {
  const prompt = buildRecordPrompt(prepareWriting({ ...notice, commonActivity: "반에서 산책했어요." }));
  assert(prompt.includes("반에서 산책했어요."));
  assert(prompt.includes("개별 아이의 발화·참여·성취를 추정하지"));
  assert(prompt.includes("미입력 해석·지원은 생략"));
});
test("parent final text is editable before the collapsed analysis and copy control is next to it", () => {
  const html = renderToStaticMarkup(React.createElement(GeneratedRecordEditor, { result: { finalNotice: "최종 알림장", observation: "관찰 내용" }, isNotice: true, disabled: false, onChange() {}, onCopy() {} }));
  assert(html.indexOf('id="finalNoticeEditor"') < html.indexOf("<details "));
  assert(html.includes("내용 복사")); assert(!html.includes("<details open"));
});
test("missing observation guidance is inside the input shell", () => {
  const html = renderToStaticMarkup(React.createElement(CheckedTextarea, { value: "", onChange() {}, missingHint: "아이가 한 행동이나 말을 한 장면만 적어 주세요." }));
  assert(html.includes('aria-invalid="true"'));
  assert(html.indexOf("input-fairy-guide") > html.indexOf("</textarea>"));
  assert(html.includes("확인이 필요해요"));
});
