import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(profiles = []) {
  const calls = [];
  const source = fs.readFileSync(new URL('../src/app/api/auth/login/route.ts', import.meta.url), 'utf8');
  const loaded = { exports: {} };
  const auth = { signInWithPassword: async input => { calls.push(input); return { data: { user: { id: 'user-1' } }, error: null }; } };
  const admin = { from: () => ({ select() { return this; }, eq() { return this; }, async limit() { return { data: profiles, error: null }; } }) };
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => {
    if (name === '@/lib/supabase/server') return { createClient: async () => ({ auth }) };
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => admin };
    if (name === '@/lib/supabase/config') return { hasSupabaseConfig: () => true };
    if (name === '@/lib/supabase/session-policy') return require('../src/lib/supabase/session-policy.ts');
    return require(name);
  }, loaded, loaded.exports);
  return { calls, post: body => loaded.exports.POST(new Request('http://localhost/api/auth/login', { method: 'POST', body: JSON.stringify(body) })) };
}
test('이메일과 기존 email 요청 형식으로 로그인', async () => {
  const app = load();
  for (const input of [{ identifier: 'Teacher@example.com' }, { email: 'teacher@example.com' }]) {
    assert.equal((await app.post({ ...input, password: 'test-password' })).status, 200);
  }
  assert.equal(app.calls[0].email, 'teacher@example.com');
});
test('아이디를 서버에서 이메일로 변환하고 응답에는 노출하지 않음', async () => {
  const app = load([{ user_id: 'user-1', email: 'teacher@example.com' }]);
  const response = await app.post({ identifier: 'teacher', password: 'test-password' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(app.calls[0].email, 'teacher@example.com');
});
test('없는 아이디와 중복된 아이디는 인증하지 않음', async () => {
  for (const profiles of [[], [{ user_id: 'one', email: 'a@example.com' }, { user_id: 'two', email: 'b@example.com' }]]) {
    const app = load(profiles);
    assert.equal((await app.post({ identifier: 'teacher', password: 'test-password' })).status, 401);
    assert.equal(app.calls.length, 0);
  }
});
