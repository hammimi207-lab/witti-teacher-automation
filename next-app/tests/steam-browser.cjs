/* Browser coverage uses the real client components with offline, consented API fixtures. */
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), ts = require("typescript"), sharp = require("sharp");
const { webpack } = require("next/dist/compiled/webpack/webpack"), { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."), work = fs.mkdtempSync(path.join(os.tmpdir(), "girok-steam-browser-"));
const analysis = { photoFacts: [{ photo: 1, fact: "손에 블록을 잡고 있다." }], cards: [{ area: "E 공학", evidence: [{ source: "observation", photo: 0, quote: "블록을 올려놓았다" }], interpretation: "구성 방법 탐색 가능성", watch: "놓는 방법", extension: "큰 블록을 제공해 보기", status: "배움의 가능성" }], support: { materials: ["큰 블록", "낮은 매트"], teacher: "여기에 놓아 볼까?", watch: ["놓는 위치", "반복 시도"], safety: "작은 부품 제외" } };

test("STEAM photo/recording workflow preserves edits, isolates proposals, retries saves and reopens", { timeout: 120000 }, async () => {
  function copy(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name), relative = path.relative(path.join(root, "src"), file), target = path.join(work, relative);
      if (item.isDirectory()) copy(file);
      else if (/\.tsx?$/.test(file)) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target.replace(/\.tsx?$/, ".js"), ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText); }
      else if (/\.module\.css$/.test(file)) { fs.mkdirSync(path.dirname(target), { recursive: true }); const css = fs.readFileSync(file, "utf8"); const names = [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(value => value[1]); const prefix = path.basename(file, ".module.css"); fs.writeFileSync(target, `module.exports=${JSON.stringify(Object.fromEntries(names.map(name => [name, `test-${prefix}-${name}`])))};`); }
    }
  }
  copy(path.join(root, "src/features"));
  fs.writeFileSync(path.join(work, "entry.js"), `window.process={env:{NODE_ENV:'development'}};const React=require('react'),{createRoot}=require('react-dom/client'),{SteamWorkflow}=require('./features/steam/workflow');createRoot(document.getElementById('root')).render(React.createElement(SteamWorkflow,{userId:'owner',initial:window.__initial}));`);
  await new Promise((resolve, reject) => webpack({ mode: "development", devtool: false, entry: path.join(work, "entry.js"), output: { path: work, filename: "bundle.js" }, resolve: { modules: [path.join(root, "node_modules")], alias: { "@": work } } }, (error, stats) => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const globalCss = await require("postcss")([require("@tailwindcss/postcss")()]).process(fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8"), { from: path.join(root, "src/app/globals.css") });
  const css = globalCss.css + ["steam/workflow", "records/record-assembly"].map(file => fs.readFileSync(path.join(root, `src/features/${file}.module.css`), "utf8").replace(/\.([a-zA-Z][\w-]*)/g, `.test-${path.basename(file)}-$1`)).join("\n");
  const image = await sharp({ create: { width: 50, height: 40, channels: 3, background: "#98bbaa" } }).jpeg().toBuffer();
  let stored = null, analyses = 0, saveCalls = 0, uploads = 0, failAnalysis = false, failUpload = true, failStory = false, storyCalls = 0;
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("content-type", "text/javascript"); res.end(fs.readFileSync(path.join(work, "bundle.js"))); }
    else if (req.url === "/style.css") { res.setHeader("content-type", "text/css"); res.end(css); }
    else if (/^\/api\/photos\/\d+$/.test(req.url)) { res.setHeader("content-type", "image/jpeg"); res.end(image); }
    else { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root" class="shell page-shell"></div><script>window.__initial=${req.url.includes("session=") ? JSON.stringify(stored) : "null"}</script><script src="/bundle.js"></script>`); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
    page.setDefaultTimeout(5000);
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/photos?*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ photos: [{ id: 1, original_file_name: "보관 사진", url: "/api/photos/1" }], hasMore: false }) }));
    await page.route("**/api/steam/analyze", route => {
      analyses++;
      const first = { ...analysis, cards: analysis.cards.map(card => ({ ...card, interpretation: analyses > 2 ? "새 분석 후보" : card.interpretation })) };
      const second = { ...analysis, photoFacts: [{ photo: 2, fact: "집게를 손에 잡고 있다." }], cards: [{ ...analysis.cards[0], area: "T 기술", evidence: [{ source: "observation", photo: 0, quote: "집게로 천을 집었다" }], interpretation: "집게로 천을 집는 방법을 알아가는 중일 수 있어요." }] };
      const result = { ...first, photoFacts: [...first.photoFacts, ...second.photoFacts], cards: [...first.cards, ...second.cards], plays: [{ photo: 1, analysis: first }, { photo: 2, analysis: second }] };
      const run = { runId: `11111111-1111-4111-8111-${String(analyses).padStart(12, "0")}`, model: "offline-fixture", promptVersion: "steam-play-ko-v1", schemaVersion: "steam-v1", generatedAt: "2026-10-05T00:00:00Z", inputHash: "a".repeat(64), photoHashes: ["b".repeat(64), "c".repeat(64)], originalAnalysis: result, checks: [{ area: "E 공학", source: "observation", quote: "블록을 올려놓았다", verdict: "passed", reason: "교사 관찰 인용 일치", startOffset: 4, endOffset: 14 }] };
      return route.fulfill({ status: failAnalysis ? 502 : 200, contentType: "application/json", body: JSON.stringify(failAnalysis ? { error: "분석 실패 테스트 · 다시 시도해 주세요" } : { analysis: result, run }) });
    });
    await page.route("**/api/records/save", route => { saveCalls++; const input = route.request().postDataJSON(); stored = { ...input, version: 1, savedKinds: ["record"] }; return route.fulfill({ status: 200, contentType: "application/json", body: '{"saved":true}' }); });
    await page.route("**/api/steam/story", async route => {
      storyCalls++; const body = route.request().postDataJSON();
      assert.equal(body.input.process.next, undefined); assert.equal(body.input.extension, undefined); assert.equal(body.input.draft, undefined);
      await new Promise(resolve => setTimeout(resolve, 400));
      return route.fulfill({ status: failStory ? 502 : 200, contentType: "application/json", body: JSON.stringify(failStory ? { error: "이야기 실패 테스트" } : { story: { text: "확인된 관찰\n아이가 블록을 올리고 내려놓았다.\n\n배움의 해석 (잠정적)\n구성 탐색의 가능성이 있다.", source: body.input } }) });
    });
    let failReferences = true;
    await page.route("**/api/steam/references", route => {
      const body = route.request().postDataJSON(); assert.deepEqual(Object.keys(body), ["query"]);
      return route.fulfill({ status: failReferences ? 503 : 200, contentType: "application/json", body: JSON.stringify(failReferences ? { error: "참고문헌 검색 실패 테스트" } : { query: body.query, checkedAt: "2026-10-05T00:00:00Z", references: [{ doi: "10.1234/test-fixture", title: "Offline fixture: Children block play", authors: "Fixture author", year: 2020, publication: "Fixture journal", type: "journal-article", url: "https://doi.org/10.1234/test-fixture", abstract: "Fixture abstract", matched: ["block"] }] }) });
    });
    await page.route("**/api/photos", route => { uploads++; return route.fulfill({ status: failUpload ? 503 : 200, contentType: "application/json", body: JSON.stringify(failUpload ? { error: "사진 보관 실패 테스트" } : { saved: true, id: 2 }) }); });
    let recordingId;
    await page.route("**/api/observations/recording-history", route => {
      if (route.request().method() === "POST") { const body = route.request().postDataJSON(); recordingId = body.id; assert.deepEqual(Object.keys(body).sort(), ["id", "playId", "recordedAt"]); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: recordingId }) }); }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recordings: recordingId ? [{ fragment_id: recordingId, recorded_at: "2026-10-03T00:00:00Z", play_topic: "블록" }] : [] }) });
    });
    await page.route("**/api/observations/audio-file", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "블록을 다시 내려놓았다." }) }));
    await page.route("**/api/observations/recordings", () => { throw Error("Audio must not be stored"); });
    await page.route("**/api/observations/plays", route => route.fulfill({ status: 200, contentType: "application/json", body: '{"plays":[],"links":[]}' }));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url + "/records/steam");
    try { await page.getByLabel("연령", { exact: true }).waitFor({ timeout: 5000 }); }
    catch (error) { throw new Error(`${error.message}\nBrowser errors: ${JSON.stringify(errors)}\nBody: ${await page.locator("body").innerText()}`); }
    assert.equal(await page.getByLabel("연령", { exact: true }).inputValue(), "2세");
    await page.getByRole("button", { name: "기존 사진 보관함 열기" }).click(); await page.getByLabel("보관 사진", { exact: true }).check();
    await page.getByLabel("새 사진 선택").setInputFiles({ name: "new.jpg", mimeType: "image/jpeg", buffer: image });
    await page.getByRole("heading", { name: "선택 사진 2장" }).waitFor();
    await page.getByLabel("새 사진 선택").setInputFiles([3, 4, 5].map(index => ({ name: `photo-${index}.jpg`, mimeType: "image/jpeg", buffer: image })));
    await page.getByRole("heading", { name: "선택 사진 5장" }).waitFor();
    await page.getByRole("button", { name: "2. 관찰 더하기", exact: true }).click();
    for (let number = 1; number <= 5; number++) { assert.equal(await page.getByLabel(`사진 ${number} · 아이의 말`, { exact: true }).count(), 1); assert.equal(await page.getByLabel(`사진 ${number} · 아이의 행동`, { exact: true }).count(), 1); assert.equal(await page.getByLabel(`사진 ${number} · 놀이 흐름`, { exact: true }).count(), 1); }
    await page.getByLabel("사진 5 · 아이의 말").fill("제거한 사진의 말은 분석에 포함하지 않음");
    await page.getByRole("button", { name: "1. 사진 올리기", exact: true }).click();
    for (let index = 0; index < 3; index++) await page.getByRole("button", { name: "선택 해제", exact: true }).last().click();
    await page.getByRole("button", { name: "2. 관찰 더하기", exact: true }).click();
    await page.getByLabel("사진 1 · 아이의 행동").fill("아이가 블록을 올려놓았다.");
    await page.getByLabel("사진 2 · 아이의 행동").fill("집게로 천을 집었다.");
    await page.getByLabel("사진 2 · 아이의 말").fill("다시 해 볼래.");
    await page.getByRole("button", { name: "사진 1 관찰 녹음 · 파일 업로드" }).click();
    await page.getByLabel("녹음 파일 업로드").setInputFiles({ name: "observation.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("offline audio fixture") });
    await page.getByRole("checkbox", { name: "음성 파일을 AI 전사 서비스에 전송하는 데 동의합니다." }).check();
    await page.getByRole("button", { name: "전사하기", exact: true }).click();
    await page.getByLabel("교사 확인 전사문").waitFor();
    assert.equal(await page.getByRole("link", { name: "녹음 파일 따로 저장" }).count(), 1);
    page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "관찰 녹음 닫기" }).click();
    assert.equal(await page.getByLabel("교사 확인 전사문").isVisible(), true);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "STEAM 관찰에 추가" }).click();
    assert.match(await page.getByLabel("사진 1 · 놀이 흐름").inputValue(), /다시 내려놓았다/);
    assert.equal(await page.getByLabel("사진 2 · 놀이 흐름").inputValue(), "");
    await page.getByRole("button", { name: "관찰 녹음 · 녹음 파일 업로드" }).click();
    assert.equal(await page.getByLabel("교사 확인 전사문").count(), 0);
    assert.equal(await page.locator("dialog audio").count(), 0);
    await page.getByRole("heading", { name: "녹음 실행 이력" }).waitFor();
    page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "관찰 녹음 닫기" }).click();
    await page.getByRole("button", { name: "3. STEAM 읽기", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "사진과 관찰 함께 분석" }).isDisabled(), true);
    await page.getByRole("checkbox", { name: /입력한 관찰 내용과/ }).check(); await page.getByRole("checkbox", { name: /사진 속 아동의/ }).check();
    failAnalysis = true; await page.getByRole("button", { name: "사진과 관찰 함께 분석" }).click(); await page.getByRole("alert").filter({ hasText: "분석 실패 테스트" }).waitFor();
    failAnalysis = false; await page.getByRole("button", { name: "사진과 관찰 함께 분석" }).click();
    const analysisProgress = page.getByRole("region", { name: "사진과 관찰에서 STEAM 읽기", exact: true });
    await analysisProgress.waitFor();
    assert.equal(await analysisProgress.getAttribute("aria-busy"), "true");
    assert(await analysisProgress.getByRole("status").evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16));
    await page.waitForTimeout(750);
    fs.mkdirSync(path.join(root, "../outputs"), { recursive: true });
    await analysisProgress.screenshot({ path: path.join(root, "../outputs/steam-analysis-progress.png") });
    try { await page.getByRole("region", { name: "사진 1의 놀이 분석", exact: true }).getByLabel("이 행동에서 배울 수 있는 것 · 교사의 해석", { exact: true }).fill("교사가 수정한 구성 탐색 가능성"); }
    catch (error) { throw new Error(`${error.message}\nBrowser errors: ${JSON.stringify(errors)}\nBody: ${await page.locator("body").innerText()}`); }
    await page.getByRole("region", { name: "사진 1의 놀이 분석", exact: true }).getByLabel("과정 기록의 해석으로 선택").check(); await page.getByRole("button", { name: "선택한 해석 가져오기" }).click();
    await page.getByRole("heading", { name: "T 기술 · 도구를 써 보는 놀이" }).waitFor();
    await page.getByRole("heading", { name: "E 공학 · 놓고 이어 만드는 놀이" }).waitFor();
    assert.doesNotMatch(await page.getByLabel("기록에 사용할 교사 해석").inputValue(), /집게/);
    await page.getByRole("button", { name: "4. 놀이 이어가기", exact: true }).click();
    assert.equal(await page.getByRole("heading", { name: "재료와 놀이 공간", exact: true }).count(), 2);
    assert.equal(await page.getByRole("heading", { name: "다음 놀이에서 관찰할 행동", exact: true }).count(), 2);
    await page.getByRole("heading", { name: "내 지원 계획 · 교사 작성", exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, "../outputs/steam-support-mobile.png"), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.getByRole("button", { name: "사진 1의 제안을 내 계획으로 가져오기" }).click();
    await page.getByRole("button", { name: "5. 과정 기록하기", exact: true }).click();
    assert.equal(await page.getByLabel("아이 별칭", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "확인한 과정으로 초안 만들기" }).click();
    const draftField = page.getByLabel("과정 중심 관찰기록 초안 · 직접 수정", { exact: true });
    assert.match(await draftField.inputValue(), /교사 보충 필요/); assert.doesNotMatch(await draftField.inputValue(), /큰 블록/);
    await draftField.fill((await draftField.inputValue()) + "\n교사 수정 내용 유지");
    await page.getByRole("button", { name: "3. STEAM 읽기", exact: true }).click();
    await page.getByRole("button", { name: "다시 분석하기" }).click(); await page.getByRole("heading", { name: "새 분석 후보" }).waitFor();
    assert.equal(await page.getByRole("region", { name: "사진 1의 놀이 분석", exact: true }).getByLabel("이 행동에서 배울 수 있는 것 · 교사의 해석", { exact: true }).inputValue(), "교사가 수정한 구성 탐색 가능성");
    await page.getByRole("button", { name: "새 카드 반영" }).click();
    assert.match(await page.getByLabel("기록에 사용할 교사 해석").inputValue(), /교사가 수정한/);
    await page.getByRole("button", { name: "5. 과정 기록하기", exact: true }).click(); assert.match(await draftField.inputValue(), /교사 수정 내용 유지/);
    const storyButton = page.getByRole("button", { name: "확인된 관찰로 놀이 이야기 만들기" });
    await page.getByRole("checkbox", { name: /초안을 실제 관찰과/ }).check();
    await storyButton.click();
    await page.getByRole("region", { name: "확인된 관찰을 놀이 이야기로 연결하기" }).waitFor();
    assert.equal(await page.locator('svg line').count() > 0, true);
    fs.mkdirSync(path.join(root, "../outputs"), { recursive: true });
    await page.waitForTimeout(750);
    await page.getByRole("region", { name: "확인된 관찰을 놀이 이야기로 연결하기" }).screenshot({ path: path.join(root, "../outputs/steam-story-assembly.png") });
    const storyField = page.getByLabel("놀이 이야기 · 직접 수정", { exact: true });
    await storyField.waitFor(); await page.getByRole("region", { name: "확인된 관찰을 놀이 이야기로 연결하기" }).waitFor({ state: "detached" });
    assert.equal(page.url(), url + "/records/steam"); assert.match(await draftField.inputValue(), /교사 수정 내용 유지/);
    await page.waitForFunction(() => document.activeElement?.id === "steam-play-story");
    assert.equal(await storyField.getAttribute("rows"), "12");
    await page.screenshot({ path: path.join(root, "../outputs/steam-story-result.png"), fullPage: true });
    await storyField.fill((await storyField.inputValue()) + "\n놀이 이야기 교사 수정");
    await page.getByRole("checkbox", { name: /초안을 실제 관찰과/ }).check();
    page.once("dialog", dialog => dialog.dismiss()); await storyButton.click(); assert.equal(storyCalls, 1);
    failStory = true; page.once("dialog", dialog => dialog.accept()); await storyButton.click();
    await page.getByRole("alert").filter({ hasText: "이야기 실패 테스트" }).waitFor();
    assert.match(await storyField.inputValue(), /놀이 이야기 교사 수정/); failStory = false;
    const confirmedBeforeChange = await page.getByLabel("확인된 관찰", { exact: true }).inputValue();
    await page.getByLabel("확인된 관찰", { exact: true }).fill("아이가 블록을 올려놓고 내려놓았다. 직접 확인한 관찰.");
    assert.equal(await page.getByRole("button", { name: "확인한 기록 저장" }).isDisabled(), true);
    await page.getByRole("alert").filter({ hasText: "이야기의 근거" }).waitFor();
    await page.getByLabel("확인된 관찰", { exact: true }).fill(confirmedBeforeChange);
    await page.getByRole("checkbox", { name: /초안을 실제 관찰과/ }).check(); await page.getByRole("button", { name: "확인한 기록 저장" }).click();
    await page.getByRole("alert").filter({ hasText: "사진 보관 실패 테스트" }).waitFor();
    assert.match(await draftField.inputValue(), /교사 수정 내용 유지/);
    failUpload = false; await page.getByRole("button", { name: "확인한 기록 저장" }).click(); await page.getByRole("status").filter({ hasText: "과정 기록과 사진 연결을 저장" }).waitFor();
    assert.equal(saveCalls, 3); assert.equal(uploads, 2); assert.deepEqual(stored.steam.photoIds, [1, 2]); assert.deepEqual(stored.steam.recordingIds, [recordingId]);
    assert.equal(stored.input.childAlias, "놀이 관찰");
    assert.equal(stored.steam.photoObservations[0].action, "아이가 블록을 올려놓았다.");
    assert.equal(stored.steam.photoObservations[1].action, "집게로 천을 집었다.");
    assert.equal(stored.steam.photoObservations[1].flow, "");
    assert.doesNotMatch(stored.steam.sourceObservation, /제거한 사진의 말/);
    assert.match(stored.result.integratedRecord, /놀이 이야기 교사 수정/); assert.match(stored.steam.draft, /교사 수정 내용 유지/);
    assert.doesNotMatch(stored.result.observation, /큰 블록/); assert.match(stored.result.connection, /큰 블록/); assert.match(stored.result.interpretation, /교사가 수정한/);
    assert.equal(stored.steam.previousRuns.length, 1); assert.equal(stored.steam.run.originalAnalysis.cards[0].interpretation, "새 분석 후보");
    assert.equal(stored.steam.previousRuns[0].promptVersion, "steam-play-ko-v1");
    await page.reload(); await draftField.waitFor(); assert.match(await draftField.inputValue(), /교사 수정 내용 유지/);
    assert.match(await storyField.inputValue(), /놀이 이야기 교사 수정/);
    await page.getByRole("button", { name: "2. 관찰 더하기", exact: true }).click();
    assert.equal(await page.getByLabel("사진 1 · 아이의 행동").inputValue(), "아이가 블록을 올려놓았다.");
    assert.equal(await page.getByLabel("사진 2 · 아이의 행동").inputValue(), "집게로 천을 집었다.");
    await page.getByRole("button", { name: "5. 과정 기록하기", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "확인한 기록 저장" }).isDisabled(), true);
    await page.getByRole("checkbox", { name: /초안을 실제 관찰과/ }).check();
    assert.equal(await storyButton.isDisabled(), true);
    await page.getByRole("checkbox", { name: /입력한 관찰 내용과/ }).check();
    await page.getByRole("checkbox", { name: /사진 속 아동의/ }).check();
    assert.equal(await storyButton.isDisabled(), false);
    await page.getByRole("button", { name: "6. 참고문헌 더보기", exact: true }).click();
    assert.match(await page.getByLabel("놀이 참고문헌 검색어").inputValue(), /block/);
    await page.getByRole("button", { name: "이 놀이의 참고문헌 찾기" }).click();
    await page.getByRole("alert").filter({ hasText: "참고문헌 검색 실패 테스트" }).waitFor();
    assert.equal(await page.locator('a[href*="doi.org"]').count(), 0);
    failReferences = false; await page.getByRole("button", { name: "이 놀이의 참고문헌 찾기" }).click();
    await page.getByRole("heading", { name: "Offline fixture: Children block play" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "원문·출판사 페이지 보기" }).getAttribute("href"), "https://doi.org/10.1234/test-fixture");
    await page.getByText(/서지 정보와 등록 초록 일부 확인 · 원문 미열람/).waitFor();
    await page.getByRole("button", { name: "5. 과정 기록하기", exact: true }).click();
    await page.getByRole("button", { name: "6. 참고문헌 더보기", exact: true }).click();
    await page.getByRole("heading", { name: "Offline fixture: Children block play" }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    fs.mkdirSync(path.join(root, "../outputs"), { recursive: true }); await page.screenshot({ path: path.join(root, "../outputs/steam-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "3. STEAM 읽기", exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await page.locator('input[type="checkbox"]').first().evaluate(element => element.getBoundingClientRect().width <= 24));
    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const consent = page.getByRole("checkbox", { name: /입력한 관찰 내용과/ }).locator("..");
      assert(await consent.locator("span").evaluate(element => element.getBoundingClientRect().width >= 150), `Consent text collapsed at ${width}px`);
      assert(await consent.locator("input").evaluate(element => element.getBoundingClientRect().width <= 24));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, "../outputs/steam-analysis-mobile.png"), fullPage: true });
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
