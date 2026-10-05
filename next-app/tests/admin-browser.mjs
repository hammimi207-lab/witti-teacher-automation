// 로컬 관리자 인증만 실제 호출합니다. 데이터 변경과 파일 업로드는 모두 가로챕니다.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/sungm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const writes = [];
  await page.route('**/api/admin/data**', async route => {
    if (route.request().method() === 'POST') { writes.push(route.request().postDataJSON()); return route.fulfill({ json: { count: 1 } }); }
    return route.fulfill({ json: { rows: [{ id: 1, username: 'fixture_teacher', email: 'fixture@example.com', deleted: false }], count: 1 } });
  });
  await page.route('**/api/admin/stats**', route => route.fulfill({ json: [{ table: 'subscribers', count: 1, distribution: {} }, { table: 'play_sessions', count: 1, distribution: { '놀이 이야기': 1 } }] }));
  await page.route('**/api/admin/content**', async route => {
    if (route.request().method() === 'POST') { const body = route.request().postDataJSON(); writes.push(body); return route.fulfill({ json: { ...body.record, id: 99 } }); }
    return route.fulfill({ json: [] });
  });
  await page.goto('http://localhost:3000/admin');
  await page.waitForURL('**/admin/login');
  await page.getByLabel('관리자 아이디', { exact: true }).fill(process.env.ADMIN_ID || process.env.id);
  await page.getByLabel('관리자 비밀번호', { exact: true }).fill(process.env.ADMIN_PASSWORD || process.env.password);
  await page.getByRole('button', { name: '관리자 로그인', exact: true }).click();
  await page.waitForURL('**/admin');
  await page.getByText('fixture_teacher', { exact: true }).waitFor();
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('checkbox', { name: '1번 선택', exact: true }).check();
  await page.getByRole('button', { name: '선택 기록 숨김', exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(writes[0].action, 'hide');
  await page.getByRole('tab', { name: '공지사항', exact: true }).click();
  await page.getByLabel('공지 제목', { exact: true }).fill('모의 공지');
  await page.getByLabel('본문', { exact: true }).fill('**공지 내용**');
  await page.getByRole('button', { name: '공지사항 저장', exact: true }).click();
  await page.getByText('공지사항을 저장했습니다.', { exact: true }).waitFor();
  assert.equal(writes[1].record.content_blocks[0].body, '**공지 내용**');
  await page.getByRole('tab', { name: '방문 팝업', exact: true }).click();
  await page.getByLabel('관리용 제목', { exact: true }).waitFor();
  assert.equal(await page.locator('label').filter({ hasText: '표시 대상' }).locator('select').inputValue(), 'all');
  await page.screenshot({ path: process.env.TEMP + '/witti-admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 850 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: process.env.TEMP + '/witti-admin-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '관리자 로그아웃', exact: true }).click();
  await page.waitForURL('**/admin/login');
  console.log('PASS: separate admin login, mocked hide/save, popup editor, mobile overflow, logout');
} finally { await browser.close(); }
