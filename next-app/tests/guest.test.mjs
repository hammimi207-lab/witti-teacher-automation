import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const root=path.resolve('src');
function load(file,mocks={}) {
 const filename=path.isAbsolute(file)?file:path.resolve(root,file);
 const source=fs.readFileSync(filename,'utf8');const m={exports:{}};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(name=>{
  if(name in mocks)return mocks[name];
  if(name.startsWith('@/')||name.startsWith('.'))return load((name.startsWith('@/')?path.resolve(root,name.slice(2)):path.resolve(path.dirname(filename),name))+'.ts',mocks);
  return require(name);
 },m,m.exports);return m.exports;
}
test('guest generation requires AI consent and returns unsaved output without database access',async()=>{
 let calls=0;
 const api=load('app/api/records/generate/route.ts',{
  openai:{default:class {responses={parse:async(options)=>{calls++;assert.equal(options.store,false);return {output_parsed:{integratedRecord:'test output'}};}};}},
  'openai/helpers/zod':{zodTextFormat:()=>({})},
 });
 const {AI_CONSENT_VERSION}=load('features/records/ai-consent.ts');
 const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';
 try{
  for(const accepted of [false,true]){
   const form=new FormData();form.set('input',JSON.stringify({playName:'블록 놀이',ageGroup:'3세',childAlias:'테스트',recordType:'일지',curriculumAreas:['자연탐구'],observation:'아이가 블록 세 개를 위로 쌓았다.',parentType:'일반형'}));
   form.set('consent',JSON.stringify({version:AI_CONSENT_VERSION,aiAccepted:accepted,photoAccepted:false}));
   const response=await api.POST(new Request('https://test.local/api/records/generate',{method:'POST',body:form}));
   assert.equal(response.status,accepted?200:403);
   if(accepted)assert.equal((await response.json()).saved,false);
  }
  assert.equal(calls,1);
 }finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});
test('guest cannot save records even when calling the save API directly',async()=>{
 const api=load('app/api/records/save/route.ts',{
  '@/lib/supabase/config':{hasSupabaseConfig:()=>true},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:null},error:null})},from:()=>{throw Error('must not access data');}})},
 });
 const response=await api.POST(new Request('https://test.local/api/records/save',{method:'POST',body:'{}'}));assert.equal(response.status,401);
});
test('guest draft does not read, write or delete browser storage',()=>{
 const states=[];let cursor=0;let effects=[];
 const hook=load('features/records/use-writing-draft.ts',{
  react:{useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=v];},useRef:()=>({current:0}),useEffect:fn=>effects.push(fn)},
  './writing-draft':{draftKey:id=>'draft:'+id,readDraft:()=>{throw Error('must not read');},hasDraftContent:()=>true},
 });
 globalThis.localStorage=new Proxy({},{get(){throw Error('guest storage access');}});
 try{for(let render=0;render<2;render++){cursor=0;effects=[];const draft=hook.useWritingDraft('',{input:{},result:null});for(const effect of effects)effect();draft.clear();}assert.equal(states[1],true);assert.match(states[2],/비회원/);}finally{delete globalThis.localStorage;}
});
