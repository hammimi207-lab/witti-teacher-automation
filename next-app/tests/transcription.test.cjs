/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route test with SDK mocked, no live API calls. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(require.resolve("../src/app/api/observations/transcribe/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
function fixture(failure, text = "아이가 블록을 쌓으며 다시 해 볼래라고 말했어요.") {
  const calls = [];
  class APIError extends Error { constructor(status) { super("sensitive upstream details"); this.status = status; } }
  class Client {
    static APIError = APIError;
    audio = { transcriptions: { create: async (body, options) => { calls.push({ body, options }); if (failure) throw new APIError(failure); return { text }; } } };
  }
  const target = { exports: {} };
  new Function("require", "module", "exports", code)(id => { assert.equal(id, "openai"); return Client; }, target, target.exports);
  const post = async ({ origin = "https://app.test", size = 32, type = "audio/webm;codecs=opus", empty = false, contentLength } = {}) => {
    const form = new FormData(); if (!empty) form.set("audio", new File([new Uint8Array(size)], "private-child-name.webm", { type }));
    const headers = { origin }; if (contentLength) headers["content-length"] = contentLength;
    return target.exports.POST(new Request("https://app.test/api/observations/transcribe", { method: "POST", body: form, headers }));
  };
  return { post, calls };
}
test("transcription validates requests, forwards audio without metadata, and returns uncached Korean text", async () => {
  const original = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = "test-only-not-a-key";
  try {
    const f = fixture();
    for (const [params, status] of [[{ origin: "https://other.test" }, 403], [{ empty: true }, 400], [{ size: 0 }, 400], [{ type: "text/plain" }, 415], [{ size: 4000001 }, 413], [{ contentLength: "5000000" }, 413]]) {
      const response = await f.post(params); assert.equal(response.status, status); assert.equal(f.calls.length, 0);
    }
    const response = await f.post(); assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal((await response.json()).text, "아이가 블록을 쌓으며 다시 해 볼래라고 말했어요.");
    assert.equal(f.calls[0].body.file.name, "observation.webm"); assert.equal(f.calls[0].body.file.type, "audio/webm");
    assert.equal(f.calls[0].body.language, "ko"); assert.equal(f.calls[0].body.model, "gpt-4o-mini-transcribe"); assert.equal(f.calls[0].body.response_format, "json");
    assert.ok(f.calls[0].options.signal instanceof AbortSignal);
  } finally { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }
});
test("missing key, empty speech and upstream failures produce usable responses without leaking provider details", async () => {
  const original = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    const missing = fixture(); assert.equal((await missing.post()).status, 503); assert.equal(missing.calls.length, 0);
    process.env.OPENAI_API_KEY = "test-only-not-a-key";
    assert.deepEqual(await (await fixture(undefined, "").post()).json(), { text: "" });
    for (const [upstream, expected] of [[429, 429], [400, 422], [401, 503], [403, 503], [500, 502]]) {
      const response = await fixture(upstream).post(); assert.equal(response.status, expected); assert.doesNotMatch(await response.text(), /sensitive upstream details/);
    }
  } finally { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }
});
