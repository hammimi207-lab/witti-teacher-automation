/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hook loads production TypeScript in the Node test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

// Exercise the production helpers without API calls or user credentials.
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filename);
};
const { buildRecordPrompt } = require("../src/features/records/prompt.ts");
const { reflectionHints } = require("../src/features/records/reflection-hints.ts");
const { recordInputSchema } = require("../src/features/records/schema.ts");
const { curriculumAreas } = require("../src/features/records/constants.ts");
const { generatedSchema } = require("../src/features/records/result-schema.ts");
const { TEACHER_STYLES } = require("../src/features/records/notice-style.ts");
const { teacherSupportHints, hasSupportResponse } = require("../src/features/records/teacher-support-hints.ts");

test("four support comments use the current play observation and ask for the child's response", () => {
  const source = { playName: "카드 꾸미기", observation: "스티커를 붙이며 카드를 꾸몄어요." };
  for (const [context, expected] of [["시간 지원", "정리 시간을"], ["공간 지원", "교실 밖"], ["자료 지원", "어떤 자료를 추가"], ["상호작용 지원", "실제로 던진 질문"]]) {
    const hints = reflectionHints("교사가 지원했어요.", context, "2세", "도준", source);
    assert.equal(hints.length, 1);
    assert.ok(hints[0].question.includes(source.playName));
    assert.ok(hints[0].question.includes(source.observation));
    assert.ok(hints[0].question.includes(expected));
    assert.ok(hints[0].question.includes("지원한 뒤 아이는 어떻게 반응했나요?"));
  }
  assert.ok(teacherSupportHints("지원했어요", "자료 지원", { playName: "블록", observation: "블록을 쌓았어요" })[0].question.includes("블록을 쌓았어요"));
});

test("a supplied response is acknowledged without asking for it again", () => {
  const text = '도준이가 스티커 붙이면서 "선생님 저 잘 하고 있지요?"라고 말할 때 "카드가 예쁘게 꾸며졌다"라고 이야기 해주었어요. 도준이는 어깨가 으쓱해져서 스티커를 더 달라고 이야기 하며 붙이기 놀이를 하였답니다.';
  assert.equal(hasSupportResponse(text), true);
  const hint = teacherSupportHints(text, "상호작용 지원", { playName: "카드 꾸미기", observation: "스티커 붙이기" })[0];
  assert.ok(hint.question.includes("반응도 적어 주셨어요"));
  assert.ok(!hint.question.includes("지원한 뒤 아이는 어떻게 반응했나요?"));
  assert.equal(hasSupportResponse("아이에게 자료를 주었어요."), false);
});

const input = recordInputSchema.parse({
  playName: "친구와 블록 기차", ageGroup: "2세", childAlias: "아이",
  recordType: "놀이 이야기", curriculumAreas: ["의사소통"],
  observation: '아이가 블록 기차를 만들고 "친구도 같이 타야 해"라고 말했어요.',
  playSubcategories: ["관계와 상호작용"],
  playSubcategoryNotes: { "관계와 상호작용": "친구가 인형을 주자 기차에 태웠어요." },
  teacherSupports: ["자료 지원"],
  teacherSupportNotes: { "자료 지원": "놀이하던 블록을 보관해 주었고 오후에 다시 사용했어요." },
});

test("story prompt includes every source field and removes fixed compression limits", () => {
  const prompt = buildRecordPrompt(input);
  for (const text of [input.observation, ...Object.values(input.playSubcategoryNotes), ...Object.values(input.teacherSupportNotes)]) assert.ok(prompt.includes(text));
  assert.doesNotMatch(prompt, /6~9문장/);
  assert.match(prompt, /직접 발화/);
  assert.match(prompt, /누락을 복원/);
});

test("notice keeps life, conflict, activity and announcement facts with parent-specific tone", () => {
  const notice = { ...input, recordType: "알림장", mealObservation: "밥을 두 숟가락 먹었어요.", peerInteraction: "친구가 싫다고 하자 인형을 내려놓았어요.", activityLearning: "산책하며 낙엽을 주웠어요.", classAnnouncement: "월요일 9시까지 물통을 보내 주세요." };
  const prompt = buildRecordPrompt(notice);
  for (const text of [notice.mealObservation, notice.peerInteraction, notice.activityLearning]) assert.ok(prompt.includes(text));
  assert(!prompt.includes(notice.classAnnouncement), "announcements are attached once by the server, outside model generation");
  assert.doesNotMatch(prompt, /1~3문장/);
  assert.match(prompt, /감추거나 미화하지/);
  assert.match(prompt, /부모에게 관찰 보완 질문/);
  assert.match(prompt, /예시의 기차·인형·블록·오후를 다른 기록에 가져오지/);
  assert.doesNotMatch(buildRecordPrompt(input), /부모에게 건네는 알림장 어조/);
});

