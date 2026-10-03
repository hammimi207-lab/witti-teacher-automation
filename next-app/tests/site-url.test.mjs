import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(path, mocks = {}, env = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', 'process', code)(
    name => name in mocks ? mocks[name] : require(name), loaded, loaded.exports, { env },
  );
  return loaded.exports;
}
test('public origin defaults to v2 in production, supports local and preview overrides', () => {
  const url = env => load('lib/site-url.ts', {}, env).getSiteUrl();
  assert.equal(url({ NODE_ENV: 'production' }), 'https://girok-fairy-v2.vercel.app');
  assert.equal(url({ NODE_ENV: 'development' }), 'http://localhost:3000');
  assert.equal(url({ NEXT_PUBLIC_APP_URL: ' https://kidbom.app/ ' }), 'https://kidbom.app');
  assert.equal(url({ NEXT_PUBLIC_APP_URL: 'https://preview.example' }), 'https://preview.example');
  for (const value of ['javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?x=1', 'https://example.com/#fragment', 'http://kidbom.app']) {
    assert.throws(() => url({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: value }));
  }
});
test('recovery callbacks preserve their originating domain and handle invalid codes', async () => {
  for (const origin of ['https://girok-fairy-v2.vercel.app', 'https://kidbom.app', 'https://girok-fairy.vercel.app', 'http://localhost:3000']) {
    for (const success of [true, false]) {
      let exchanged;
      const route = load('app/auth/recovery-callback/route.ts', {
        '@/lib/supabase/server': { createClient: async () => ({ auth: {
          exchangeCodeForSession: async code => { exchanged = code; return { error: success ? null : new Error('expired') }; },
        } }) },
      });
      const response = await route.GET(new Request(`${origin}/auth/recovery-callback?code=test-code&next=https://evil.example`));
      assert.equal(exchanged, 'test-code');
      assert.equal(response.headers.get('location'), `${origin}/account-recovery?mode=password&${success ? 'verified' : 'error'}=1`);
      const missing = await route.GET(new Request(`${origin}/auth/recovery-callback`));
      assert.equal(missing.headers.get('location'), `${origin}/account-recovery?mode=password&error=1`);
    }
  }
});
