import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import sharp from "sharp";
import JSZip from "jszip";
const require = createRequire(import.meta.url);
const session = "550e8400-e29b-41d4-a716-446655440000";
const consent = { version: "2026-09-19", aiAccepted: true, photoAccepted: true };

function fixture(user = "owner") {
  const state = { user, rows: [{ id: 1, user_id: "owner", session_id: session, deleted: false, storage_bucket: "play-photos", file_path: "owner/old.jpg", mime_type: "image/jpeg", original_file_name: "old.jpg" }, { id: 2, user_id: "other", session_id: session, deleted: false, storage_bucket: "play-photos", file_path: "other/secret.jpg", mime_type: "image/jpeg" }], records: [{ user_id: "owner", session_id: session, deleted: false, result_text: JSON.stringify({ savedKinds: ["record"], consent, input: {} }) }], stored: new Map([["owner/old.jpg", Buffer.from("photo")], ["other/secret.jpg", Buffer.from("private")]]), private: true, failRemove: false, failInsert: false, storageCalls: 0 };
  const admin = {
    from(name) {
      let filters = [], mutation, values, single = false, start = 0, end = Infinity;
      const q = {
        select() { return q; }, eq(key, value) { filters.push(row => row[key] === value); return q; }, in(key, values) { filters.push(row => values.includes(row[key])); return q; },
        order() { return q; }, range(a, b) { start = a; end = b; return q; }, limit(n) { end = n - 1; return q; },
        maybeSingle() { single = true; return q; }, single() { single = true; return q; },
        update(value) { mutation = "update"; values = value; return q; }, insert(value) { mutation = "insert"; values = value; return q; },
        then(resolve, reject) {
          const collection = name === "photo_records" ? state.rows : state.records;
          if (mutation === "insert" && state.failInsert) return Promise.resolve({ data: null, error: new Error("insert failed") }).then(resolve, reject);
          let rows = collection.filter(row => filters.every(filter => filter(row))).slice(start, end + 1);
          if (mutation === "update") rows.forEach(row => Object.assign(row, values));
          if (mutation === "insert") { const row = { ...values, id: state.rows.length + 1 }; collection.push(row); rows = [row]; }
          return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject);
        },
      }; return q;
    },
    storage: {
      getBucket: async () => ({ data: { public: !state.private }, error: null }),
      from() { return {
        download: async path => { state.storageCalls++; return { data: state.stored.has(path) ? new Blob([state.stored.get(path)]) : null, error: null }; },
        remove: async paths => { state.storageCalls++; if (state.failRemove) return { error: new Error("storage failure") }; paths.forEach(path => state.stored.delete(path)); return { error: null }; },
        upload: async (path, data) => { state.storageCalls++; state.stored.set(path, data); return { error: null }; },
      }; },
    },
  };
  function load(name) {
    const base = new URL(`../src/${name}`, import.meta.url);
    const file = [".ts", ".tsx"].map(ext => new URL(base.href + ext)).find(fs.existsSync);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const target = { exports: {} };
    new Function("require", "module", "exports", code)(id => {
      if (id === "server-only") return {};
      if (id === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user ? { id: state.user } : null }, error: null }), getClaims: async () => ({ data: { claims: { sub: state.user } } }) } }) };
      if (id === "@/lib/supabase/config") return { hasSupabaseConfig: () => true };
      if (id === "@/lib/supabase/admin") return { createAdminClient: () => admin };
      if (id.startsWith("@/")) return load(id.slice(2));
      if (id.startsWith("./")) return load(name.slice(0, name.lastIndexOf("/") + 1) + id.slice(2));
      return require(id);
    }, target, target.exports);
    return target.exports;
  }
  return { state, load, list: () => load("app/api/photos/route"), photo: () => load("app/api/photos/[id]/route") };
}
const request = (method = "GET", id = "1") => new Request(`https://app.test/api/photos/${id}`, { method, headers: { origin: "https://app.test" } });
const context = id => ({ params: Promise.resolve({ id: String(id) }) });
async function uploadBody() {
  const image = await sharp({ create: { width: 60, height: 40, channels: 3, background: "#98cbbb" } }).jpeg().toBuffer();
  const body = new FormData(); body.set("sessionId", session); body.set("slot", "0"); body.set("photo", new File([image], "sample.jpg", { type: "image/jpeg" }));
  return new Request("https://app.test/api/photos", { method: "POST", body, headers: { origin: "https://app.test" } });
}

