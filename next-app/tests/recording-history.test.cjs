const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
test('recording history authenticates, keeps only metadata and checks play ownership', async () => {
  let signedIn = true, hasPlay = true, writes = [], selected = '';
  const query = table => {
    const q = { select: fields => { selected = fields; return q; }, eq: () => q, is: () => q, order: () => q, limit: () => q,
      maybeSingle: async () => ({ data: table === 'play_clusters' ? hasPlay ? { title: '기찻길 놀이' } : null : { fragment_id: 'id' }, error: null }),
      upsert: data => { writes.push({ table, data }); return q; }, then: resolve => resolve({ data: [], error: null }) }; return q;
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api/observations/recording-history/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => id === '@/lib/supabase/server' ? { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'owner' } : null } }) } }) } : id === '@/lib/supabase/admin' ? { createAdminClient: () => ({ from: query }) } : require(id), module, module.exports);
  const route = module.exports, input = { id: '11111111-1111-4111-8111-111111111111', recordedAt: '2026-10-05T00:00:00Z', playId: '22222222-2222-4222-8222-222222222222', raw_text: 'must not persist', transcript: 'must not persist' };
  const post = (origin = 'https://app.test') => route.POST(new Request('https://app.test/api/observations/recording-history', { method: 'POST', headers: { origin }, body: JSON.stringify(input) }));
  assert.equal((await post('https://other.test')).status, 403);
  signedIn = false; assert.equal((await post()).status, 401); signedIn = true;
  hasPlay = false; assert.equal((await post()).status, 404); assert.equal(writes.length, 0); hasPlay = true;
  assert.equal((await post()).status, 200);
  assert.deepEqual(writes.map(item => item.table), ['record_fragments', 'play_fragment_links']);
  assert.equal(writes[0].data.raw_text, null); assert.equal(writes[0].data.play_topic, '기찻길 놀이');
  assert.doesNotMatch(JSON.stringify(writes), /must not persist/);
  await route.GET(); assert.equal(selected, 'fragment_id,recorded_at,play_topic');
});
