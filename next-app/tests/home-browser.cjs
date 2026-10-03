/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS browser test harness and compiled TS module loader. */
// Isolated check of real components, CSS and layout with a consented anonymous fixture.
// Uses an existing Playwright installation (PLAYWRIGHT_MODULE) and Edge; no auth bypass in the app.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const ts = require("typescript"), React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "girok-home-check-"));
const artifacts = path.join(root, "../outputs/home-check");
fs.mkdirSync(artifacts, { recursive: true });
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
function loadLayout(file) {
  const target = { exports: {} };
  const mocks = {
    "next/link": { __esModule: true, default: props => React.createElement("a", props) },
    "next/navigation": { usePathname: () => "/" },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@/lib/confidentiality": { validConsent: async () => true },
    "@/lib/supabase/config": { hasSupabaseConfig: () => false },
    "@/lib/supabase/server": {},
    "@/features/records/logout-button": { LogoutButton: () => null },
    "@/features/admin/public-announcements": { PublicAnnouncements: () => null },
  };
  new Function("require", "module", "exports", transpile(fs.readFileSync(file, "utf8")))(id => {
    if (id.endsWith(".css")) return {};
    if (mocks[id]) return mocks[id];
    if (id.startsWith("@/")) return loadLayout([".tsx", ".ts"].map(ext => path.join(root, "src", id.slice(2) + ext)).find(fs.existsSync));
    return require(id);
  }, target, target.exports);
  return target.exports;
}
async function main() {
  for (const file of fs.readdirSync(path.join(root, "src/features/home"))) fs.writeFileSync(path.join(work, file.replace(/\.tsx?$/, ".js")), transpile(fs.readFileSync(path.join(root, "src/features/home", file), "utf8")));
  fs.writeFileSync(path.join(work, "entry.js"), `const React=require('react');const {createRoot}=require('react-dom/client');const {HomeHero}=require('./home-hero');const {QuickActionGrid}=require('./quick-action-grid');createRoot(document.getElementById('home-root')).render(React.createElement(React.StrictMode,null,React.createElement('main',{className:'home-page task-home shell'},React.createElement(HomeHero),React.createElement(QuickActionGrid))));`);
  await new Promise((resolve, reject) => webpack({ mode: "development", devtool: false, entry: path.join(work, "entry.js"), output: { path: work, filename: "bundle.js" }, resolve: { modules: [path.join(root, "node_modules")] } }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const css = await require("postcss")([require("@tailwindcss/postcss")()]).process(fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8"), { from: path.join(root, "src/app/globals.css") });
  const layout = await loadLayout(path.join(root, "src/app/layout.tsx")).default({ children: React.createElement("div", { id: "home-root" }) });
  const html = "<!doctype html>" + renderToStaticMarkup(layout).replace("</head>", '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head>').replace("</body>", '<script src="/bundle.js"></script></body>');
  const server = http.createServer((request, response) => {
    if (request.url === "/girok-fairy.svg") { response.setHeader("Content-Type", "image/svg+xml"); response.end(fs.readFileSync(path.join(root, "public/girok-fairy.svg"))); }
    else if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(fs.readFileSync(path.join(work, "bundle.js"))); }
    else if (request.url === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(css.css); }
    else { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const passed = [];
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
    const context = await browser.newContext({ permissions: ["microphone"] });
    const page = await context.newPage(), pageErrors = [];
    let transcriptionMode = "pending", transcriptionRequests = 0, releaseTranscription, firstRequestStarted;
    const firstTranscriptionRequest = new Promise(resolve => { firstRequestStarted = resolve; });
    const transcriptFixture = '아이가 블록을 쌓으며 "다시 해 볼래"라고 말했다.';
    await page.route("**/api/observations/transcribe", async route => {
      transcriptionRequests++;
      firstRequestStarted();
      assert.equal(route.request().method(), "POST");
      assert.match(route.request().headers()["content-type"], /multipart\/form-data/);
      if (transcriptionMode === "pending") await new Promise(resolve => { releaseTranscription = resolve; });
      await route.fulfill({ status: transcriptionMode === "error" ? 503 : 200, contentType: "application/json", body: JSON.stringify(transcriptionMode === "error" ? { error: "전사 테스트: 연결 실패" } : { text: transcriptFixture }) });
    });
    page.on("pageerror", error => pageErrors.push(error.message));
    for (const [width, height] of [[320, 640], [360, 640], [390, 844], [1280, 900]]) {
      await page.setViewportSize({ width, height }); await page.goto(url); await page.locator(".quick-action-card").first().waitFor();
      const bounds = await page.locator(".quick-action-card").evaluateAll(cards => cards.map(card => { const r = card.getBoundingClientRect(); return { y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }));
      assert.equal(bounds.length, 4); assert.equal(bounds[0].y, bounds[1].y);
      await page.screenshot({ path: path.join(artifacts, `home-${width}.png`), fullPage: true });
      assert.ok(bounds.every(b => b.width >= 48 && b.height >= 48 && b.right <= width && b.bottom <= height), JSON.stringify({ width, bounds }));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    passed.push("320/360/390/1280px: 2x2 grid, four actions above fold, no horizontal overflow");
    for (const [name, href] of [["새 기록 생성", "/records/new"], ["내 기록 보기", "/records"], ["로그인", "/login"], ["회원가입", "/signup"]]) assert.equal(await page.getByRole("link", { name: new RegExp(name) }).last().getAttribute("href"), href);
    passed.push("Existing record/login/signup destinations preserved");
    const pickerEvent = page.waitForEvent("filechooser"); await page.getByRole("button", { name: /사진 선별/ }).click(); const picker = await pickerEvent;
    assert.equal(picker.isMultiple(), true);
    const png = await require("sharp")({ create: { width: 100, height: 80, channels: 3, background: "#9acdc1" } }).png().toBuffer();
    await picker.setFiles([{ name: "놀이.png", mimeType: "image/png", buffer: png }, { name: "일상.png", mimeType: "image/png", buffer: png }, { name: "손상.png", mimeType: "image/png", buffer: Buffer.from("broken") }, { name: "메모.txt", mimeType: "text/plain", buffer: Buffer.from("text") }]);
    await page.getByText("3장 중 0장 선택", { exact: true }).waitFor();
    await page.getByText("사진을 열지 못했어요. 파일 형식과 손상 여부를 확인해 주세요.").waitFor();
    await page.getByRole("button", { name: "전체 사진", exact: true }).click();
    const limit = page.getByLabel("선별할 장 수", { exact: true });
    await limit.fill("1");
    await page.getByRole("checkbox", { name: "놀이.png", exact: true }).check();
    assert.equal(await page.getByRole("checkbox", { name: "일상.png", exact: true }).isDisabled(), true);
    await page.getByRole("checkbox", { name: "놀이.png", exact: true }).uncheck();
    assert.equal(await page.getByRole("checkbox", { name: "일상.png", exact: true }).isEnabled(), true);
    await limit.fill("");
    await page.getByRole("button", { name: "전체 선택", exact: true }).click(); await page.getByText("3장 중 2장 선택", { exact: true }).waitFor();
    await limit.fill("1");
    assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 2);
    await page.getByText("2장 선택 중 · 1장을 선택 해제해 주세요. 기존 선택은 유지했어요.", { exact: true }).waitFor();
    await limit.fill("2");
    const photoDownload = page.waitForEvent("download"); await page.getByRole("button", { name: "내려받기", exact: true }).first().click(); const originalDownload = await photoDownload; assert.equal(originalDownload.suggestedFilename(), "놀이.png"); assert.deepEqual(fs.readFileSync(await originalDownload.path()), png);
    await page.keyboard.press("Escape"); await page.getByRole("button", { name: "열어 둔 사진 3장 · 2장 선택" }).click(); await page.getByText("3장 중 2장 선택", { exact: true }).waitFor();
    assert.equal(await limit.inputValue(), "2");
    passed.push("Custom photo count/unlimited; cap blocks extra selection; deselection unlocks; lowering cap preserves picks; reopen retains count; original download bytes preserved");
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(artifacts, "photos-mobile.png") }); await page.getByRole("button", { name: "사진 선별 닫기" }).click();
    passed.push("One-click multiple picker; corrupt/unsupported errors; valid selection/download; state retained after close");
    await page.getByRole("button", { name: /관찰 녹음/ }).click();
    await page.getByRole("button", { name: "새 놀이 만들기" }).click();
    await page.getByLabel("새 놀이명").fill("블록 놀이");
    await page.getByRole("button", { name: "추가하고 선택" }).click();
    assert.equal(await page.getByRole("group", { name: "다음 녹음의 놀이" }).getByRole("radio", { name: "블록 놀이" }).isChecked(), true);
    await page.getByRole("button", { name: "녹음 시작", exact: true }).click(); await page.getByRole("button", { name: "녹음 마치기" }).waitFor(); await page.getByText(/녹음 중 · 0분 [1-9]/).waitFor();
    await page.getByRole("button", { name: "관찰 녹음 닫기" }).click(); await page.getByRole("button", { name: "이 화면의 녹음 1개 · 이어서 보기" }).click(); assert.equal(await page.locator("audio").count(), 1);
    await page.getByText("음성을 글로 옮기고 있어요…", { exact: true }).waitFor();
    await Promise.race([firstTranscriptionRequest, new Promise((_, reject) => setTimeout(() => reject(new Error("Automatic transcription request did not arrive")), 5000))]);
    transcriptionMode = "success"; releaseTranscription();
    await page.getByText(transcriptFixture, { exact: true }).waitFor();
    const firstPlay = page.getByRole("group", { name: "이 녹음을 어떤 놀이와 연결할까요?" }).first();
    assert.equal(await firstPlay.getByRole("radio", { name: "블록 놀이" }).isChecked(), true);
    await firstPlay.getByRole("radio", { name: "아직 연결하지 않기" }).check();
    await firstPlay.getByText(/기존 놀이 후보예요/).waitFor();
    assert.equal(await firstPlay.getByRole("radio", { name: "블록 놀이" }).isChecked(), false);
    await firstPlay.getByRole("radio", { name: "블록 놀이" }).check();
    await firstPlay.getByRole("button", { name: "새로운 놀이로 만들기" }).click();
    await firstPlay.getByLabel("새 놀이명").fill("길 만들기 놀이");
    await firstPlay.getByRole("button", { name: "추가하고 연결" }).click();
    assert.equal(await firstPlay.getByRole("radio", { name: "길 만들기 놀이" }).isChecked(), true);
    await firstPlay.getByRole("radio", { name: "블록 놀이" }).check();
    assert.equal(transcriptionRequests, 1);
    assert.ok(await page.locator("audio").evaluate(audio => audio.nextElementSibling.classList.contains("observation-transcript")));
    const transcriptDownload = page.waitForEvent("download"); await page.getByRole("button", { name: "전사문 내려받기" }).click(); assert.equal(fs.readFileSync(await (await transcriptDownload).path(), "utf8"), transcriptFixture);
    await page.getByLabel("짧은 관찰 메모").fill('민수가 "또 해볼래"라고 말했다.'); await page.screenshot({ path: path.join(artifacts, "observation-mobile.png") });
    const audioDownload = page.waitForEvent("download"); await page.getByRole("link", { name: "음성 내려받기" }).click(); assert.ok(fs.statSync(await (await audioDownload).path()).size > 0);
    await page.keyboard.press("Escape"); await page.getByRole("button", { name: "이 화면의 녹음 1개 · 이어서 보기" }).click(); assert.equal(await page.getByLabel("짧은 관찰 메모").inputValue(), '민수가 "또 해볼래"라고 말했다.');
    const memoDownload = page.waitForEvent("download"); await page.getByRole("button", { name: "메모 내려받기" }).click(); assert.equal(fs.readFileSync(await (await memoDownload).path(), "utf8"), '민수가 "또 해볼래"라고 말했다.');
    // Native dialogs may yield focus to browser chrome; the underlying page must stay inert.
    for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); assert.ok(await page.evaluate(() => document.activeElement === document.body || document.querySelector("dialog[open]").contains(document.activeElement))); }
    passed.push("Play selection before recording; transcript-based candidate after unlink; teacher relink; close stops; original note retained");
    transcriptionMode = "error";
    await page.getByRole("button", { name: "추가 녹음", exact: true }).click();
    await page.getByText(/녹음 중 · 0분 [1-9]/).waitFor(); await page.getByRole("button", { name: "녹음 마치기" }).click();
    await page.getByText("전사 테스트: 연결 실패", { exact: true }).waitFor();
    assert.equal(await page.locator("audio").count(), 2);
    transcriptionMode = "success"; await page.getByRole("button", { name: "전사 다시 시도" }).click();
    await page.getByRole("region", { name: "관찰 2 전사문", exact: true }).getByText(transcriptFixture, { exact: true }).waitFor();
    assert.equal(transcriptionRequests, 3);
    passed.push("Automatic transcription after stop; loading and exact text below audio; transcript download; close/reopen; provider failure preserves audio; retry succeeds (mocked API)");
    const denied = await context.newPage(); await denied.addInitScript(() => { window.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); }; });
    await denied.goto(url); await denied.getByRole("button", { name: /관찰 녹음/ }).click(); await denied.getByRole("button", { name: "녹음 시작", exact: true }).click(); await denied.getByRole("alert").filter({ hasText: "마이크 권한이 필요해요" }).waitFor(); await denied.keyboard.press("Escape");
    assert.ok(await denied.getByRole("button", { name: /관찰 녹음/ }).evaluate(element => element === document.activeElement));
    await denied.evaluate(() => { navigator.mediaDevices.getUserMedia = window.originalGetUserMedia; }); await denied.getByRole("button", { name: /관찰 녹음/ }).click(); await denied.getByRole("button", { name: "녹음 시작", exact: true }).click(); await denied.getByRole("button", { name: "녹음 마치기" }).waitFor(); await denied.keyboard.press("Escape");
    passed.push("Permission denial actionable; Escape restores trigger focus");
    const pending = await context.newPage(); await pending.addInitScript(() => { window.captureStopped = false; navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.resolveCapture = () => resolve({ getTracks: () => [{ stop: () => { window.captureStopped = true; } }] }); }); });
    await pending.goto(url); await pending.getByRole("button", { name: /관찰 녹음/ }).click(); await pending.getByRole("button", { name: "녹음 시작", exact: true }).click(); await pending.getByRole("button", { name: "권한 요청 취소" }).click(); await pending.evaluate(() => window.resolveCapture()); assert.equal(await pending.evaluate(() => window.captureStopped), true); await pending.getByRole("button", { name: "녹음 시작", exact: true }).waitFor();
    passed.push("Late permission after cancellation releases microphone without recording");
    const bulk = await context.newPage(); const outbound = [];
    await bulk.addInitScript(() => {
      window.livePhotoUrls = new Set(); window.decodingPhotos = 0; window.peakDecodingPhotos = 0;
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = create(blob); window.livePhotoUrls.add(url); return url; };
      URL.revokeObjectURL = url => { window.livePhotoUrls.delete(url); revoke(url); };
      const decode = window.createImageBitmap.bind(window);
      window.createImageBitmap = async (...args) => {
        const bitmap = await decode(...args); window.decodingPhotos++; window.peakDecodingPhotos = Math.max(window.peakDecodingPhotos, window.decodingPhotos);
        const close = bitmap.close.bind(bitmap); bitmap.close = () => { window.decodingPhotos--; close(); };
        return bitmap;
      };
    });
    bulk.on("request", request => { if (request.method() !== "GET" || (request.url().startsWith("http") && !request.url().startsWith(url))) outbound.push(request.url()); });
    await bulk.goto(url);
    const bulkPickerEvent = bulk.waitForEvent("filechooser"); await bulk.getByRole("button", { name: /사진 선별/ }).click(); const bulkPicker = await bulkPickerEvent;
    const fixtures = [];
    const sharp = require("sharp");
    for (let i = 0; i < 125; i++) {
      const scene = i % 2 === 0
        ? '<rect width="320" height="220" fill="#d9b075"/><rect x="80" y="55" width="70" height="100" fill="#d94235"/><rect x="150" y="100" width="95" height="55" fill="#e7c435"/><rect x="120" y="30" width="55" height="25" fill="#295fb3"/>'
        : '<rect width="320" height="220" fill="#78b6dd"/><rect y="145" width="320" height="75" fill="#358147"/><circle cx="220" cy="65" r="25" fill="#f4da72"/><path d="M30 155 100 65 170 155Z" fill="#256849"/>';
      const bytes = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220">${scene}</svg>`)).png().toBuffer();
      const file = path.join(work, `scene-${String(i).padStart(3, "0")}.png`); fs.writeFileSync(file, bytes);
      if (i < 5) { const handle = fs.openSync(file, "r+"); fs.ftruncateSync(handle, 22 * 1024 * 1024); fs.closeSync(handle); }
      fixtures.push(file);
    }
    await bulkPicker.setFiles(fixtures);
    await bulk.getByText("125장 중 0장 선택", { exact: true }).waitFor();
    await bulk.getByRole("progressbar").waitFor({ state: "hidden", timeout: 60000 });
    assert.equal(await bulk.locator(".photo-stack").count(), 2);
    assert.equal(await bulk.locator(".library-photo .error").count(), 0);
    assert.equal(await bulk.locator(".photo-stack-count").allTextContents().then(counts => counts.reduce((sum, text) => sum + Number(text.replace("장", "")), 0)), 125);
    await bulk.setViewportSize({ width: 1280, height: 900 });
    await bulk.screenshot({ path: path.join(artifacts, "photo-groups-desktop.png") });
    await bulk.setViewportSize({ width: 390, height: 844 });
    await bulk.locator(".photo-library").scrollIntoViewIfNeeded();
    await bulk.screenshot({ path: path.join(artifacts, "photo-groups-mobile.png") });
    await bulk.locator(".photo-stack").first().click();
    assert.equal(await bulk.locator(".library-photo").count(), 60);
    await bulk.getByRole("button", { name: "더 보기", exact: true }).click();
    assert.equal(await bulk.locator(".library-photo").count(), 63);
    await bulk.getByRole("button", { name: "전체 사진", exact: true }).click();
    assert.equal(await bulk.locator(".library-photo").count(), 60);
    const thumbSizes = await bulk.locator(".library-photo img").evaluateAll(async images => Promise.all(images.slice(0, 6).map(async image => { await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight, bytes: (await (await fetch(image.src)).blob()).size }; })));
    assert.ok(thumbSizes.every(image => image.width <= 256 && image.height <= 256 && image.bytes < 30000));
    await bulk.getByLabel("선별할 장 수", { exact: true }).fill("125");
    await bulk.getByRole("button", { name: "목록 비우기", exact: true }).click();
    assert.equal(await bulk.locator(".library-photo").count(), 0);
    assert.deepEqual(await bulk.evaluate(() => ({ urls: window.livePhotoUrls.size, decoded: window.decodingPhotos, peak: window.peakDecodingPhotos })), { urls: 0, decoded: 0, peak: 1 });
    assert.deepEqual(outbound, []);
    passed.push("125 photos, including five 22MB files (>110MB total), accepted locally; two actual visual groups; 256px compressed thumbnails; 60-at-a-time rendering; original files never uploaded; clear releases list");
    assert.deepEqual(pageErrors, []); fs.writeFileSync(path.join(artifacts, "results.json"), JSON.stringify({ passed, pageErrors }, null, 2)); console.log(passed.join("\n"));
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
    // Verify the recursive cleanup target stays within the temporary directory.
    assert.equal(path.dirname(path.resolve(work)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(work).startsWith("girok-home-check-")); fs.rmSync(work, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
