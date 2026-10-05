/* eslint-disable @typescript-eslint/no-require-imports -- Offline SDK/auth fixtures. */
const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), ts = require("typescript"), sharp = require("sharp");
const root = path.resolve(__dirname, "../src");
function load(file, mocks = {}) {
  const exports = {}, target = { exports };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (mocks[id]) return mocks[id];
    if (id.startsWith("@/")) return load(path.join(root, id.slice(2) + ".ts"), mocks);
    if (id.startsWith(".")) return load(path.resolve(path.dirname(file), id + ".ts"), mocks);
    return require(id);
  }, target, exports);
  return target.exports;
}
test("reviewed observation is bounded, user-scoped, expiring and merged without overwriting", () => {
  const helper = load(path.join(root, "features/home/observation-handoff.ts"));
  assert.notEqual(helper.handoffKey("first-user", "token"), helper.handoffKey("second-user", "token"));
  assert.equal(helper.appendObservation("기존 관찰", "새 관찰"), "기존 관찰\n\n새 관찰");
  assert.equal(helper.appendObservation("기존 관찰\n\n새 관찰", "새 관찰"), "기존 관찰\n\n새 관찰");
  assert.throws(() => helper.appendObservation("x".repeat(15000), "새 관찰"));
  assert.deepEqual(helper.readHandoff(JSON.stringify({ text: "관찰", createdAt: 100 }), 101), { text: "관찰", createdAt: 100 });
  for (const raw of ["bad-json", JSON.stringify({ text: "", createdAt: 100 }), JSON.stringify({ text: "관찰", createdAt: 0 }), JSON.stringify({ text: "관찰", createdAt: 99999999999 })]) assert.equal(helper.readHandoff(raw, 2000000), null);
});
test("video API validates ownership/consent/bounds and combines speech with stage evidence privately", async () => {
  const original = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = "test-only";
  const calls = []; let signedIn = true, classification = "놀이", audioError = null;
  class APIError extends Error { constructor(status) { super("private upstream details"); this.status = status; } }
  class Client {
    static APIError = APIError;
    audio = { transcriptions: { create: async body => { calls.push(["audio", body]); if (audioError) throw new APIError(audioError); return { text: "아이가 블록을 쌓았어요." }; } } };
    responses = { parse: async body => { calls.push(["vision", body]); return { output_parsed: { classification, reason: "자발적 반복", observations: "1초 블록을 쌓음", stages: [{ stage: "탐색과 반복", second: 1, evidence: "다시 쌓음" }], missingStages: "확장 관찰 부족", teacherDraft: "블록을 반복해 쌓는 모습이 보였습니다." } }; } };
  }
  const route = load(path.join(root, "app/api/observations/video/route.ts"), {
    openai: Client, "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: "test-user" } : null }, error: null }) } }) },
  });
  const jpeg = await sharp({ create: { width: 100, height: 100, channels: 3, background: "blue" } }).jpeg().toBuffer();
  async function post({ consent = "accepted", duration = "20", size = 10, origin = "https://test.app", timestamps = [0, 10], contentLength, audioOnly = false } = {}) {
    const form = new FormData(); form.set("consent", consent); form.set("duration", duration); form.set("timestamps", JSON.stringify(timestamps));
    form.set(audioOnly ? "audio" : "video", new File([new Uint8Array(size)], audioOnly ? "audio.wav" : "private-child.mp4", { type: audioOnly ? "audio/wav" : "video/mp4" }));
    for (let i = 0; i < timestamps.length; i++) form.append("frames", new File([jpeg], "frame.jpg", { type: "image/jpeg" }));
    const headers = { origin }; if (contentLength) headers["content-length"] = contentLength;
    return route.POST(new Request("https://test.app/api/observations/video", { method: "POST", headers, body: form }));
  }
  try {
    for (const [options, status] of [[{ origin: "https://other.app" }, 403], [{ consent: "no" }, 403], [{ duration: "91" }, 400], [{ size: 3000001 }, 413], [{ timestamps: [5, 1] }, 400], [{ contentLength: "4000001" }, 413]]) assert.equal((await post(options)).status, status);
    assert.equal(calls.length, 0);
    signedIn = false; assert.equal((await post()).status, 401); signedIn = true;
    const response = await post(); assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal((await response.json()).data.stages.length, 1);
    assert.equal(calls[0][1].file.name, "observation.mp4"); assert.equal(calls[1][1].store, false);
    assert.match(calls[1][1].input[0].content[0].text, /아이가 블록/);
    assert.equal((await post({ audioOnly: true })).status, 200);
    assert.equal(calls[2][1].file.name, "observation.wav");
    classification = "활동"; assert.equal((await (await post()).json()).data.stages.length, 0);
    audioError = 400; const silent = await (await post()).json(); assert.equal(silent.transcript, ""); assert.match(silent.transcriptNote, /장면만/);
    audioError = 429; const failed = await post(); assert.equal(failed.status, 429); assert.doesNotMatch(await failed.text(), /private upstream/);
  } finally { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }
});
