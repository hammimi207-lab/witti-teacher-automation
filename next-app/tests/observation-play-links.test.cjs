/* eslint-disable @typescript-eslint/no-require-imports -- Isolated API route tests with in-memory database and SDK mocks. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const path = require("node:path");

const userId = "11111111-1111-4111-8111-111111111111";
const fragmentId = "22222222-2222-4222-8222-222222222222";
const otherFragmentId = "33333333-3333-4333-8333-333333333333";
const clusterId = "44444444-4444-4444-8444-444444444444";

function fixture(routeName) {
  const tables = {
    record_fragments: [{ fragment_id: fragmentId, user_id: userId, record_type: "voice", deleted_at: null, recorded_at: "2026-09-20T09:00:00Z", play_topic: null }, { fragment_id: otherFragmentId, user_id: "other", record_type: "voice", deleted_at: null, recorded_at: "2026-09-20T09:00:00Z", play_topic: null }],
    record_transcriptions: [{ fragment_id: fragmentId, user_id: userId, raw_transcription: "블록을 쌓고 길을 만들었어요", teacher_edited_transcription: null, created_at: "2026-09-20T09:01:00Z" }],
    play_clusters: [{ cluster_id: clusterId, user_id: userId, title: "블록 놀이", created_at: "2026-09-20T08:00:00Z" }],
    play_fragment_links: [],
  };
  let aiCalls = 0;
  class OpenAI {
    responses = { parse: async body => { aiCalls++; assert.equal(body.store, false); return { output_parsed: { suggestions: [{ title: "블록 놀이", reason: "블록을 쌓는다는 전사 내용" }] } }; } };
  }
  function query(table) {
    const conditions = []; let mode = "read", payload;
    const builder = {
      select() { return builder; }, eq(field, value) { conditions.push(row => row[field] === value); return builder; },
      is(field, value) { conditions.push(row => row[field] === value); return builder; },
      not(field, _op, value) { conditions.push(row => row[field] !== value); return builder; },
      order() { return builder; }, limit() { return builder; },
      insert(value) { mode = "insert"; payload = value; return builder; },
      upsert(value) { mode = "upsert"; payload = value; return builder; },
      delete() { mode = "delete"; return builder; },
      maybeSingle: async () => { const result = await run(); return { data: result.data[0] || null, error: result.error }; },
      single: async () => { const result = await run(); return { data: result.data[0] || null, error: result.error }; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    async function run() {
      if (mode === "insert") { const row = { ...payload, ...(table === "play_clusters" ? { cluster_id: crypto.randomUUID() } : {}) }; tables[table].push(row); return { data: [row], error: null }; }
      if (mode === "upsert") { tables[table] = tables[table].filter(row => !(row.fragment_id === payload.fragment_id && row.cluster_id === payload.cluster_id)); tables[table].push(payload); return { data: [payload], error: null }; }
      const found = tables[table].filter(row => conditions.every(check => check(row)));
      if (mode === "delete") { tables[table] = tables[table].filter(row => !found.includes(row)); return { data: found, error: null }; }
      return { data: found, error: null };
    }
    return builder;
  }
  const admin = { from: query };
  const source = fs.readFileSync(path.join(__dirname, `../src/app/api/observations/${routeName}/route.ts`), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const target = { exports: {} };
  new Function("require", "module", "exports", code)(id => {
    if (id === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: userId } } }) } }) };
    if (id === "@/lib/supabase/admin") return { createAdminClient: () => admin };
    if (id === "openai") return OpenAI;
    return require(id);
  }, target, target.exports);
  const post = (body, origin = "https://app.test") => target.exports.POST(new Request(`https://app.test/api/observations/${routeName}`, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { route: target.exports, post, tables, aiCalls: () => aiCalls };
}

test("teacher alone creates, changes and removes a confirmed play relation", async () => {
  const f = fixture("plays");
  assert.equal((await f.post({ action: "link", fragmentId: otherFragmentId, clusterId })).status, 404);
  assert.equal(f.tables.play_fragment_links.length, 0);
  assert.equal((await f.post({ action: "link", fragmentId, clusterId }, "https://other.test")).status, 403);
  assert.equal((await f.post({ action: "link", fragmentId, clusterId })).status, 200);
  assert.equal(f.tables.play_fragment_links[0].link_source, "teacher");
  assert.ok(f.tables.play_fragment_links[0].confirmed_at);
  assert.equal((await f.post({ action: "unlink", fragmentId })).status, 200);
  assert.equal(f.tables.play_fragment_links.length, 0);
  const created = await (await f.post({ action: "create", title: "길 만들기 놀이" })).json();
  assert.equal(created.play.title, "길 만들기 놀이");
  assert.equal((await f.post({ action: "link", fragmentId, clusterId: created.play.cluster_id })).status, 200);
  assert.equal(f.tables.play_fragment_links.length, 1);
  assert.equal((await f.post({ action: "link", fragmentId, clusterId })).status, 200);
  assert.equal(f.tables.play_fragment_links.length, 1);
  assert.equal(f.tables.play_fragment_links[0].cluster_id, clusterId);
});

test("AI suggests from owned transcription without saving or confirming a link", async () => {
  const original = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = "test-only-not-a-key";
  try {
    const f = fixture("play-suggestions");
    assert.equal((await f.post({ fragmentId: otherFragmentId, note: "" })).status, 404);
    assert.equal(f.aiCalls(), 0);
    const response = await f.post({ fragmentId, note: "블록으로 길을 만들었어요" });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).suggestions[0].title, "블록 놀이");
    assert.equal(f.aiCalls(), 1);
    assert.equal(f.tables.play_fragment_links.length, 0);
  } finally { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }
});