test("STEAM referenced gallery photos remain owner-scoped and exclude deleted photos", async () => {
  const f = fixture();
  const response = await f.list().GET(new Request("https://app.test/api/photos?ids=1,2"));
  assert.deepEqual((await response.json()).photos.map(photo => photo.id), [1]);
  f.state.rows[0].deleted = true;
  assert.deepEqual((await (await f.list().GET(new Request("https://app.test/api/photos?ids=1,2"))).json()).photos, []);
  assert.equal((await f.list().GET(new Request("https://app.test/api/photos?ids=1,2,3,4,5,6"))).status, 400);
});

test("STEAM photo upload keys deduplicate retries and distinguish later photos", async () => {
  const f = fixture();
  f.state.records[0].result_text = JSON.stringify({ savedKinds: ["record"], consent, input: {}, steam: { version: 1 } });
  async function upload(key) {
    const form = await (await uploadBody()).formData(); form.set("photoKey", key);
    return f.list().POST(new Request("https://app.test/api/photos", { method: "POST", body: form, headers: { origin: "https://app.test" } }));
  }
  const first = await (await upload("first-file")).json();
  assert.equal(first.saved, true);
  const again = await (await upload("first-file")).json();
  assert.equal(again.id, first.id);
  const other = await (await upload("second-file")).json(); assert.notEqual(other.id, first.id);
});
test("private gallery and image bytes require the owner; no public URLs or caching", async () => {
  const f = fixture();
  const response = await f.list().GET(new Request(`https://app.test/api/photos?sessionId=${session}`));
  const payload = await response.json();
  assert.deepEqual(payload.photos.map(photo => photo.id), [1]);
  assert.equal(payload.photos[0].url, "/api/photos/1");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await f.photo().GET(request(), context(2))).status, 404);
  assert.equal(f.state.storageCalls, 0);
  assert.equal((await f.photo().GET(request(), context(1))).status, 200);
  f.state.user = null;
  assert.equal((await f.list().GET(request())).status, 401);
  assert.equal((await f.photo().GET(request(), context(1))).status, 401);
});
test("delete removes bytes, hides metadata, and prevents subsequent download", async () => {
  const f = fixture();
  assert.equal((await f.photo().DELETE(request("DELETE"), context(1))).status, 200);
  assert.equal(f.state.stored.has("owner/old.jpg"), false);
  assert.equal(f.state.rows[0].deleted, true);
  assert.equal((await f.photo().GET(request(), context(1))).status, 404);
  assert.equal((await f.photo().DELETE(request("DELETE"), context(2))).status, 200);
  assert.equal(f.state.stored.has("other/secret.jpg"), true);
  assert.equal((await f.photo().DELETE(new Request("https://app.test/api/photos/1", { method: "DELETE", headers: { origin: "https://evil.test" } }), context(1))).status, 403);
});
test("failed storage deletion stays visible for retry", async () => {
  const f = fixture(); f.state.failRemove = true;
  assert.equal((await f.photo().DELETE(request("DELETE"), context(1))).status, 500);
  assert.equal(f.state.rows[0].deleted, false);
  assert.equal(f.state.stored.has("owner/old.jpg"), true);
});
test("upload requires owner, saved record, photo consent and a private bucket", async () => {
  for (const scenario of ["other", "no-consent", "public", "language-only"]) {
    const f = fixture(scenario === "other" ? "other" : "owner");
    if (scenario === "no-consent") f.state.records[0].result_text = JSON.stringify({ savedKinds: ["record"] });
    if (scenario === "language-only") f.state.records[0].result_text = JSON.stringify({ savedKinds: ["language"], consent });
    if (scenario === "public") f.state.private = false;
    assert.ok((await f.list().POST(await uploadBody())).status >= 400, scenario);
    assert.equal(f.state.storageCalls, 0, scenario);
  }
});
test("upload retries do not duplicate or restore a photo deleted by its owner", async () => {
  const f = fixture();
  const first = await f.list().POST(await uploadBody());
  assert.equal(first.status, 200); const photo = await first.json();
  assert.equal((await f.list().POST(await uploadBody())).status, 200);
  assert.equal(f.state.rows.length, 3);
  assert.equal((await f.photo().DELETE(request("DELETE"), context(photo.id))).status, 200);
  const again = await f.list().POST(await uploadBody());
  assert.equal((await again.json()).deleted, true);
  assert.equal(f.state.stored.has(`owner/${session}/web-0.jpg`), false);
});
test("a failed metadata insert cleans up the uploaded image", async () => {
  const f = fixture(); f.state.failInsert = true;
  assert.equal((await f.list().POST(await uploadBody())).status, 500);
  assert.equal(f.state.stored.has(`owner/${session}/web-0.jpg`), false);
});
test("consent is explicit, versioned and requires photo agreement only with images", () => {
  const { readAIConsent } = fixture().load("features/records/ai-consent");
  for (const value of [undefined, {}, { ...consent, aiAccepted: false }, { ...consent, version: "old" }]) assert.throws(() => readAIConsent(value, false));
  assert.throws(() => readAIConsent({ ...consent, photoAccepted: false }, true));
  assert.equal(readAIConsent({ ...consent, photoAccepted: false }, false).aiAccepted, true);
});
test("generation endpoint rejects absent or unchecked consent before AI processing", async () => {
  const f = fixture();
  const input = { parentType: "일반형", playName: "블록 놀이", ageGroup: "2세", childAlias: "테스트", recordType: "놀이 이야기", curriculumAreas: ["의사소통"], observation: "아이가 블록을 나란히 놓았습니다." };
  for (const agreement of [null, { ...consent, aiAccepted: false }, { ...consent, photoAccepted: false }]) {
    const body = new FormData(); body.set("input", JSON.stringify(input)); body.set("consent", JSON.stringify(agreement));
    body.set("images", new File(["not-an-image"], "photo.jpg", { type: "image/jpeg" }));
    const response = await f.load("app/api/records/generate/route").POST(new Request("https://app.test/api/records/generate", { method: "POST", body }));
    assert.equal(response.status, 403);
  }
});
test("Word contains embedded photo bytes and an aspect-preserving three-column grid", async () => {
  const { buildStoryWordDocument } = fixture().load("features/records/story-word-document");
  const image = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#aaccee" } }).jpeg().toBuffer();
  const doc = buildStoryWordDocument("사진 기록", { integratedRecord: "관찰 내용" }, null, null, { photos: [{ data: image, width: 400, height: 200 }] });
  const zip = await JSZip.loadAsync(await require("docx").Packer.toBuffer(doc));
  const media = Object.keys(zip.files).filter(path => path.startsWith("word/media/") && path.endsWith(".jpg"));
  assert.equal(media.length, 1);
  assert.deepEqual(await zip.file(media[0]).async("nodebuffer"), image);
  const xml = await zip.file("word/document.xml").async("string");
  assert.ok(xml.includes('<wp:extent cx="1905000" cy="952500"'));
  assert.ok(xml.includes('<w:gridCol w:w="3400"/><w:gridCol w:w="3400"/><w:gridCol w:w="3400"/>'));
  assert.ok(!xml.includes("사진 원본이 포함되지 않습니다"));
});
test("after saving, downloads honor server deletion instead of reusing local files", async t => {
  const { documentPhotos } = fixture().load("features/records/document-photos");
  t.mock.method(globalThis, "fetch", async url => {
    assert.ok(url.includes(`/api/photos?sessionId=${session}`));
    return Response.json({ photos: [] });
  });
  assert.deepEqual(await documentPhotos([new File(["old local copy"], "photo.jpg")], session), []);
});

