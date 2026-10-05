/* Offline API and storage fixtures. */
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), ts = require("typescript"), sharp = require("sharp");
const root = path.resolve(__dirname, "../src");
function load(file, mocks = {}) {
  const target = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (id in mocks) return mocks[id];
    if (id === "server-only") return {};
    if (id.startsWith("@/") || id.startsWith(".")) {
      const stem = id.startsWith("@/") ? path.join(root, id.slice(2)) : path.resolve(path.dirname(file), id);
      return load([stem + ".ts", stem + ".tsx"].find(fs.existsSync), mocks);
    }
    return require(id);
  }, target, target.exports);
  return target.exports;
}
const schema = load(path.join(root, "features/records/steam-schema.ts"));
const observation = "아이가 블록을 올려놓고 다시 내려놓았다.";
const analysis = { photoFacts: [{ photo: 1, fact: "손으로 블록을 잡고 있다." }], cards: [{ area: "E 공학", evidence: [{ source: "observation", photo: 0, quote: "블록을 올려놓고" }], interpretation: "구성 방법을 탐색하는 가능성", watch: "놓는 방법을 바꾸는지", extension: "큰 블록을 제공해 보기", status: "배움의 가능성" }], support: { materials: ["큰 블록", "낮은 매트"], teacher: "여기에 놓아 볼까?", watch: ["놓는 위치", "반복 시도"], safety: "작은 부품 제외" } };
const uuid = "11111111-1111-4111-8111-111111111111";

test("STEAM menu keeps four slots and includes the new entry", () => {
  const { readQuickMenu } = load(path.join(root, "features/home/quick-menu.ts"));
  assert.deepEqual(readQuickMenu(["steam", "observation", "new", "records"]), ["steam", "observation", "new", "records"]);
  assert.deepEqual(readQuickMenu(["steam", "steam", null, null]), ["steam", null, null, null]);
});
test("grounding removes invented teacher quotes, invalid photo references and unrelated areas", () => {
  const raw = structuredClone(analysis);
  raw.photoFacts.push({ photo: 4, fact: "보이지 않는 사진" });
  raw.cards.push({ ...raw.cards[0], area: "S 과학", evidence: [{ source: "observation", photo: 0, quote: "아이가 과학 원리를 이해했다" }] });
  raw.cards.push({ ...raw.cards[0], area: "M 수학", evidence: [{ source: "photo", photo: 1, quote: "숫자를 읽었다" }] });
  const grounded = schema.groundAnalysis(raw, observation, 1);
  assert.equal(grounded.cards.length, 1); assert.equal(grounded.photoFacts.length, 1);
  const verification = schema.verifySteamAnalysis(raw, observation, 1);
  assert.equal(verification.checks[0].verdict, "passed");
  assert.equal(observation.slice(verification.checks[0].startOffset, verification.checks[0].endOffset), "블록을 올려놓고");
  assert.equal(verification.checks.filter(check => check.verdict === "failed").length, 2);
  const photoOnly = structuredClone(analysis); photoOnly.cards[0].evidence = [{ source: "photo", photo: 1, quote: photoOnly.photoFacts[0].fact }];
  assert.equal(schema.verifySteamAnalysis(photoOnly, observation, 1).checks[0].verdict, "needs_review");
  const draft = schema.processDraft({ interest: "", attempt: observation, change: "", repeat: "", teacher: "", next: "다음에는 놓는 위치 관찰" }, "구성 방법을 탐색하는 가능성");
  assert.match(draft, /교사 보충 필요/); assert.match(draft, /아직 실행하지 않음/); assert.match(draft, /잠정적/); assert.doesNotMatch(draft, /큰 블록을 제공/);
});

test("analysis gates auth, origin, consent and photos before AI; structured result is grounded", async () => {
  let signedIn = true, aiCalls = 0, photoCalls = 0, noPhotoAccess = false, aiError = false;
  let called;
  class AI { constructor() { this.responses = { parse: async args => { aiCalls++; called = args; if (aiError) throw Error("private failure"); return { output_parsed: analysis }; } }; } }
  const route = load(path.join(root, "app/api/steam/analyze/route.ts"), {
    openai: AI, "openai/helpers/zod": { zodTextFormat: () => ({ type: "json_schema" }) },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: "owner" } : null }, error: null }) } }) },
    "@/lib/steam-photos": { steamPhotoBlobs: async () => { photoCalls++; if (noPhotoAccess) throw Error("INVALID_PHOTOS"); return []; } },
  });
  const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#aacccc" } }).jpeg().toBuffer();
  async function post({ origin = "https://app.test", consent = true, photos = true, note = observation } = {}) {
    const form = new FormData(); form.set("input", JSON.stringify({ age: "2세", observation: note, photoIds: [] }));
    form.set("consent", JSON.stringify({ version: "2026-09-19", aiAccepted: consent, photoAccepted: consent }));
    if (photos) form.set("images", new File([bytes], "test.jpg", { type: "image/jpeg" }));
    return route.POST(new Request("https://app.test/api/steam/analyze", { method: "POST", headers: { origin }, body: form }));
  }
  assert.equal((await post({ origin: "https://other.test" })).status, 403);
  signedIn = false; assert.equal((await post()).status, 401); signedIn = true;
  assert.equal((await post({ consent: false })).status, 403); assert.equal((await post({ photos: false })).status, 400); assert.equal((await post({ note: "" })).status, 400);
  assert.equal(aiCalls, 0); assert.equal(photoCalls, 0);
  noPhotoAccess = true; assert.equal((await post()).status, 404); noPhotoAccess = false;
  const previous = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = "offline-fixture";
  try {
    const response = await post(); assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
    const payload = await response.json();
    assert.deepEqual(payload.analysis, analysis); assert.equal(called.store, false);
    assert.equal(payload.run.promptVersion, "steam-play-ko-v1"); assert.match(payload.run.inputHash, /^[a-f0-9]{64}$/); assert.equal(payload.run.photoHashes.length, 1);
    assert.deepEqual(payload.run.originalAnalysis, analysis); assert.equal(payload.run.checks[0].verdict, "passed");
    assert.equal(called.input[1].content[1].type, "input_image");
    aiError = true; const failed = await post(); assert.equal(failed.status, 502); assert.doesNotMatch((await failed.json()).error, /private failure/);
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});

