/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser fixture for the production component. */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), assert = require("node:assert/strict");
const ts = require("typescript");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "record-assembly-"));
const output = path.resolve(root, "../outputs/record-assembly");
fs.mkdirSync(output, { recursive: true });
const css = fs.readFileSync(path.join(root, "src/features/records/record-assembly.module.css"), "utf8");
const source = fs.readFileSync(path.join(root, "src/features/records/record-assembly.tsx"), "utf8").replace('import styles from "./record-assembly.module.css";', `const styles = ${JSON.stringify(Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match => [match[1], match[1]])))};`);
fs.writeFileSync(path.join(work, "assembly.js"), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText);
fs.writeFileSync(path.join(work, "entry.js"), `
const React = require('react'); const {createRoot} = require('react-dom/client'); const {RecordAssembly} = require('./assembly');
const observation = '친구에게 블록을 건넸어요. 같은 모양을 여러 번 쌓았어요. 완성한 길에 자동차를 올렸어요.';
const sources = Array.from({length:6}, (_,i)=>({id:String(i),date:'2026-09-'+(14+i),childAlias:'아이 '+(i+1),observation:observation,playName:'블록 놀이'}));
const root = createRoot(document.getElementById('root')); const done = ()=>{window.finished=true;root.render(React.createElement('h2',null,'완성된 기록'));};
const file = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="180" height="90"><rect width="180" height="90" fill="#dbdfca"/><rect x="50" y="25" width="35" height="35" fill="#daab7d"/><rect x="90" y="35" width="35" height="35" fill="#819c8a"/></svg>'],'fixture.svg',{type:'image/svg+xml'});
window.show = (mode, ready=false, empty=false)=>{window.finished=false;root.render(React.createElement(RecordAssembly,{key:mode,mode,observation:empty?'한 가지 놀이를 여러 번 시도했어요.':observation,files:empty?[]:[file],sources:empty?sources.slice(0,1):sources,result:ready?{curriculumLinks:[{area:'사회관계'}],observationRefinementRows:[{teacherInput:'친구에게 블록을 건넸어요.'}]}:null,weeklyResult:ready?{plays:[{title:'함께 만든 길',sourceIds:['0','2','4']}]}:undefined,onComplete:done}));};
window.show('daily');
`);

(async () => {
  let browser, server;
  try {
    await new Promise((resolve, reject) => webpack({ mode: "development", devtool: false, entry: path.join(work, "entry.js"), output: { path: work, filename: "bundle.js" }, resolve: { modules: [path.join(root, "node_modules")] } }, (error, stats) => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
    server = http.createServer((req,res) => {
      res.setHeader("Content-Type", req.url === "/bundle.js" ? "text/javascript" : "text/html; charset=utf-8");
      res.end(req.url === "/bundle.js" ? fs.readFileSync(path.join(work,"bundle.js")) : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;font-family:Arial,sans-serif;background:#fafbf8}*{box-sizing:border-box}#root{max-width:900px;margin:auto}' + css + '</style><div id="root"></div><script src="/bundle.js"></script>');
    });
    await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
    browser = await chromium.launch({channel:"msedge",headless:true});
    const page = await browser.newPage({viewport:{width:1100,height:800}});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('.card').first().waitFor();
    assert.equal(await page.locator('.card').count(),4);
    assert.equal(await page.locator('.tags span').count(),0);
    await page.waitForTimeout(800);
    await page.screenshot({path:path.join(output,'daily-desktop.png')});
    await page.evaluate(()=>window.show('daily',true));
    await page.locator('[data-phase="meaning"]').waitFor();
    assert.equal(await page.locator('mark').innerText(),'친구에게 블록을 건넸어요.');
    await page.waitForFunction(()=>window.finished);
    await page.evaluate(()=>window.show('weekly'));
    await page.locator('.weekly').waitFor();
    assert.equal(await page.locator('line').count(),0);
    await page.evaluate(()=>window.show('weekly',true));
    await page.locator('[data-phase="meaning"]').waitFor();
    assert.equal(await page.locator('line').count(),2);
    await page.waitForTimeout(750);
    await page.screenshot({path:path.join(output,'weekly-desktop.png')});
    await page.waitForFunction(()=>window.finished);
    await page.setViewportSize({width:375,height:812});
    await page.evaluate(()=>window.show('weekly'));
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(output,'weekly-mobile.png')});
    await page.evaluate(()=>window.show('daily'));
    await page.waitForTimeout(800);
    await page.screenshot({path:path.join(output,'daily-mobile.png')});
    await page.evaluate(()=>window.show('weekly',false,true));
    await page.locator('.weekly').waitFor();
    assert.equal(await page.locator('.card').count(),1);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>window.show('weekly',true,true));
    await page.waitForFunction(()=>window.finished,{},{timeout:1000});
    assert.deepEqual(errors,[]);
    console.log('PASS: real cards, photo preview, evidence-only tags/links, completion, single source, mobile width, reduced motion, no browser errors. Screenshots: '+output);
  } finally { await browser?.close(); if(server) await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
