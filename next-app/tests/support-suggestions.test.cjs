/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (module, filename) => module._compile(compile(fs.readFileSync(filename, "utf8")), filename);
const helpers = require("../src/features/records/support-suggestions.ts");
const consent = require("../src/features/records/ai-consent.ts");
const { SupportPlanReview } = require("../src/features/records/support-plan-review.tsx");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const input = { ageGroup: "2세", curriculumAreas: ["자연탐구"], observation: "큰 블록을 아래 놓고 다시 쌓았다.", interpretation: "크기를 비교하는 시도로 이해했다.", plan: "블록을 더 제공할 계획이다." };
const suggestion = { title: "크기가 다른 블록", plan: "큰 블록과 작은 블록을 가까이 두어 골라 쌓아볼 수 있도록 지원할 계획입니다.", observationEvidence: "큰 블록을 아래 놓고", interpretationEvidence: "크기를 비교하는 시도", curriculumId: "toddler-4", reason: "크기 차이에 대한 탐색을 이어갈 수 있습니다." };
const review = { status: "suggest", message: "이런 방향은 어떨까요?", question: "", suggestions: [suggestion] };

test("curriculum references match all age groups and only selected areas", () => {
  for (const [age, group] of [["0세", "infant"], ["1세", "infant"], ["2세", "toddler"], ["3세", "preschool"], ["4세", "preschool"], ["5세", "preschool"]]) {
    const refs = helpers.supportCurriculum(age, ["자연탐구"]);
    assert.equal(refs.length, 1); assert.equal(refs[0].id, `${group}-4`); assert(refs[0].source.startsWith("https://i-nuri.go.kr/"));
  }
});
test("missing interpretation or observation asks for context instead of suggesting", () => {
  assert.equal(helpers.missingSupportContext({ ...input, interpretation: "" }).status, "clarify");
  assert.equal(helpers.missingSupportContext({ ...input, observation: "블록 놀이" }).status, "clarify");
  assert.equal(helpers.missingSupportContext(input), null);
});
test("wrong-age references and invented observation or interpretation cannot be offered", () => {
  assert.equal(helpers.validateSupportReview(input, review).suggestions.length, 1);
  for (const patch of [{ curriculumId: "preschool-4" }, { observationEvidence: "친구에게 블록을 건넸다" }, { interpretationEvidence: "협력하는 모습" }, { observationEvidence: " " }]) {
    assert.equal(helpers.validateSupportReview(input, { ...review, suggestions: [{ ...suggestion, ...patch }] }).status, "clarify");
  }
  assert.deepEqual(helpers.validateSupportReview(input, { ...review, status: "keep" }).suggestions, []);
});
test("append preserves original exactly; replacement and length limits are explicit", () => {
  assert.equal(helpers.applySupportSuggestion("원문\n", "제안", "append", 100), "원문\n\n\n제안");
  assert.equal(helpers.applySupportSuggestion("원문", "제안", "replace", 100), "제안");
  assert.throws(() => helpers.applySupportSuggestion("원문", "긴 제안", "append", 4));
});
test("review appears only after teacher input is finished; consent is required before AI use", () => {
  const context = { ...input, onApply() {}, limit: 2000, onConsent() {}, aiAccepted: false };
  assert.equal(renderToStaticMarkup(React.createElement(SupportPlanReview, { context, plan: input.plan, active: false })), "");
  assert.equal(renderToStaticMarkup(React.createElement(SupportPlanReview, { context, plan: "", active: true })), "");
  const html = renderToStaticMarkup(React.createElement(SupportPlanReview, { context, plan: input.plan, active: true }));
  assert(html.includes(consent.AI_CONSENT_TEXT)); assert(html.includes("내 계획 유지"));
});

function loadRoute(user = { id: "teacher-a" }) {
  const calls = [];
  class FakeOpenAI { constructor() { this.responses = { parse: async payload => { calls.push(payload); return { output_parsed: review }; } }; } }
  const exports = {};
  new Function("require", "exports", compile(fs.readFileSync(require.resolve("../src/app/api/records/support-suggestions/route.ts"), "utf8")))(name => {
    if (name === "openai") return FakeOpenAI;
    if (name === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) };
    if (name.endsWith("/ai-consent")) return consent;
    if (name.endsWith("/support-suggestions")) return helpers;
    return require(name);
  }, exports);
  return { handler: exports.POST, calls };
}
const request = body => new Request("http://localhost/api/records/support-suggestions", { method: "POST", body: JSON.stringify(body) });
const approved = { version: consent.AI_CONSENT_VERSION, aiAccepted: true, photoAccepted: false };
test("route checks AI consent for guests and members before provider access", async () => {
  let route = loadRoute(null);
  assert.equal((await route.handler(request({ input }))).status, 403); assert.equal(route.calls.length, 0);
  route = loadRoute();
  assert.equal((await route.handler(request({ input }))).status, 403); assert.equal(route.calls.length, 0);
});
test("missing context returns a clarification without spending an API call", async () => {
  const route = loadRoute();
  const result = await route.handler(request({ input: { ...input, interpretation: "" }, consent: approved }));
  assert.equal(result.status, 200); assert.equal((await result.json()).data.status, "clarify"); assert.equal(route.calls.length, 0);
});
test("route sends grounded instructions separately from observations and returns verified proposals", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-placeholder-not-a-key";
  try {
    const route = loadRoute(); const result = await route.handler(request({ input, consent: approved }));
    assert.equal(result.status, 200); assert.equal((await result.json()).data.suggestions.length, 1);
    assert.equal(route.calls[0].store, false); assert.equal(route.calls[0].input[0].role, "developer");
    assert.equal(JSON.parse(route.calls[0].input[1].content).plan, input.plan);
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});
