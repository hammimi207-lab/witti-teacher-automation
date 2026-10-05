/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(compile(fs.readFileSync(filename, "utf8")), filename);
const { NoticeObservations } = require("../src/features/records/notice-observations.tsx");
const { announcementText } = require("../src/features/records/class-announcements.tsx");

test("observations have exactly three optional areas; announcement editing is separate", () => {
  const html = renderToStaticMarkup(React.createElement(NoticeObservations, {
    userId: "", input: { dailyObservation: "", playObservation: "", activityObservation: "", commonActivity: "" }, onChange() {},
  }));
  for (const field of ["dailyObservation", "playObservation", "activityObservation"]) assert(html.includes(`id="${field}"`));
  for (const field of ["mealObservation", "toiletingObservation", "peerInteraction", "activityLearning"]) assert(!html.includes(`id="${field}"`));
  assert(!html.includes("공지 목록에 등록"));
  assert(!html.includes("반에서 공지하려는 내용"));
  assert(!html.includes('id="classAnnouncement"'));
  assert.equal(announcementText([{ content: "내일 9시까지 등원해 주세요." }, { content: "준비물: 물통" }]), "내일 9시까지 등원해 주세요.\n\n준비물: 물통");
  assert.equal(announcementText([]), "");
});

function route(user = { id: "teacher-a" }, dbError = null) {
  const calls = [];
  const query = {};
  for (const name of ["select", "eq", "order", "insert", "update", "delete", "single"]) query[name] = (...args) => { calls.push([name, ...args]); return query; };
  query.then = resolve => Promise.resolve({ data: [], error: dbError }).then(resolve);
  const client = { auth: { getUser: async () => ({ data: { user }, error: null }) }, from: () => query };
  const exports = {};
  const source = compile(fs.readFileSync(require.resolve("../src/app/api/records/announcements/route.ts"), "utf8"));
  new Function("require", "exports", source)(name => name === "@/lib/supabase/server" ? { createClient: async () => client } : require(name), exports);
  return { handlers: exports, calls };
}
test("list and delete queries are scoped to the authenticated teacher", async () => {
  for (const method of ["GET", "DELETE"]) {
    const { handlers, calls } = route();
    const response = await handlers[method](new Request("http://localhost/api/records/announcements", { method, ...(method === "DELETE" ? { body: JSON.stringify({ id: "bbfbd9ef-4fc8-4e0a-a1de-e460a89c4281" }) } : {}) }));
    assert.equal(response.status, 200);
    assert(calls.some(call => call[0] === "eq" && call[1] === "user_id" && call[2] === "teacher-a"));
  }
});
test("creation uses the authenticated owner, rejects empty and oversized content", async () => {
  for (const content of ["", "x".repeat(3001), "  준비물: 물통  "]) {
    const { handlers, calls } = route();
    const response = await handlers.POST(new Request("http://localhost/api/records/announcements", { method: "POST", body: JSON.stringify({ user_id: "someone-else", content }) }));
    assert.equal(response.status, content.trim() && content.length <= 3000 ? 201 : 400);
    if (response.status === 201) assert.deepEqual(calls.find(call => call[0] === "insert")[1], { user_id: "teacher-a", title: "공지 양식", category: "일반", content: "준비물: 물통" });
    else assert(!calls.some(call => call[0] === "insert"));
  }
});
test("unauthenticated requests cannot read, create or delete announcements", async () => {
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    const { handlers, calls } = route(null);
    assert.equal((await handlers[method](new Request("http://localhost/api/records/announcements", { method }))).status, 401);
    assert.equal(calls.length, 0);
  }
});

test("template updates preserve ownership and require a valid id and title/category/body", async () => {
  const { handlers, calls } = route();
  const response = await handlers.PATCH(new Request("http://localhost/api/records/announcements", { method: "PATCH", body: JSON.stringify({ id: "bbfbd9ef-4fc8-4e0a-a1de-e460a89c4281", user_id: "other", title: "준비물", category: "생활", content: "{{날짜}} 준비물: {{준비물}}" }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.find(call => call[0] === "update")[1], { title: "준비물", category: "생활", content: "{{날짜}} 준비물: {{준비물}}" });
  assert(calls.some(call => call[0] === "eq" && call[1] === "user_id" && call[2] === "teacher-a"));
  for (const patch of [{ title: "" }, { category: "" }, { id: "invalid" }]) {
    const result = await route().handlers.PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ id: "bbfbd9ef-4fc8-4e0a-a1de-e460a89c4281", title: "제목", category: "일반", content: "본문", ...patch }) }));
    assert.equal(result.status, 400);
  }
});

test("missing announcement storage and permissions return actionable errors without leaking database details", async () => {
  for (const code of ["PGRST205", "42P01", "42501"]) {
    for (const method of ["GET", "POST"]) {
      const { handlers } = route({ id: "teacher-a" }, { code, message: "private database detail" });
      const result = await handlers[method](new Request("http://localhost/api/records/announcements", { method, ...(method === "POST" ? { body: JSON.stringify({ content: "원문 보존" }) } : {}) }));
      assert.equal(result.status, 503);
      const body = await result.json();
      assert.equal(body.code, code === "42501" ? "ANNOUNCEMENTS_PERMISSION_DENIED" : "ANNOUNCEMENTS_SETUP_REQUIRED");
      assert(!body.error.includes("private database detail"));
    }
  }
});
