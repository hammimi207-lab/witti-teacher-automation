/* eslint-disable @typescript-eslint/no-require-imports */
// An isolated local Next harness renders the real RecordWizard. All service calls are mocked.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const ts = require("typescript");
for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
const { assembleNotice, greetingOptions } = require("../src/features/records/notice-workflow.ts");
const { buildStoryWordDocument } = require("../src/features/records/story-word-document.ts");
const { Packer } = require("docx");
const JSZip = require("jszip");
const runtime = path.resolve(__dirname, "../.qa/notice-runtime");
fs.mkdirSync(path.join(runtime, "app"), { recursive: true });
fs.writeFileSync(path.join(runtime, "package.json"), JSON.stringify({ name: "notice-local-tests", private: true, dependencies: JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"))).dependencies }));
fs.writeFileSync(path.join(runtime, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["dom", "esnext"], jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", esModuleInterop: true, strict: true, skipLibCheck: true, paths: { "@/*": ["../../src/*"] }, plugins: [{ name: "next" }] }, include: ["app/**/*", ".next/types/**/*.ts"] }));
fs.writeFileSync(path.join(runtime, "next.config.js"), "module.exports = { experimental: { externalDir: true } };\n");
fs.writeFileSync(path.join(runtime, "app/layout.tsx"), 'import "../../../src/app/globals.css"; export default function Layout({children}:{children:React.ReactNode}) { return <html lang="ko"><body><main className="shell">{children}</main></body></html>; }');
fs.writeFileSync(path.join(runtime, "app/page.tsx"), 'import {RecordWizard} from "../../../src/features/records/record-wizard"; export default function Page(){return <RecordWizard userId="test-teacher"/>;}');
const port = 3117;
const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--webpack", "--port", String(port)], { cwd: runtime, windowsHide: true, env: { ...process.env, OPENAI_API_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", data => { log += data; }); server.stderr.on("data", data => { log += data; });
async function run() {
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw new Error(log);
    try { const response = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(10000) }); if (response.ok) break; if (response.status === 500) throw new Error(log); } catch (error) { if (log.includes("Syntax Error")) throw error; }
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (i === 89) throw new Error(log);
  }
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const context = await browser.newContext({ reducedMotion: "reduce", acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = []; page.on("pageerror", error => pageErrors.push(error.message));
    let templates = [{ id: "a2c92f23-1f0d-48b7-b2b0-367e72652801", title: "준비물", category: "생활", content: "{{날짜}} 준비물: {{준비물}}", created_at: "" }, { id: "a2c92f23-1f0d-48b7-b2b0-367e72652802", title: "행사", category: "일정", content: "{{시간}}에 {{장소}}에서 만나요.", created_at: "" }];
    const mutations = []; let generatedInput; let savedPayload; let wordPayload;
    await page.route("**/api/**", async route => {
      const request = route.request(); const url = new URL(request.url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname === "/api/records/announcements") {
        if (request.method() === "GET") return json({ announcements: templates });
        const data = request.postDataJSON(); mutations.push({ method: request.method(), data });
        if (request.method() === "DELETE") { templates = templates.filter(item => item.id !== data.id); return json({ deleted: true }); }
        const item = { ...data, id: data.id || "a2c92f23-1f0d-48b7-b2b0-367e72652803", created_at: "" };
        templates = [item, ...templates.filter(entry => entry.id !== item.id)]; return json({ announcement: item });
      }
      if (url.pathname === "/api/records/announcement-sources") return json({ announcements: [], scope: "본인의 최근 기록 100건 검색" });
      if (url.pathname === "/api/records/greetings") {
        const date = url.searchParams.get("date"); return json({ date, ...greetingOptions(date), holidayAvailable: false, weatherAvailable: false });
      }
      if (url.pathname === "/api/records/generate") {
        const requestData = new Request(request.url(), { method: "POST", headers: request.headers(), body: request.postDataBuffer() });
        generatedInput = JSON.parse((await requestData.formData()).get("input"));
        return json({ data: { finalNotice: assembleNotice("점심에 밥 두 숟가락을 먹었어요.", generatedInput), observationRefinementRows: [] }, generationId: "550e8400-e29b-41d4-a716-446655440000" });
      }
      if (url.pathname === "/api/records/save") { savedPayload = request.postDataJSON(); return json({ saved: true }); }
      if (url.pathname === "/api/records/word") {
        const body = await new Request(request.url(), { method: "POST", headers: request.headers(), body: request.postDataBuffer() }).formData();
        wordPayload = JSON.parse(body.get("record"));
        const buffer = await Packer.toBuffer(buildStoryWordDocument(wordPayload.title, wordPayload.result, wordPayload.input, wordPayload.createdAt));
        return route.fulfill({ status: 200, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: buffer });
      }
      return json({ data: [] });
    });
    await page.goto(`http://localhost:${port}`);
    await page.locator("#type").selectOption("알림장");
    await page.locator("#childAlias").fill("첫 아이"); await page.locator("#age").selectOption("3세");
    await page.getByText("일반형", { exact: true }).click(); await page.getByText("팩트 중심형", { exact: true }).click();
    await page.locator("#writingDate").fill("2030-01-04");
    await page.locator("#dailyObservation").fill("점심에 밥 두 숟가락을 먹었다.");
    assert.equal(await page.locator('[name="noticeMode"]').count(), 0);
    assert.equal(await page.locator("#observation").count(), 0);
    const commonNotice = page.getByRole("textbox", { name: "오늘 반 공통 공지", exact: true });
    await commonNotice.fill("내일 물통을 준비해 주세요.");
    await page.getByRole("button", { name: "공통 공지 등록", exact: true }).click();
    await page.getByText("반 공통 공지 수정하기", { exact: true }).click();
    assert.equal(await commonNotice.inputValue(), "내일 물통을 준비해 주세요.");
    await commonNotice.fill("내일 모자를 준비해 주세요.");
    await page.getByRole("button", { name: "공통 공지 등록", exact: true }).click();
    await page.getByText("반 공통 공지 수정하기", { exact: true }).click();
    await page.getByRole("button", { name: "공지 해제", exact: true }).click();
    assert.equal(await commonNotice.inputValue(), "");
    await page.getByText("저장한 공지 불러오기 · 선택 사항", { exact: true }).click();
    await page.getByRole("button", { name: "+ 준비물 · 생활", exact: true }).click();
    await page.getByRole("button", { name: "+ 행사 · 일정", exact: true }).click();
    assert.equal(await page.locator('.notice-template-chips button[aria-pressed="true"]').count(), 2);
    await page.getByRole("button", { name: "이번 공지에 적용", exact: true }).click();
    await page.getByText("빈 자리표시자를 채워 주세요:", { exact: false }).waitFor();
    const editors = page.locator(".announcement-register textarea");
    await editors.nth(0).fill("10월 5일 준비물: 물통"); await editors.nth(1).fill("9시에 교실에서 만나요.");
    await page.getByRole("button", { name: "이번 공지에 적용", exact: true }).click();
    assert.equal(templates[0].content, "{{날짜}} 준비물: {{준비물}}");
    await page.getByText("다음에도 사용할 공지로 저장", { exact: true }).nth(0).click();
    await page.getByRole("button", { name: "공지 양식으로 저장", exact: true }).nth(0).click();
    await page.getByText("재사용 양식으로 저장했어요.", { exact: false }).waitFor();
    assert.equal(mutations[0].method, "POST"); assert(mutations[0].data.content.includes("{{날짜}}"));
    await page.getByRole("button", { name: "선택 해제", exact: true }).nth(1).click();
    assert.equal(await page.locator('.notice-template-chips button[aria-pressed="true"]').count(), 1);
    // Reuse the newly saved template, fill its placeholders, then remove that extra draft.
    await page.getByRole("button", { name: "+ 준비물 · 생활", exact: true }).click();
    assert((await editors.nth(1).inputValue()).includes("{{날짜}}"));
    await editors.nth(1).fill("10월 5일 준비물: 물통");
    await page.getByRole("button", { name: "이번 공지에 적용", exact: true }).click();
    await page.getByRole("button", { name: "선택 해제", exact: true }).nth(1).click();
    await page.getByText("저장된 원본 양식 관리", { exact: true }).click();
    await page.getByRole("button", { name: "원본 수정", exact: true }).nth(0).click();
    const original = page.getByRole("region", { name: "원본 양식 수정" });
    await original.getByLabel("제목", { exact: true }).fill("재사용 준비물");
    await original.getByRole("button", { name: "원본 양식 저장", exact: true }).click();
    await page.getByText("원본 양식을 수정했어요.", { exact: false }).waitFor();
    assert.equal(mutations.at(-1).method, "PATCH");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "양식 삭제", exact: true }).nth(0).click();
    await page.getByText("양식을 삭제했어요.", { exact: true }).waitFor();
    assert.equal(mutations.at(-1).method, "DELETE");
    assert.equal(await page.getByLabel("서두 및 마무리 인사 선택").count(), 0);
    await page.locator("#writingDate").fill("2030-01-07");
    await page.locator("#aiConsent").check();
    await page.getByRole("button", { name: "AI 기록 만들기", exact: false }).click();
    await page.locator("#finalNoticeEditor").waitFor();
    assert.equal(generatedInput.openingGreeting, "");
    assert.equal(generatedInput.closingGreeting, "");
    await page.getByRole("button", { name: "주말 인사", exact: true }).waitFor();
    await page.getByRole("button", { name: "오늘의 날씨 인사", exact: false }).click();
    assert((await page.locator("#openingGreeting").inputValue()).startsWith("안녕하세요."));
    await page.locator("#openingGreeting").fill("안녕하세요.");
    await page.getByRole("button", { name: "기본 마무리", exact: false }).click();
    await page.locator("#closingGreeting").fill("편안한 저녁 보내세요.");
    await page.getByRole("button", { name: "인사말을 알림장에 적용", exact: true }).click();
    await page.getByRole("button", { name: "인사말을 알림장에 적용", exact: true }).click();
    const greeted = await page.getByLabel("최종 알림장 미리보기").innerText();
    assert.equal(greeted.split("안녕하세요.").length, 2);
    assert(greeted.endsWith("편안한 저녁 보내세요."));
    await page.getByLabel("서두 및 마무리 인사 선택").screenshot({ path: path.resolve(__dirname, "../.qa/notice-greetings.png") });
    assert.equal(generatedInput.dailyObservation, "점심에 밥 두 숟가락을 먹었다.");
    assert.equal(generatedInput.playObservation, ""); assert.equal(generatedInput.noticeMode, "detailed");
    assert.equal(generatedInput.classAnnouncement, "10월 5일 준비물: 물통");
    const edited = "안녕하세요.\n\n오늘 밥 두 숟가락을 먹었어요.\n\n【전체 공지】\n준비물: 물통과 모자\n\n편안한 저녁 보내세요.";
    const finalEditor = page.locator("#finalNoticeEditor");
    if (await finalEditor.evaluate(node => node.tagName === "TEXTAREA")) await finalEditor.fill(edited);
    else {
      const rows = finalEditor.locator("textarea");
      const values = await rows.evaluateAll(nodes => nodes.map(node => node.value));
      await rows.nth(values.findIndex(value => value.includes("밥 두 숟가락"))).fill("오늘 밥 두 숟가락을 먹었어요.");
      await rows.nth(values.findIndex(value => value.includes("준비물:"))).fill("준비물: 물통과 모자");
    }
    // Move a sentence through the existing keyboard editor; final text is the sole saved source.
    await page.getByRole("button", { name: /2번 문장 이동:/ }).press("ArrowUp");
    const finalText = await page.getByLabel("최종 알림장 미리보기").innerText();
    assert.notEqual(finalText, edited);
    assert.equal(await page.getByLabel("최종 알림장 미리보기").innerText(), finalText);
    await page.getByRole("button", { name: "종합 기록 저장", exact: true }).click();
    await page.getByRole("button", { name: "종합 기록 저장 완료", exact: true }).waitFor();
    assert.equal(savedPayload.result.finalNotice, finalText);
    await page.keyboard.press("Escape");
    // Download may be behind the existing next-record dialog after saving. Invoke before dismissing if necessary.
    const downloadButton = page.getByRole("button", { name: "Word 문서 다운로드", exact: true });
    await downloadButton.click({ force: true });
    await page.waitForFunction(() => document.querySelector(".word-download button")?.textContent === "Word 문서 다운로드");
    assert.equal(wordPayload.result.finalNotice, finalText);
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildStoryWordDocument(wordPayload.title, wordPayload.result, wordPayload.input, wordPayload.createdAt)));
    assert((await zip.file("word/document.xml").async("string")).includes("준비물: 물통과 모자"));
    await page.screenshot({ path: path.resolve(__dirname, "../.qa/notice-workflow.png"), fullPage: true });
    await page.locator("#noticePreferences").scrollIntoViewIfNeeded();
    assert(await page.locator("#notice-preferences-title").isVisible());
    await page.screenshot({ path: path.resolve(__dirname, "../.qa/notice-workflow-top.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.locator("#notice-preferences-title").isVisible());
    await page.getByLabel("최종 알림장 미리보기").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.resolve(__dirname, "../.qa/notice-workflow-mobile.png") });
    assert.deepEqual(pageErrors, []);
    console.log("PASS: browser observation reuse, template multi-select/edit/save/deselect, date recommendations/fallback, generation, sentence order, preview/save/Word consistency");
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); if (log.includes("Error")) console.error(log.slice(-3000)); process.exitCode = 1; }).finally(() => server.kill());