test("server Word export uses current table widths, owned photos, and excludes deleted photos", async () => {
  const f = fixture();
  f.state.stored.set("owner/old.jpg", await sharp({ create: { width: 120, height: 80, channels: 3, background: "white" } }).jpeg().toBuffer());
  async function exportRecord() {
    const body = new FormData();
    body.set("record", JSON.stringify({ title: "기록", result: { integratedRecord: "기록 내용" }, sessionId: session }));
    body.append("photo", new File(["stale cached photo"], "stale.jpg"));
    return f.load("app/api/records/word/route").POST(new Request("https://app.test/api/records/word", { method: "POST", body }));
  }
  const response = await exportRecord();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Record-Word-Layout"), "2026-09-19-server");
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /<w:gridCol w:w="3060"/);
  assert.match(xml, /<w:gridCol w:w="7140"/);
  assert.doesNotMatch(xml, /<w:gridCol w:w="100"/);
  assert.equal(Object.keys(zip.files).filter(path => path.startsWith("word/media/") && !zip.files[path].dir).length, 1);
  assert.equal(f.state.storageCalls, 1);
  f.state.rows[0].deleted = true;
  const deleted = await exportRecord();
  const deletedZip = await JSZip.loadAsync(await deleted.arrayBuffer());
  assert.equal(Object.keys(deletedZip.files).filter(path => path.startsWith("word/media/") && !deletedZip.files[path].dir).length, 0);
  f.state.user = null;
  assert.equal((await exportRecord()).status, 401);
});

