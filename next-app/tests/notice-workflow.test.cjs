/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { Packer } = require("docx");
const JSZip = require("jszip");
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (module, filename) => module._compile(compile(fs.readFileSync(filename, "utf8")), filename);
const { seoulToday, greetingOptions, missingPlaceholders, reusableAnnouncement, assembleNotice } = require("../src/features/records/notice-workflow.ts");
const { emptyWritingForm, prepareWriting, nextChild, noticeFromWriting, hasPersonalWriting } = require("../src/features/records/writing-workflow.ts");
const { generationInputSchema, recordInputSchema } = require("../src/features/records/schema.ts");
const { readDraft } = require("../src/features/records/writing-draft.ts");
const { buildRecordPrompt } = require("../src/features/records/prompt.ts");
const { toggleAnnouncement, applyAnnouncements, announcementText } = require("../src/features/records/class-announcements.tsx");
const { koreanHolidays } = require("../src/lib/korean-holidays.ts");
const notice = { ...emptyWritingForm, recordType: "알림장", ageGroup: "3세", childAlias: "첫 아이", parentType: "일반형", teacherStyle: "팩트 중심형", writingDate: "2030-01-04", dailyObservation: "점심에 밥 두 숟가락을 먹었다." };

test("greetings offer explicit festivals, polite emoji choices and persist every new kind", () => {
  for (const date of ["2030-01-04", "2030-04-04", "2030-07-04", "2030-10-04"]) {
    const options = greetingOptions(date);
    for (const side of ["opening", "closing"]) {
      for (const festival of ["seollal", "chuseok"]) {
        const choice = options[side].find(item => item.id === festival);
        assert(choice, "festivals must remain available without calendar data");
        assert.equal(choice.recommended, false);
      }
      for (const option of options[side].filter(item => !["custom", "none"].includes(item.id))) {
        assert(option.candidates.length >= 4);
        assert.equal(new Set(option.candidates).size, option.candidates.length);
        for (const candidate of option.candidates) {
          assert(!/(?:하세요|보내세요|나누세요)/.test(candidate.replaceAll("안녕하세요", "")));
          assert(/\p{Extended_Pictographic}/u.test(candidate));
        }
        const input = recordInputSchema.parse({ ...prepareWriting(notice), [side === "opening" ? "openingKind" : "closingKind"]: option.id, [side === "opening" ? "openingGreeting" : "closingGreeting"]: option.candidates[0] });
        assert.equal(input[side === "opening" ? "openingKind" : "closingKind"], option.id);
      }
    }
  }
  for (const [name, id] of [["설날", "seollal"], ["추석", "chuseok"]]) {
    const options = greetingOptions("2030-01-04", [{ date: "2030-01-05", name }]);
    assert(options.opening.find(item => item.id === id).recommended);
    assert(options.closing.find(item => item.id === id).recommended);
  }
});

