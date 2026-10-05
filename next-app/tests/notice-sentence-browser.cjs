// Bundles the production components into a local test fixture; no app route or
// external AI/database service is involved. Run: node tests/notice-sentence-browser.cjs
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const compiled = require('next/dist/compiled/webpack/webpack');
const qa = path.resolve('.qa/notice-order');
fs.mkdirSync(qa, { recursive: true });
fs.writeFileSync(path.join(qa, 'loader.cjs'), `module.exports = function(source) { return require('typescript').transpileModule(source, {compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText; };`);
fs.writeFileSync(path.join(qa, 'css-loader.cjs'), `module.exports = function(source) { const classes = Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][\\w-]*)/g)].map(match=>[match[1],match[1]])); return 'const style=document.createElement("style"); style.textContent='+JSON.stringify(source)+'; document.head.appendChild(style); module.exports='+JSON.stringify(classes)+';'; };`);
fs.writeFileSync(path.join(qa, 'entry.tsx'), `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/app/globals.css';
import { GeneratedRecordEditor } from '../../src/features/records/generated-record-editor';
import { SaveRecordControls } from '../../src/features/records/save-record-controls';
import { WordDownload } from '../../src/features/records/word-download';
function Fixture() {
 const [result,setResult] = useState({finalNotice:'첫 문장입니다. 같은 문장입니다. 같은 문장입니다. 마지막입니다.'});
 const [busy,setBusy] = useState(false);
 const input = {playName:'블록 놀이',recordType:'알림장',ageGroup:'3세',childAlias:'별님',curriculumAreas:['자연탐구'],observation:'아이가 블록 세 개를 쌓았다.'};
 const snapshot = {input,files:[],createdAt:'2026-10-03',consent:{aiAccepted:true,photoAccepted:false}};
 return <><GeneratedRecordEditor result={result} onChange={setResult} disabled={busy} isNotice />
 <SaveRecordControls generationId="6f7c88a9-107e-4f75-803c-9dcf9d532f66" result={result} snapshot={snapshot} onRecordDecision={()=>{}} languageTarget={null} dialogTarget={null} onBusyChange={setBusy} onPhotosSaved={()=>{}} />
 <output data-testid='final-text'>{result.finalNotice}</output><WordDownload title="블록 놀이" result={result} input={input} />
 </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
`);
// The entry is in .qa/notice-order, so sources are two levels up.
async function main() {
 await new Promise((resolve, reject) => compiled.webpack({mode:'development',entry:path.join(qa,'entry.tsx'),output:{path:qa,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js']},module:{rules:[{test:/\.tsx?$/,use:path.join(qa,'loader.cjs')},{test:/\.css$/,use:path.join(qa,'css-loader.cjs')}]},devtool:false}, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({all:false,errors:true}))) : resolve()));
 const server = http.createServer((request,response) => {
  if(request.url === '/bundle.js') { response.setHeader('content-type','text/javascript; charset=utf-8'); response.end(fs.readFileSync(path.join(qa,'bundle.js'))); }
  else { response.setHeader('content-type','text/html; charset=utf-8'); response.end('<html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
 });
 await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
 let browser;
 try {
  browser = await chromium.launch({headless:true,channel:process.env.NOTICE_TEST_BROWSER || 'msedge'});
  const context = await browser.newContext({viewport:{width:900,height:1000},hasTouch:true});
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  const finalValue = () => page.getByTestId('final-text').textContent();
  const cards = page.getByRole('button',{name:/번 문장 이동:/});
  await cards.first().waitFor({timeout:10000}).catch(async error=>{console.error(errors,await page.locator('body').innerText());throw error;});
  await page.evaluate(()=>{window.noticeAnimations=0;const animate=Element.prototype.animate;Element.prototype.animate=function(...args){window.noticeAnimations++;return animate.apply(this,args);};});
  const original = await finalValue();
  const last = await cards.nth(3).boundingBox(); const first = await cards.first().boundingBox();
  await page.mouse.move(last.x+20,last.y+last.height/2); await page.mouse.down();
  await page.mouse.move(first.x+20,first.y+2,{steps:15}); await page.mouse.up();
  assert.equal(await finalValue(),'마지막입니다. 첫 문장입니다. 같은 문장입니다. 같은 문장입니다.');
  assert.ok(await page.evaluate(()=>window.noticeAnimations)>0,'Cards must animate after reordering');
  await cards.first().focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await finalValue(),'첫 문장입니다. 마지막입니다. 같은 문장입니다. 같은 문장입니다.');
  // Real Chromium touch events (not mouse emulation).
  await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(animation=>animation.finished)));
  const cdp = await context.newCDPSession(page);
  const target=await cards.nth(1).boundingBox(); const end=await cards.nth(3).boundingBox();
  const point={x:Math.round(target.x+25),y:Math.round(target.y+target.height/2)};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:Math.round(end.y+end.height-2)}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await finalValue(),original);
  // Distinct duplicate cards retain their DOM nodes after keyboard reordering.
  await cards.nth(1).evaluate(node=>node.dataset.testIdentity='duplicate');
  await cards.nth(1).focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await cards.nth(2).getAttribute('data-test-identity'),'duplicate');
  // A cancelled touch restores the order before the gesture.
  await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(animation=>animation.finished)));
  const beforeCancel=await finalValue();
  const cancelFrom=await cards.nth(3).boundingBox(); const cancelTo=await cards.first().boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cancelFrom.x+20,y:cancelFrom.y+cancelFrom.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cancelTo.x+20,y:cancelTo.y+2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await finalValue(),beforeCancel);
  const sentenceInput=page.getByRole('textbox',{name:'1번 문장 수정',exact:true});
  await sentenceInput.fill('직접 수정한 문장입니다.');
  assert.ok((await finalValue()).startsWith('직접 수정한 문장입니다.'));
  assert.equal(await page.locator('#finalNoticeEditor').count(),1);
  assert.equal(await page.getByText('여기서 바로 수정하세요',{exact:true}).count(),1);
  await sentenceInput.evaluate(node=>{node.focus();node.setSelectionRange(3,3);});
  await page.getByRole('button',{name:'😊 넣기',exact:true}).click();
  assert.equal(await sentenceInput.inputValue(),'직접 😊수정한 문장입니다.');
  await sentenceInput.press('ArrowDown');
  assert.equal(await sentenceInput.inputValue(),'직접 😊수정한 문장입니다.');
  let attempts=0; let saved;
  await page.route('**/api/records/save',route=>{
   saved=route.request().postDataJSON(); attempts++;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({saved:attempts>1})});
  });
  await page.getByRole('button',{name:'종합 기록 저장',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button',{name:'종합 기록 저장',exact:true}).isEnabled(),true);
  assert.equal(await page.getByRole('button',{name:'종합 기록 저장 완료',exact:true}).count(),0);
  await page.getByRole('button',{name:'종합 기록 저장',exact:true}).click();
  await page.getByRole('button',{name:'종합 기록 저장 완료',exact:true}).waitFor();
  assert.equal(saved.result.finalNotice,await finalValue());
  await cards.first().focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByRole('button',{name:'종합 기록 저장',exact:true}).isEnabled(),true);
  let wordBody;
  await page.route('**/api/records/word',route=>{wordBody=route.request().postDataBuffer().toString('utf8');return route.fulfill({contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',body:'fixture'});});
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Word 문서 다운로드',exact:true}).click();
  await downloaded;
  assert.ok(wordBody.includes(await finalValue()),'Word request uses latest result order');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(animation=>animation.finished)));
  await page.screenshot({path:path.join(qa,'unified-editor-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  assert.deepEqual(errors,[]);
  await page.emulateMedia({reducedMotion:'reduce'});
  const animationCount=await page.evaluate(()=>window.noticeAnimations);
  await cards.first().focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(()=>window.noticeAnimations),animationCount);
  console.log('PASS: mouse, touch, keyboard, animations/reduced motion, cancellation, duplicate identity, save failure/retry, dirty save state, Word request, mobile width');
 } finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
