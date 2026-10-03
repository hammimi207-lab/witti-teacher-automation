/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, mocks = {}) {
  const full = path.resolve(__dirname, "..", file), mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(full, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith(".") ? load(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(full), name + ".ts")), mocks) : require(name), mod, mod.exports);
  return mod.exports;
}
const support = load("src/features/records/weekly-support.ts");
const weekly = load("src/features/records/weekly-story.ts");
const source = { id: "1", childAlias: "가상아이", ageGroup: "2세", observation: "블록 세 개를 연결하고 기차라고 말했어요.", teacherInterpretation: "호기심이 많아 보입니다.", supportPlan: "긴 블록을 준비해요.", centerSupport: "", playSubcategoryNotes: {}, teacherSupportNotes: {}, peerInteraction: "", activityLearning: "" };
const plan = { version: 1, sourceWeek: "2026-09-14", targetWeek: "2026-09-21", sourceIds: ["1"], childAliases: ["가상아이"], title: "기차 길 이어가기", plan: "긴 블록을 가까이 준비해 보려고 해요.", watchFor: "이어 놓는 모습을 살펴봐요.", direction: support.directions[0], status: "planned", reflection: "" };
test("collecting plans preserves original wording and all source references", () => {
  assert.deepEqual(support.collectPlans([source, { ...source, id: "2", supportPlan: "긴  블록을 준비해요." }]), [{ text: source.supportPlan, sources: ["1", "2"] }]);
  assert.equal(support.nextWeek("2026-12-28"), "2027-01-04");
});
test("ideas cannot cite invented observation, interpretation, or someone else's record", () => {
  const idea = { evidence: [{ sourceId: "1", quote: "블록 세 개를 연결하고" }] };
  assert.equal(support.validIdeas([idea], [source]), true);
  assert.equal(support.validIdeas([{ evidence: [{ sourceId: "1", quote: source.teacherInterpretation }] }], [source]), false);
  assert.equal(support.validIdeas([{ evidence: [{ sourceId: "2", quote: source.observation }] }], [source]), false);
  assert.equal(support.validIdeas([{ evidence: [{ sourceId: "1", quote: "친구에게 기차표를 건넸어요" }] }], [source]), false);
});
function routes({ user = { id: "owner" }, existing = [], sources = [source] } = {}) {
  const calls = [];
  const client = { auth: { getUser: async () => ({ data: { user }, error: null }) }, from(table) {
    const local = [];
    const query = { then(resolve) { resolve({ data: local.some(call => call[0] === "insert" || call[0] === "update") ? [{ id: 7 }] : table === "play_sessions" ? [{ session_id: "known" }] : existing, error: null }); } };
    for (const method of ["select", "eq", "or", "order", "limit", "insert", "update"]) query[method] = (...args) => { const call = [method, ...args]; local.push(call); calls.push([table, ...call]); return query; };
    return query;
  } };
  const mocks = { "@/lib/supabase/server": { createClient: async () => client }, "@/lib/weekly-support-records": { loadSupportSources: async (...args) => { calls.push(["sources", args[1], args[2], args[3]]); return sources; } }, "@/features/records/weekly-story": weekly, "@/features/records/weekly-support": support,
    "@/features/records/ai-consent": { readAIConsent: () => { throw Error("no consent"); } } };
  return { plans: load("src/app/api/records/weekly/plans/route.ts", mocks), ideas: load("src/app/api/records/weekly/ideas/route.ts", mocks), calls };
}
const request = (method, body) => new Request("https://test.example/api/records/weekly/plans", { method, headers: { origin: "https://test.example" }, ...(body ? { body: JSON.stringify(body) } : {}) });
test("plan endpoints deny anonymous access and read only owned nondeleted unexpired plan records", async () => {
  const anon = routes({ user: null });
  assert.equal((await anon.plans.GET(request("GET"))).status, 401);
  assert.equal(anon.calls.length, 0);
  const own = routes({ existing: [{ id: 7, result_text: JSON.stringify(plan) }] });
  const response = await own.plans.GET(request("GET"));
  assert.equal((await response.json()).plans[0].title, plan.title);
  assert.ok(own.calls.some(c => c[1] === "eq" && c[2] === "user_id" && c[3] === "owner"));
  assert.ok(own.calls.some(c => c[1] === "eq" && c[2] === "output_type" && c[3] === support.SUPPORT_PLAN_TYPE));
  assert.ok(own.calls.some(c => c[1] === "or" && c[2].includes("expires_at")));
});
test("save resolves child aliases from owned source records, not client claims", async () => {
  const own = routes();
  const response = await own.plans.POST(request("POST", { requestId: "00000000-0000-4000-8000-000000000001", plan: { ...plan, childAliases: ["forged"], status: "tried", reflection: "invented" } }));
  assert.equal(response.status, 200);
  const saved = JSON.parse(own.calls.find(c => c[0] === "generated_texts" && c[1] === "insert")[2].result_text);
  assert.deepEqual(saved.childAliases, [source.childAlias]);
  assert.equal(saved.status, "planned");
  assert.equal(saved.reflection, "");
});
test("review cannot overwrite a foreign or ordinary record and retains provenance", async () => {
  const missing = routes();
  assert.equal((await missing.plans.PATCH(request("PATCH", { ...plan, id: 99 }))).status, 404);
  const own = routes({ existing: [{ id: 7, result_text: JSON.stringify(plan) }] });
  assert.equal((await own.plans.PATCH(request("PATCH", { ...plan, id: 7, sourceIds: ["999"], status: "tried", reflection: "블록을 더 주자 길을 이었어요." }))).status, 200);
  const saved = JSON.parse(own.calls.find(c => c[1] === "update")[2].result_text);
  assert.deepEqual(saved.sourceIds, ["1"]);
  assert.equal(saved.reflection, "블록을 더 주자 길을 이었어요.");
});
test("idea generation checks AI consent before querying private source records", async () => {
  const own = routes();
  const response = await own.ideas.POST(request("POST", { day: plan.sourceWeek, sourceIds: ["1"], direction: support.directions[0], constraints: "", previousTitles: [], weeklyProposal: "" }));
  assert.equal(response.status, 403);
  assert.equal(own.calls.length, 0);
});
