import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function route(user, calls) {
  const chain = {};
  for (const method of ["update", "eq", "in"]) chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
  chain.select = async () => ({ data: [{ id: 3 }], error: null });
  const client = { auth: { getUser: async () => ({ data: { user }, error: null }) }, from: name => { calls.push(["from", name]); return chain; } };
  const code = ts.transpileModule(fs.readFileSync(new URL("../src/app/api/records/delete/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const target = { exports: {} };
  new Function("require", "module", "exports", code)(id => id.endsWith("supabase/server") ? { createClient: async () => client } : id.endsWith("supabase/config") ? { hasSupabaseConfig: () => true } : require(id), target, target.exports);
  return target.exports.POST;
}
const request = body => new Request("https://example.com/api/records/delete", { method: "POST", body: JSON.stringify(body) });
test("삭제는 본인 소유의 선택한 행을 소프트 삭제", async () => {
  const calls = [];
  const response = await route({ id: "current-user" }, calls)(request({ ids: [3, 3] }));
  assert.equal(response.status, 200);
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["eq", "user_id", "current-user"])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["update", { deleted: true }])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["in", "id", [3]])));
});
test("미인증 또는 잘못된 선택으로는 데이터 변경 불가", async () => {
  for (const [user, body, status] of [[null, { ids: [3] }, 401], [{ id: "user" }, { ids: [] }, 400], [{ id: "user" }, { ids: [-1] }, 400]]) {
    const calls = [];
    assert.equal((await route(user, calls)(request(body))).status, status);
    assert.equal(calls.length, 0);
  }
});