test("the reported vague observation receives an actionable question and curriculum rationale", () => {
  const hints = reflectionHints("블록 만든 것을 설명할 때 눈빛이 초롱초롱하고 스토리가 탄탄해요.", "관찰", "2세");
  assert.ok(hints.some(x => x.topic === "아이의 실제 발화"));
  assert.ok(hints.some(x => x.topic === "관찰과 해석"));
  assert.ok(hints.every(x => x.question && x.why && x.basis.includes("2024 개정 표준보육과정")));
  assert.ok(hints.length <= 2);
});

test("supplied speech resolves the speech question but a cosmetic edit does not", () => {
  assert.ok(reflectionHints("기차를 만든 이야기를 잘 설명했어요.", "관찰", "2세").some(x => x.topic === "아이의 실제 발화"));
  assert.ok(reflectionHints("오늘 기차를 만든 이야기를 자세히 설명했어요.", "관찰", "2세").some(x => x.topic === "아이의 실제 발화"));
  assert.ok(!reflectionHints('기차를 만들고 "친구도 같이 타야 해"라고 설명했어요.', "관찰", "2세").some(x => x.topic === "아이의 실제 발화"));
});

test("keeping a construction for later counts as materials support", () => {
  const hints = reflectionHints("아이가 놀이하던 블록을 보관해 주었어요. 오후에 다시 사용하며 이어서 놀이했어요.", "자료 지원", "2세");
  assert.deepEqual(hints, []);
});

test("a context keyword does not hide interpretive statements", () => {
  const hints = reflectionHints("친구와 함께 말하며 놀았어요. 기억력이 좋아요.", "관계와 상호작용", "2세");
  assert.ok(hints.some(x => x.topic === "관찰과 해석"));
});

test("curriculum coaching is age appropriate and never demands speech from an infant", () => {
  const infant = reflectionHints("이야기를 설명했어요.", "관찰", "0세");
  assert.ok(infant.some(x => x.why.includes("옹알이")));
  const older = reflectionHints("이야기를 설명했어요.", "관찰", "4세");
  assert.ok(older.every(x => x.basis.includes("누리과정")));
  assert.deepEqual(reflectionHints("", "관찰", "2세"), []);
});

test("five current areas are offered while old saved labels and results remain readable", () => {
  assert.equal(curriculumAreas("2세").length, 5);
  assert.ok(curriculumAreas("2세").includes("신체운동·건강"));
  assert.equal(recordInputSchema.parse({ ...input, curriculumAreas: ["기본생활", "신체운동"] }).curriculumAreas.length, 2);
  assert.equal(generatedSchema.parse({ integratedRecord: "기존 기록" }).integratedRecord, "기존 기록");
});

test("all parent and teacher style combinations retain facts, warmth and bounded support", () => {
  const priorities = { 일반형: "오늘의 생활과 놀이", 불안형: "건강·안전에 관한 정보", 예민형: "아이 개인의 작은 말", 공격형: "오해와 비난으로 읽힐 여지" };
  for (const [parentType, priority] of Object.entries(priorities)) {
    for (const { label: teacherStyle } of TEACHER_STYLES) {
      const prompt = buildRecordPrompt({ ...input, recordType: "알림장", parentType, teacherStyle });
      assert.ok(prompt.includes(priority), `${parentType}/${teacherStyle}`);
      for (const [other, text] of Object.entries(priorities)) if (other !== parentType) assert.ok(!prompt.includes(text));
      assert.ok(prompt.includes(input.observation));
      assert.match(prompt, /사실은 정확하게, 말투는 부드럽게/);
      assert.match(prompt, /계획이 없으면 ‘계속 살펴볼게요’를 자동으로 붙이지/);
      assert.match(prompt, /중요한 건강·안전 사실과 공지 내용을 보존/);
      assert.match(prompt, /유형명은 본문에 쓰지/);
      assert.ok(prompt.includes(`${teacherStyle}:`));
    }
  }
  assert.doesNotMatch(buildRecordPrompt(input), /이번 보호자에게 강조할 전달 방식/);
});
