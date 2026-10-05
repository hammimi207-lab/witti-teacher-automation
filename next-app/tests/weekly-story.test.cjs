/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, mocks = {}) {
  const full = path.resolve(__dirname, "..", file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(full, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const req = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith(".") ? load(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(full), name + ".ts")), mocks) : require(name);
  new Function("require", "module", "exports", code)(req, mod, mod.exports);
  return mod.exports;
}
const weekly = load("src/features/records/weekly-story.ts");
const input = { playName: "블록 놀이", childAlias: "소은", ageGroup: "2세", recordType: "놀이 이야기", curriculumAreas: ["의사소통"], observation: "친구와 기차를 만들고 인형을 태웠습니다." };
const row = (id, extra = {}) => ({ id, session_id: `session-${id}`, created_at: "2026-09-13T15:00:00Z", result_text: JSON.stringify({ savedKinds: ["record"], input }), ...extra });
test("weeks use Monday through Saturday in Korea, including year and UTC boundaries", () => {
  assert.deepEqual(weekly.weekRange("2026-09-20"), { monday: "2026-09-14", saturday: "2026-09-19", start: "2026-09-13T15:00:00.000Z", end: "2026-09-19T15:00:00.000Z" });
  assert.equal(weekly.weekRange("2027-01-01").monday, "2026-12-28");
  assert.throws(() => weekly.weekRange("2026-02-30"));
  assert.throws(() => weekly.weekRange("bad"));
});
test("only teacher-input play stories qualify; old consent versions do not hide records", () => {
  const sources = weekly.weeklySources([row(1), row(2, { session_id: "session-1" }), row(3, { result_text: "legacy plain text" }),
    row(4, { result_text: JSON.stringify({ savedKinds: ["language"], input }) }),
    row(5, { result_text: JSON.stringify({ savedKinds: ["record"], input: { ...input, recordType: "알림장" } }) }),
    row(6, { result_text: JSON.stringify({ savedKinds: ["record"], input, consent: { version: "old" }, result: { observation: "AI invented text" } }) })]);
  assert.deepEqual(sources.map(s => s.id), ["1", "6"]);
  assert.equal(sources[0].date, "2026-09-14");
  assert.equal(sources[1].observation, input.observation);
  assert.equal("result" in sources[1], false);
});
test("analysis rejects unknown references and omitted records", () => {
  const sources = weekly.weeklySources([row(1), row(2)]);
  const result = { interests: [], plays: [{ sourceIds: ["1", "2"], scenes: [{ sourceIds: ["1", "2"] }] }] };
  assert.equal(weekly.validWeeklyReferences(result, sources), true);
  assert.equal(weekly.validWeeklyReferences({ ...result, plays: [{ sourceIds: ["1"], scenes: [{ sourceIds: ["1"] }] }] }, sources), false);
  assert.equal(weekly.validWeeklyReferences({ ...result, interests: [{ sourceIds: ["someone-else"] }] }, sources), false);
});
function route(user, rows, calls) {
  const query = { then(resolve) { resolve({ data: rows, error: null }); } };
  for (const method of ["select", "eq", "or", "gte", "lt", "order", "range"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  return load("src/app/api/records/weekly/route.ts", {
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) }, from: () => query }) },
    "@/features/records/weekly-story": weekly,
    "@/lib/weekly-history": { saveWeeklyHistory: async () => 1 },
    "@/features/records/ai-consent": { readAIConsent: () => { throw new Error("missing consent"); } },
  });
}
test("weekly endpoint denies anonymous users and always scopes the query to authenticated owner", async () => {
  const calls = [];
  const anonymous = await route(null, [], calls).GET(new Request("https://example.test/api/records/weekly?day=2026-09-18"));
  assert.equal(anonymous.status, 401);
  assert.equal(calls.length, 0);
  const response = await route({ id: "owner" }, [row(1)], calls).GET(new Request("https://example.test/api/records/weekly?day=2026-09-18&user_id=someone-else"));
  assert.equal(response.status, 200);
  assert.ok(calls.some(c => c[0] === "eq" && c[1] === "user_id" && c[2] === "owner"));
  assert.ok(calls.some(c => c[0] === "eq" && c[1] === "deleted" && c[2] === false));
  assert.ok(calls.some(c => c[0] === "or" && c[1].startsWith("expires_at.is.null")));
  assert.ok(calls.some(c => c[0] === "gte" && c[2] === "2026-09-13T15:00:00.000Z"));
  assert.ok(calls.some(c => c[0] === "lt" && c[2] === "2026-09-19T15:00:00.000Z"));
  assert.equal((await response.json()).sources.length, 1);
});
test("analysis requires fresh AI consent before any record lookup", async () => {
  const calls = [];
  const response = await route({ id: "owner" }, [], calls).POST(new Request("https://example.test/api/records/weekly", { method: "POST", body: JSON.stringify({ day: "2026-09-18" }) }));
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test("history keeps five distinct weeks in latest-analysis order", () => {
  const history = load("src/lib/weekly-history.ts", { "@/lib/supabase/server": {} });
  const rows = ["09-14", "09-07", "09-14", "08-31", "08-24", "08-17", "08-10"].map((week, i) => ({ id: 10 - i, source_text: `2026-${week}` }));
  const { kept, removed } = history.retainWeeklyRows(rows);
  assert.deepEqual(kept.map(row => row.id), [10, 9, 7, 6, 5]);
  assert.deepEqual(removed.map(row => row.id), [8, 4]);
});