test("three observations are reused once, without required interpretation or curriculum choices", () => {
  const input = prepareWriting(notice);
  assert.equal(input.observation, notice.dailyObservation);
  assert.equal(input.playName, "알림장");
  assert.equal(input.noticeMode, "detailed");
  assert(generationInputSchema.safeParse(input).success);
  const prompt = buildRecordPrompt(input);
  assert.equal(prompt.split(notice.dailyObservation).length - 1, 1);
  assert(prompt.includes("놀이: 미입력 — 생략"));
  assert(prompt.includes("활동: 미입력 — 생략"));
  assert(prompt.includes("시간이 없으면 오전·오후"));
  assert(prompt.includes("발달 평가를 만들어"));
  assert(!prompt.includes("간편 작성"));
});
test("changing child retains common material and clears all personal observations", () => {
  assert(!hasPersonalWriting({ ...emptyWritingForm, commonActivity: "반 공통 산책", classAnnouncement: "준비물: 물통" }), "common material must not repeatedly reset a child's alias during typing");
  assert(hasPersonalWriting(notice));
  const second = nextChild({ ...notice, playObservation: "첫 아이만의 놀이", activityObservation: "첫 아이 반응", inheritedObservation: "첫 아이 메모", commonActivity: "반 공통 산책" });
  const submitted = prepareWriting({ ...second, childAlias: "두번째 아이" });
  for (const key of ["dailyObservation", "playObservation", "activityObservation", "inheritedObservation"]) assert.equal(submitted[key], "");
  assert.equal(submitted.observation, "반 공통 산책");
  assert(!buildRecordPrompt(submitted).includes("첫 아이"));
});
test("the same child's stage observations transfer from story to notice without re-entry", () => {
  const source = { ...notice, recordType: "놀이 이야기", dailyObservation: "", observation: "관찰한 실제 놀이 장면입니다.", playSubcategories: ["탐색"], playSubcategoryNotes: { 탐색: "아이의 추가 탐색 장면입니다." } };
  const next = noticeFromWriting(source);
  assert.equal(next.childAlias, source.childAlias);
  assert.equal(next.playObservation, "관찰한 실제 놀이 장면입니다.\n\n아이의 추가 탐색 장면입니다.");
  assert.equal(next.observation, "");
  const submitted = prepareWriting(next);
  assert.equal(submitted.observation, next.playObservation);
  assert.equal(buildRecordPrompt(submitted).split("관찰한 실제 놀이 장면입니다.").length - 1, 1);
});
test("old drafts migrate old input areas, preserving final edits and version-1 snapshots", () => {
  const oldInput = { ...notice, dailyObservation: undefined, playObservation: undefined, activityObservation: undefined, openingGreeting: undefined, closingGreeting: undefined, openingKind: undefined, closingKind: undefined, mealObservation: "기존 식사", toiletingObservation: "기존 배변", observation: "기존 관찰 장면이 있습니다.", noticeMode: "quick" };
  const finalNotice = "교사가 순서를 바꾼 기존 최종 글";
  const saved = readDraft(JSON.stringify({ version: 1, input: oldInput, result: { finalNotice }, updatedAt: "오늘", generationId: "old", selectedAnnouncements: [], snapshot: { input: { ...oldInput, playName: "기존 이름" }, createdAt: "이전 날짜" } }));
  assert(saved); assert.equal(saved.input.dailyObservation, "기존 식사\n\n기존 배변");
  assert.equal(saved.result.finalNotice, finalNotice);
  assert.equal(saved.snapshot.input.noticeMode, "quick");
  assert.equal(saved.input.noticeMode, "detailed");
  assert.equal(recordInputSchema.parse({ ...prepareWriting(notice), writingDate: undefined }).writingDate, undefined);
});
test("multiple announcement chips are separate drafts and do not overwrite the saved original", () => {
  const original = { id: "a", title: "준비물", category: "생활", content: "{{날짜}} 준비물: {{준비물}}", created_at: "" };
  const other = { ...original, id: "b", title: "행사", content: "{{시간}}에 만나요." };
  let selected = toggleAnnouncement(toggleAnnouncement([], original), other);
  assert.equal(selected.length, 2); assert.equal(announcementText(selected), "");
  assert.throws(() => applyAnnouncements(selected), /자리표시자/);
  selected[0].content = "10월 5일 준비물: 물통"; selected[1].content = "9시에 만나요.";
  assert.equal(original.content, "{{날짜}} 준비물: {{준비물}}");
  selected = applyAnnouncements(selected);
  assert.equal(announcementText(selected), "10월 5일 준비물: 물통\n\n9시에 만나요.");
  selected = toggleAnnouncement(selected, original);
  assert.equal(announcementText(selected), "9시에 만나요.");
  assert.throws(() => applyAnnouncements([{ ...other, content: "" }]), /내용/);
  assert.throws(() => applyAnnouncements([{ ...other, content: "x".repeat(3001) }]), /3,000/);
});
test("old dates, relative days, times and source child alias become editable placeholders", () => {
  const result = reusableAnnouncement("2024-09-03 오전 9시 내일 월요일 10/3 별님 어린이 준비물", "별님");
  assert(!result.includes("2024")); assert(!result.includes("9시")); assert(!result.includes("별님"));
  assert(!result.includes("내일")); assert(!result.includes("월요일"));
  assert(missingPlaceholders(result).includes("날짜"));
  assert(!generationInputSchema.safeParse({ ...prepareWriting(notice), classAnnouncement: result }).success);
});
test("Seoul midnight, selected date, season, weekend and upcoming holidays drive candidates", () => {
  assert.equal(seoulToday(new Date("2026-10-02T15:00:00Z")), "2026-10-03");
  assert.equal(seoulToday(new Date("2026-10-02T14:59:59Z")), "2026-10-02");
  assert(greetingOptions("2030-01-04").closing.find(item => item.id === "weekend").recommended);
  assert(!greetingOptions("2030-01-07").closing.find(item => item.id === "weekend").recommended);
  assert(greetingOptions("2030-04-01").opening.find(item => item.id === "season").candidates[0].includes("봄"));
  const greetings = greetingOptions("2030-12-30", [{ date: "2031-01-01", name: "신정" }]);
  assert(greetings.closing.find(item => item.id === "holiday").recommended);
  assert(!JSON.stringify(greetings).includes("쉬어요"));
});
test("holiday adapter handles cross-year queries, substitute holidays, failures and absent settings", async () => {
  const urls = [];
  const fetcher = async url => {
    urls.push(url);
    return new Response(JSON.stringify({ response: { header: { resultCode: "00" }, body: { items: { item: { isHoliday: "Y", locdate: url.searchParams.get("solYear") === "2041" ? 20410101 : 20401231, dateName: "대체공휴일" } } } } }));
  };
  const result = await koreanHolidays("2040-12-30", "test-key", fetcher);
  assert(result.available); assert.equal(urls.length, 2);
  assert(result.holidays.some(day => day.date === "2041-01-01"));
  assert.equal(urls[0].searchParams.get("numOfRows"), "100");
  assert.deepEqual(await koreanHolidays("2050-01-01", "", fetcher), { holidays: [], available: false });
  assert.deepEqual(await koreanHolidays("2051-01-01", "test-key", async () => { throw new Error("network failure"); }), { holidays: [], available: false });
  assert.deepEqual(await koreanHolidays("2052-01-01", "test-key", async () => new Response("<resultCode>30</resultCode>")), { holidays: [], available: false });
  const xml = await koreanHolidays("2053-01-01", "test-key", async () => new Response("<response><resultCode>00</resultCode><item><isHoliday>Y</isHoliday><locdate>20530101</locdate><dateName>설날</dateName></item></response>"));
  assert.deepEqual(xml.holidays, [{ date: "2053-01-01", name: "설날" }]);
});
test("assembly occurs once; edited sentence order survives storage and actual Word XML", async () => {
  const input = prepareWriting({ ...notice, openingKind: "custom", openingGreeting: "안녕하세요.", closingKind: "custom", closingGreeting: "편안한 시간 보내세요.", classAnnouncement: "준비물: 물통" });
  const finalNotice = assembleNotice("밥을 먹었어요.\n\n블록을 쌓았어요.", input);
  assert.equal(finalNotice, "안녕하세요.\n\n밥을 먹었어요.\n\n블록을 쌓았어요.\n\n【전체 공지】\n준비물: 물통\n\n편안한 시간 보내세요.");
  const edited = "안녕하세요.\n\n블록을 쌓았어요.\n\n밥을 먹었어요.\n\n【전체 공지】\n준비물: 물통과 모자\n\n내일도 이야기를 나눠요.";
  const { saveRequestSchema, mergeSavedRecord, savedEnvelopeSchema } = require("../src/features/records/save-contract.ts");
  const request = saveRequestSchema.parse({ generationId: "550e8400-e29b-41d4-a716-446655440000", kind: "record", input, result: { finalNotice: edited }, createdAt: "2030-01-04" });
  const saved = savedEnvelopeSchema.parse(JSON.parse(JSON.stringify(mergeSavedRecord(request))));
  assert.equal(saved.result.finalNotice, edited);
  const document = require("../src/features/records/story-word-document.ts").buildStoryWordDocument(input.playName, saved.result, saved.input, saved.createdAt);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
  const xml = await zip.file("word/document.xml").async("string");
  for (const text of edited.split("\n").filter(Boolean)) assert(xml.includes(text));
  assert(xml.indexOf("블록을 쌓았어요.") < xml.indexOf("밥을 먹었어요."));
  assert.equal(xml.split("준비물: 물통과 모자").length - 1, 1);
});

