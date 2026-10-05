/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-component browser regression. */
const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const ts = require("typescript"), { webpack } = require("next/dist/compiled/webpack/webpack"), { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."), work = fs.mkdtempSync(path.join(os.tmpdir(), "girok-media-browser-"));
test("mobile recording/video review transfers once into existing observation", { timeout: 90000 }, async () => {
  const home = path.join(work, "home"), records = path.join(work, "records"); fs.mkdirSync(home); fs.mkdirSync(records);
  for (const name of ["observation-recorder.tsx", "observation-play-choice.tsx", "capture-dialog.tsx", "video-observation.tsx", "prepare-observation-video.ts", "observation-handoff.ts"])
    fs.writeFileSync(path.join(home, name.replace(/\.tsx?$/, ".js")), compile(fs.readFileSync(path.join(root, "src/features/home", name), "utf8")));
  fs.writeFileSync(path.join(records, "observation-import.js"), compile(fs.readFileSync(path.join(root, "src/features/records/observation-import.tsx"), "utf8")));
  fs.writeFileSync(path.join(work, "entry.js"), `const React=require('react'),{createRoot}=require('react-dom/client');const {ObservationRecorder}=require('./home/observation-recorder'),{ObservationImport}=require('./records/observation-import'),{appendObservation}=require('./home/observation-handoff');function App(){const ref=React.useRef(null),[text,setText]=React.useState('기존 교사 관찰');return location.pathname==='/records/new'?React.createElement(React.Fragment,null,React.createElement(ObservationImport,{userId:'test-user',token:new URL(location.href).searchParams.get('observation'),disabled:false,onApply:value=>setText(old=>appendObservation(old,value))}),React.createElement('textarea',{'aria-label':'교사 관찰 입력',value:text,readOnly:true})):React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>ref.current.open()},'관찰 열기'),React.createElement(ObservationRecorder,{ref,userId:'test-user',onActivity:()=>{}}));}createRoot(document.getElementById('root')).render(React.createElement(App));`);
  await new Promise((resolve,reject)=>webpack({mode:"development",devtool:false,entry:path.join(work,"entry.js"),output:{path:work,filename:"bundle.js"},resolve:{modules:[path.join(root,"node_modules")]}},(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
  const server=http.createServer((req,res)=>{ if(req.url==="/bundle.js"){res.setHeader("Content-Type","text/javascript");res.end(fs.readFileSync(path.join(work,"bundle.js")));}else{res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px}dialog{max-width:90vw}textarea,input{max-width:100%}textarea{display:block;width:95%}</style><div id="root"></div><script src="/bundle.js"></script>');}});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;
  try {
    browser=await chromium.launch({channel:"msedge",headless:true});const page=await browser.newPage({viewport:{width:390,height:844}}), errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.route("**/api/observations/recordings",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({recordings:[{fragment_id:"saved-voice",recorded_at:new Date().toISOString(),record_audio:{duration_ms:1000,transcription_status:"done"},record_transcriptions:[{raw_transcription:"블록을 반복해서 쌓았습니다.",teacher_edited_transcription:null,created_at:new Date().toISOString()}]}]})}));
    await page.route("**/api/observations/plays",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({plays:[],links:[]})}));
    let videoCalls=0;
    await page.route("**/api/observations/video",route=>{videoCalls++;const body=route.request().postDataBuffer().toString("latin1");assert.match(body,/name="frames"/);assert.match(body,/name="timestamps"/);route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({userId:"test-user",transcript:"블록을 쌓자",transcriptNote:"",data:{classification:"놀이",reason:"스스로 반복",observations:"0초 블록 쌓기",stages:[{stage:"탐색과 반복",second:1,evidence:"다시 쌓음"}],missingStages:"확장 관찰 부족",teacherDraft:"영상에서 블록을 다시 쌓는 모습이 보였습니다."}})});});
    const url=`http://127.0.0.1:${server.address().port}`;
    await page.goto(url);await page.getByRole("button",{name:"관찰 열기"}).click();
    await page.getByLabel("교사 수정 전사문").fill("교사가 확인한 녹음 관찰입니다.");
    await page.getByRole("button",{name:"이 관찰로 새 기록 만들기",exact:true}).click();
    await page.getByRole("button",{name:"현재 기록의 관찰 입력에 추가"}).click();
    assert.equal(await page.getByLabel("교사 관찰 입력").inputValue(),"기존 교사 관찰\n\n교사가 확인한 녹음 관찰입니다.");
    assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('girok-observation-handoff:')).length),0);
    if(process.env.TEST_VIDEO_PATH){
      await page.goto(url);await page.getByRole("button",{name:"관찰 열기"}).click();
      await page.getByLabel("촬영한 영상 선택",{exact:true}).setInputFiles(process.env.TEST_VIDEO_PATH);
      await page.getByRole("checkbox",{name:/영상·음성·추출 장면/}).check();
      await page.getByRole("button",{name:"영상 전사·상황 분석",exact:true}).click();
      await page.getByRole("heading",{name:"장면 분석: 놀이"}).waitFor();assert.equal(videoCalls,1);
      const screenshot=path.join(root,"../outputs/next-observation-video-mobile.png");await page.screenshot({path:screenshot,fullPage:true});
      await page.getByRole("button",{name:"이 관찰로 새 기록 만들기",exact:true}).last().click();
      await page.getByRole("button",{name:"현재 기록의 관찰 입력에 추가"}).click();
      assert.match(await page.getByLabel("교사 관찰 입력").inputValue(),/기존 교사 관찰/);
      assert.match(await page.getByLabel("교사 관찰 입력").inputValue(),/영상에서 블록/);
    }
    assert.deepEqual(errors,[]);
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
function compile(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;}
