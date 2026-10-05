import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function route(user = { id: 'owner' }) {
  const calls = [];
  const q = { update: value => { calls.push(['update', value]); return q; }, eq: (...args) => { calls.push(['eq', ...args]); return q; }, select: () => Promise.resolve({ data: [{ user_id: 'owner' }], error: null }) };
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/app/api/account/profile/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const target = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => id.endsWith('/supabase/server') ? { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) } : id.endsWith('/supabase/admin') ? { createAdminClient: () => ({ from: () => q }) } : require(id), target, target.exports);
  return { handler: target.exports.PATCH, calls };
}
const input = { name: '선생님', institution: '어린이집', position: '교사', mailing: false };
const request = (body, origin = 'https://app.test') => new Request('https://app.test/api/account/profile', { method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('profile update is owner-scoped and accepts only editable signup fields', async () => {
  const r = route(); assert.equal((await r.handler(request(input))).status, 200);
  assert(r.calls.some(x => x[0] === 'eq' && x[1] === 'user_id' && x[2] === 'owner'));
  assert.equal(r.calls[0][1].mailing_agree, 'False');
  for (const extra of [{ user_id: 'other' }, { role: 'admin' }, { email: 'other@example.com' }]) {
    const blocked = route(); assert.equal((await blocked.handler(request({ ...input, ...extra }))).status, 400); assert.equal(blocked.calls.length, 0);
  }
});
test('profile changes require login and matching origin', async () => {
  assert.equal((await route(null).handler(request(input))).status, 401);
  assert.equal((await route().handler(request(input, 'https://other.test'))).status, 403);
});