function loadRoute(file, mocks) {
  const exports = {};
  new Function("require", "exports", compile(fs.readFileSync(path.join(__dirname, "../src", file), "utf8")))(name => mocks[name] || (name.startsWith("@/") ? require(path.join(__dirname, "../src", name.slice(2))) : require(name)), exports);
  return exports;
}
test("existing announcement source query restricts owner/deletion/type and excludes child observations", async () => {
  const calls = [];
  const query = {};
  for (const name of ["select", "eq", "order", "limit"]) query[name] = (...args) => { calls.push([name, ...args]); return query; };
  query.then = resolve => Promise.resolve({ data: [{ id: 1, result_text: JSON.stringify({ input: { childAlias: "별님", classAnnouncement: "2025년 3월 5일 별님 어린이 준비물: 물통", observation: "개인 관찰 절대 노출 금지" } }) }, { id: 2, result_text: "오래된 일반 원문" }], error: null }).then(resolve);
  const handlers = loadRoute("app/api/records/announcement-sources/route.ts", { "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) }, from: () => query }) } });
  const response = await handlers.GET();
  const payload = await response.json();
  assert.equal(payload.announcements.length, 1);
  assert(!JSON.stringify(payload).includes("개인 관찰")); assert(!JSON.stringify(payload).includes("별님"));
  for (const pair of [["user_id", "owner"], ["deleted", false], ["output_type", "알림장"]]) assert(calls.some(call => call[0] === "eq" && call[1] === pair[0] && call[2] === pair[1]));
});
test("generation route receives observations once and deterministically attaches selected greetings and notices", async () => {
  let prompt = "";
  class MockOpenAI { responses = { parse: async request => { prompt = request.input[0].content[0].text; return { output_parsed: { finalNotice: "점심에 밥 두 숟가락을 먹었어요.", observationRefinementRows: [{ teacherInput: notice.dailyObservation, accurateObservation: notice.dailyObservation, firstImprovement: notice.dailyObservation }] } }; } }; }
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "mock-test-key";
  try {
    const route = loadRoute("app/api/records/generate/route.ts", { openai: MockOpenAI });
    const input = prepareWriting({ ...notice, openingKind: "custom", openingGreeting: "반가워요.", closingKind: "custom", closingGreeting: "편안한 저녁 보내세요.", classAnnouncement: "준비물: 물통" });
    const form = new FormData(); form.set("input", JSON.stringify(input));
    form.set("consent", JSON.stringify({ version: require("../src/features/records/ai-consent.ts").AI_CONSENT_VERSION, aiAccepted: true, photoAccepted: false }));
    const response = await route.POST(new Request("http://localhost/api/records/generate", { method: "POST", body: form }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.data.finalNotice, assembleNotice("점심에 밥 두 숟가락을 먹었어요.", input));
    assert(!prompt.includes("준비물: 물통")); assert(!prompt.includes("반가워요."));
    assert.equal(prompt.split(notice.dailyObservation).length - 1, 1);
  } finally { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});
