import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = path.resolve('src');
function loader(mocks = {}) {
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === 'server-only') return {};
    if (!name.startsWith('@/')) return require(name);
    const file = path.join(root, name.slice(2) + '.ts');
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(load, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
test('관리자 세션: 서명·만료·설정 변경 검증', () => {
  const before = { id: process.env.ADMIN_ID, password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET };
  process.env.ADMIN_ID = 'fixture-admin'; process.env.ADMIN_PASSWORD = 'fixture-password'; process.env.ADMIN_SESSION_SECRET = 'fixture-secret';
  try {
    const session = loader({ 'next/headers': {} })('@/lib/admin-session');
    const token = session.issueAdminToken(); assert.equal(session.verifyAdminToken(token), true);
    assert.equal(session.verifyAdminToken(token + 'x'), false);
    assert.equal(session.verifyAdminToken('0000000000000.' + token.split('.').slice(1).join('.')), false);
    process.env.ADMIN_PASSWORD = 'changed'; assert.equal(session.verifyAdminToken(token), false);
  } finally { for (const [key, value] of [['ADMIN_ID', before.id], ['ADMIN_PASSWORD', before.password], ['ADMIN_SESSION_SECRET', before.secret]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
test('관리자 API는 인증·출처·삭제 확인문구·테이블을 검사', async () => {
  let authorized = false; let same = true; const calls = [];
  const route = loader({ '@/lib/admin-session': { requireAdmin: async () => { if (!authorized) throw Error(); }, sameOrigin: () => same }, '@/lib/admin-data': { validTable: table => table === 'subscribers', mutateRecords: async (...args) => { calls.push(args); return 1; } } })('@/app/api/admin/data/route');
  const post = body => route.POST(new Request('http://localhost/api/admin/data', { method: 'POST', body: JSON.stringify(body) }));
  const body = { table: 'subscribers', ids: [1], action: 'delete', confirm: '영구삭제' };
  assert.equal((await post(body)).status, 401); authorized = true; same = false;
  assert.equal((await post(body)).status, 403); same = true;
  assert.equal((await post({ ...body, confirm: '' })).status, 400);
  assert.equal((await post({ ...body, table: 'auth.users' })).status, 400);
  assert.equal(calls.length, 0); assert.equal((await post(body)).status, 200); assert.equal(calls.length, 1);
});
test('회원 숨김·복구는 활성 상태까지 변경하고 삭제는 Auth·Storage를 정리', async () => {
  const calls = []; let photosRead = false;
  const db = { from(table) { const chain = { operation: '', payload: null, update(payload) { this.operation = 'update'; this.payload = payload; return this; }, delete() { this.operation = 'delete'; return this; }, select() { return this; }, eq() { return this; }, in() { return this; }, limit() { return this; }, then(resolve) { calls.push({ table, operation: this.operation, payload: this.payload }); let data = [{ id: 1, user_id: 'fixture-user' }]; if (table === 'photo_records') { data = photosRead ? [] : [{ id: 2, storage_bucket: 'play-photos', file_path: 'fixture/photo.png' }]; photosRead = true; } return Promise.resolve({ data, error: null }).then(resolve); } }; return chain; }, storage: { from: () => ({ remove: async paths => { calls.push({ storage: paths }); return { error: null }; } }) }, auth: { admin: { deleteUser: async id => { calls.push({ auth: id }); return { error: null }; } } } };
  const data = loader({ '@/lib/supabase/admin': { createAdminClient: () => db } })('@/lib/admin-data');
  await data.mutateRecords('subscribers', [1], 'hide'); assert.deepEqual(calls[0].payload, { deleted: true, is_active: false });
  await data.mutateRecords('subscribers', [1], 'restore'); assert.deepEqual(calls[1].payload, { deleted: false, is_active: true });
  await data.mutateRecords('subscribers', [1], 'delete'); assert.ok(calls.some(c => c.auth === 'fixture-user')); assert.ok(calls.some(c => c.storage?.[0] === 'fixture/photo.png'));
  assert.ok(data.csv([{ id: 1, text: '=SUM(A1)' }]).includes("'=SUM(A1)"));
});
test('기존 공지 블록·안내 상자·이미지와 게시 기간을 보존', () => {
  const content = loader()('@/lib/platform-content');
  const record = { title: 'fixture', content: '', is_active: true, deleted: false, content_blocks: [{ type: 'image', image_path: 'test.png', image_bucket: 'platform-notice-images' }, { type: 'callout', callout_title: '안내', text: '내용' }] };
  const doc = content.documentFrom(record); assert.equal(doc.assets.length, 1); assert.ok(doc.body.includes(':::callout|info|안내'));
  assert.equal(content.visible({ ...record, display_start_at: '2999-01-01T00:00:00Z' }), false);
  assert.equal(content.visible({ ...record, deleted: true }), false);
  assert.equal(content.safeLink('javascript:alert(1)'), '');
});
test('공지 저장은 기존 시간대·서식을 받아들이고 잘못된 링크·예약은 차단', async () => {
  const writes = [];
  const db = { from() { return { insert(payload) { writes.push(payload); return this; }, select() { return this; }, async single() { return { data: { ...writes.at(-1), id: 10 }, error: null }; } }; } };
  const route = loader({ '@/lib/admin-session': { requireAdmin: async () => {}, sameOrigin: () => true }, '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/platform-content-server': { signContent: async row => row, cleanupContentAssets: async () => {} } })('@/app/api/admin/content/route');
  const record = { title: '테스트', content: '본문', is_active: true, deleted: false, display_start_at: '2026-09-01T00:00:00+00:00', display_end_at: '2026-09-30T00:00:00+00:00', content_blocks: [{ type: 'document-v2', body: '**본문**', assets: [], attachments: [] }] };
  const post = row => route.POST(new Request('http://localhost/api/admin/content', { method: 'POST', body: JSON.stringify({ kind: 'notices', record: row }) }));
  assert.equal((await post(record)).status, 200);
  assert.equal(writes[0].content_blocks[0].body, '**본문**');
  assert.equal((await post({ ...record, link_url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await post({ ...record, display_end_at: '2026-08-01T00:00:00Z' })).status, 400);
  assert.equal(writes.length, 1);
});