test("server Word export embeds unsaved photos and rejects invalid requests", async () => {
  const f = fixture();
  const body = new FormData();
  body.set("record", JSON.stringify({ title: "새 기록", result: {} }));
  body.set("photo", new File([await sharp({ create: { width: 60, height: 40, channels: 3, background: "white" } }).jpeg().toBuffer()], "photo.jpg"));
  const route = f.load("app/api/records/word/route");
  const response = await route.POST(new Request("https://app.test/api/records/word", { method: "POST", body }));
  assert.equal(response.status, 200);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.equal(Object.keys(zip.files).filter(path => path.startsWith("word/media/") && !zip.files[path].dir).length, 1);
  body.set("record", "invalid");
  assert.equal((await route.POST(new Request("https://app.test/api/records/word", { method: "POST", body }))).status, 400);
  assert.equal((await route.POST(new Request("https://app.test/api/records/word", { method: "POST", body, headers: { origin: "https://other.test" } }))).status, 403);
});

test("STEAM Word export reuses selected owned photos across sessions and honors deletion", async () => {
  const f = fixture();
  f.state.rows[0].session_id = "660e8400-e29b-41d4-a716-446655440000";
  f.state.stored.set("owner/old.jpg", await sharp({ create: { width: 50, height: 40, channels: 3, background: "white" } }).jpeg().toBuffer());
  async function exportRecord() {
    const body = new FormData();
    body.set("record", JSON.stringify({ title: "STEAM 과정 기록", result: { integratedRecord: "교사가 확인한 과정" }, sessionId: session, photoIds: [1, 2] }));
    return f.load("app/api/records/word/route").POST(new Request("https://app.test/api/records/word", { method: "POST", body }));
  }
  const response = await exportRecord(); assert.equal(response.status, 200);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.equal(Object.keys(zip.files).filter(name => name.startsWith("word/media/") && !zip.files[name].dir).length, 1);
  assert.equal(f.state.storageCalls, 1);
  f.state.rows[0].deleted = true;
  const deleted = await exportRecord(); const deletedZip = await JSZip.loadAsync(await deleted.arrayBuffer());
  assert.equal(Object.keys(deletedZip.files).filter(name => name.startsWith("word/media/") && !deletedZip.files[name].dir).length, 0);
});
