/* eslint-disable @typescript-eslint/no-require-imports -- Browser harness for the real recorder component. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const ts = require("typescript");
const { chromium } = require("playwright");
const { webpack } = require("next/dist/compiled/webpack/webpack");

const root = path.resolve(__dirname, "..");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "girok-play-browser-"));
const clipId = "22222222-2222-4222-8222-222222222222";
const initialPlayId = "44444444-4444-4444-8444-444444444444";
const newPlayId = "55555555-5555-4555-8555-555555555555";

test("teacher links before recording and can revise AI play suggestion after transcription", { timeout: 60000 }, async () => {
  for (const file of ["observation-recorder.tsx", "observation-play-choice.tsx", "capture-dialog.tsx", "video-observation.tsx", "prepare-observation-video.ts", "observation-handoff.ts"]) {
    const source = fs.readFileSync(path.join(root, "src/features/home", file), "utf8");
    fs.writeFileSync(path.join(work, file.replace(/\.tsx?$/, ".js")), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText);
  }
  fs.writeFileSync(path.join(work, "entry.js"), `const React=require('react');const {createRoot}=require('react-dom/client');const {ObservationRecorder}=require('./observation-recorder');function App(){const ref=React.useRef(null);return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>ref.current.open()},'관찰 녹음 열기'),React.createElement(ObservationRecorder,{ref,onActivity:()=>{}}));}createRoot(document.getElementById('root')).render(React.createElement(App));`);
  await new Promise((resolve, reject) => webpack({ mode: "development", devtool: false, entry: path.join(work, "entry.js"), output: { path: work, filename: "bundle.js" }, resolve: { modules: [path.join(root, "node_modules")] } }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const server = http.createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/bundle.js" ? "text/javascript" : "text/html; charset=utf-8");
    response.end(request.url === "/bundle.js" ? fs.readFileSync(path.join(work, "bundle.js")) : '<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  try {
    const context = await browser.newContext({ permissions: ["microphone"] });
    const page = await context.newPage();
    const plays = []; const links = []; const recordings = [];
    let suggestionCalls = 0;
    await page.route("**/api/observations/**", async route => {
      const request = route.request(), url = new URL(request.url());
      const respond = body => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname === "/api/observations/recordings" && request.method() === "GET") return respond({ recordings });
      if (url.pathname === "/api/observations/recordings" && request.method() === "POST") { recordings.unshift({ fragment_id: clipId, recorded_at: new Date().toISOString(), play_topic: null, record_audio: { duration_ms: 1100, transcription_status: "not_requested" }, record_transcriptions: [] }); return respond({ id: clipId }); }
      if (url.pathname === `/api/observations/recordings/${clipId}` && request.method() === "POST") { recordings[0].record_audio.transcription_status = "done"; recordings[0].record_transcriptions = [{ raw_transcription: "블록으로 길을 만들었어요", teacher_edited_transcription: null, created_at: new Date().toISOString() }]; return respond({ rawTranscription: "블록으로 길을 만들었어요" }); }
      if (url.pathname === "/api/observations/plays" && request.method() === "GET") return respond({ plays, links });
      if (url.pathname === "/api/observations/plays" && request.method() === "POST") {
        const body = request.postDataJSON();
        if (body.action === "create") { const play = { cluster_id: plays.length ? newPlayId : initialPlayId, title: body.title }; plays.push(play); return respond({ play }); }
        links.splice(0); if (body.action === "link") links.push({ fragment_id: body.fragmentId, cluster_id: body.clusterId });
        return respond({ saved: true });
      }
      if (url.pathname === "/api/observations/play-suggestions") { suggestionCalls++; return respond({ suggestions: [{ title: "길 만들기 놀이", reason: "길을 만들었다는 전사 내용" }] }); }
      return route.fulfill({ status: 404, body: "missing fixture" });
    });
    await page.goto(origin);
    await page.getByRole("button", { name: "관찰 녹음 열기" }).click();
    await page.getByRole("group", { name: "다음 녹음의 놀이" }).getByRole("radio", { name: "아직 정하지 않기" }).waitFor();
    await page.getByRole("button", { name: "새 놀이 만들기" }).click();
    await page.getByRole("group", { name: "다음 녹음의 놀이" }).getByLabel("새 놀이명").fill("블록 놀이");
    await page.getByRole("button", { name: "추가하고 선택" }).click();
    await page.getByRole("group", { name: "다음 녹음의 놀이" }).getByRole("radio", { name: "블록 놀이" }).waitFor();
    await page.getByRole("button", { name: "녹음 시작" }).click();
    await page.getByRole("button", { name: "종료", exact: true }).waitFor();
    await page.waitForTimeout(1100);
    await page.getByRole("button", { name: "종료", exact: true }).click();
    await page.getByRole("button", { name: "전사하기" }).click();
    const group = page.getByRole("group", { name: "이 녹음을 어떤 놀이와 연결할까요?" });
    await group.getByRole("radio", { name: "블록 놀이" }).waitFor();
    assert.equal(await group.getByRole("radio", { name: "블록 놀이" }).isChecked(), true);
    await group.getByRole("radio", { name: "아직 연결하지 않기" }).check();
    await group.getByRole("button", { name: "AI 놀이 후보 보기" }).click();
    await group.getByText("길 만들기 놀이").waitFor();
    assert.equal(suggestionCalls, 1);
    assert.equal(links.length, 0);
    await group.getByRole("button", { name: "이 놀이 선택" }).click();
    await group.getByRole("radio", { name: "길 만들기 놀이" }).waitFor();
    assert.equal(await group.getByRole("radio", { name: "길 만들기 놀이" }).isChecked(), true);
    assert.equal(links[0].cluster_id, newPlayId);
    await context.close();
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(work, { recursive: true, force: true }); }
});