test("save preserves facts, interpretation and unrealized proposals separately; rejects stale/unreviewed saves", async () => {
  let row = null, session = false, writes = 0;
  const query = table => {
    const q = { select: () => q, eq: () => q, limit: () => q, in: () => q, is: () => q,
      insert: value => { if (table === "play_sessions") session = true; else { writes++; row = { id: 1, result_text: value.result_text }; } return q; },
      update: value => { writes++; row.result_text = value.result_text; return q; },
      then: resolve => resolve({ error: null, data: table === "play_sessions" ? session ? [{ session_id: uuid }] : [] : row ? [row] : [] }),
    }; return q;
  };
  const route = load(path.join(root, "app/api/records/save/route.ts"), {
    "@/lib/supabase/config": { hasSupabaseConfig: () => true },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) }, from: query }) },
    "@/lib/steam-photos": { ownedSteamPhotos: async () => [] },
  });
  const { recordInputSchema } = load(path.join(root, "features/records/schema.ts"));
  const { generatedSchema } = load(path.join(root, "features/records/result-schema.ts"));
  const input = recordInputSchema.parse({ playName: "블록 놓기", ageGroup: "2세", childAlias: "아이 A", recordType: "놀이 이야기", curriculumAreas: [], observation, teacherInterpretation: "구성 탐색 가능성", supportPlan: "큰 블록을 제공해 볼 계획" });
  const draft = "시도한 행동: " + observation;
  const body = { generationId: uuid, kind: "record", input, result: generatedSchema.parse({ observation, interpretation: input.teacherInterpretation, connection: input.supportPlan, integratedRecord: draft }), createdAt: new Date().toISOString(), consent: { version: "2026-09-19", aiAccepted: true, photoAccepted: true },
    steam: { version: 1, age: "2세", sourceObservation: observation, photoIds: [], recordingIds: [], analysis, confirmedObservation: observation, selectedAreas: ["E 공학"], interpretation: input.teacherInterpretation, extension: input.supportPlan, process: { interest: "", attempt: observation, change: "", repeat: "", teacher: "", next: "" }, draft, reviewed: true, analyzedInput: { age: "2세", observation, photoIds: [] } } };
  const post = body => route.POST(new Request("https://app.test/api/records/save", { method: "POST", headers: { origin: "https://app.test" }, body: JSON.stringify(body) }));
  assert.equal((await post({ ...body, steam: { ...body.steam, reviewed: false } })).status, 400);
  assert.equal((await post({ ...body, steam: { ...body.steam, sourceObservation: "바뀐 관찰 입력" } })).status, 400);
  assert.equal(writes, 0); assert.equal((await post(body)).status, 200);
  const reopened = JSON.parse(row.result_text); assert.equal(reopened.steam.confirmedObservation, observation); assert.equal(reopened.input.observation, observation); assert.equal(reopened.result.connection, input.supportPlan);
  assert.doesNotMatch(reopened.result.observation, /제공해 볼 계획/); assert.equal(reopened.steam.draft, draft);
  body.steam.draft = body.result.integratedRecord = draft + "\n교사 수정";
  assert.equal((await post(body)).status, 200); assert.equal(JSON.parse(row.result_text).steam.draft, body.steam.draft); assert.equal(writes, 2);
});

test("owned photos cannot use another owner, public/foreign bucket or deleted/missing IDs", async () => {
  let rows = [{ id: 1, storage_bucket: "play-photos", file_path: "owner/session/a.jpg" }]; const filters = [];
  const q = { select: () => q, eq: (key, value) => { filters.push([key, value]); return q; }, in: () => q, then: resolve => resolve({ data: rows, error: null }) };
  const { ownedSteamPhotos } = load(path.join(root, "lib/steam-photos.ts"), { "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => q }) }, "./supabase/admin": { createAdminClient: () => ({ from: () => q }) } });
  assert.equal((await ownedSteamPhotos("owner", [1])).length, 1); assert.ok(filters.some(([key, value]) => key === "user_id" && value === "owner"));
  rows[0].file_path = "other/session/a.jpg"; await assert.rejects(() => ownedSteamPhotos("owner", [1]));
  rows = []; await assert.rejects(() => ownedSteamPhotos("owner", [1])); await assert.rejects(() => ownedSteamPhotos("owner", [1, 1]));
});
