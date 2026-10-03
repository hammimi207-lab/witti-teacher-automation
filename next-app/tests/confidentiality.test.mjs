import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(path,mocks){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>name in mocks?mocks[name]:require(name),m,m.exports);return m.exports;}
const terms=load('../src/lib/confidentiality-terms.ts',{});
test('photo management remains reachable after trial consent expiry, while AI creation stays gated',async()=>{
 let consentChecks=0;
 const proxy=load('../src/proxy.ts',{'next/server':{NextResponse:{next:()=>({cookies:{getAll:()=>[]}}),json:(_body,init)=>({status:init.status})}},'@/lib/supabase/proxy':{updateSession:async()=>({status:200})},'@/lib/consent-access':{restoreConsent:async()=>{consentChecks++;return false;}}});
 for(const path of ['/mypage','/api/photos','/api/photos/123']) assert.equal((await proxy.proxy({nextUrl:{pathname:path},url:`https://example.com${path}`})).status,200);
 assert.equal(consentChecks,0);
 assert.equal((await proxy.proxy({nextUrl:{pathname:'/api/records/generate'},url:'https://example.com/api/records/generate'})).status,403);
 assert.equal(consentChecks,1);
});
test('signed receipts reject forgery, missing records, stale versions and expiry',async()=>{
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-secret-only'; let row=null;
 const lib=load('../src/lib/confidentiality.ts',{'server-only':{},'./confidentiality-terms':terms,'@/lib/supabase/admin':{createAdminClient:()=>({storage:{from:()=>({download:async()=>({data:row?new Blob([JSON.stringify(row)]):null,error:null})})}})}});
 const id='11111111-1111-4111-8111-111111111111';const token=lib.consentToken(id);
 assert.equal(lib.consentId(token),id);assert.equal(lib.consentId(token+'x'),null);assert.equal(await lib.validConsent(token),false);
 row={id,version:terms.CONSENT_VERSION,ndaAccepted:true,privacyAccepted:true,expiresAt:new Date(Date.now()+60000).toISOString()};assert.equal(await lib.validConsent(token),true);
 row.version='old';assert.equal(await lib.validConsent(token),false);row.version=terms.CONSENT_VERSION;row.expiresAt='2020-01-01';assert.equal(await lib.validConsent(token),false);
});
test('consent requires explicit checks, matching origin, and successful durable storage before cookie',async()=>{
 let fail=false;let stored;let issued=0;
 const api=load('../src/app/api/consent/route.ts',{'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:new Headers(),cookies:{set:()=>issued++}})}},'@/lib/confidentiality':{CONSENT_BUCKET:'test',CONSENT_COOKIE:'test',consentToken:()=> 'signed'},'@/lib/confidentiality-terms':terms,'@/lib/supabase/admin':{createAdminClient:()=>({storage:{from:()=>({upload:async(path,value)=>{stored=JSON.parse(value);return {error:fail?{}:null};}})}})}});
 const input={name:'테스트',email:'test@example.com',phone:'010-1234-5678',version:terms.CONSENT_VERSION,ndaAccepted:true,privacyAccepted:true};
 const post=(body,origin='https://example.com')=>api.POST(new Request('https://example.com/api/consent',{method:'POST',headers:{origin},body:JSON.stringify(body)}));
 assert.equal((await post(input,'https://evil.example')).status,403);assert.equal((await post({...input,ndaAccepted:false})).status,400);assert.equal(issued,0);
 for (const phone of [undefined, '', '02-123-4567', '010abcdefgh', '0101234']) assert.equal((await post({...input,phone})).status,400);
 assert.equal(issued,0);
 fail=true;assert.equal((await post(input)).status,503);assert.equal(issued,0);
 fail=false;assert.equal((await post(input)).status,200);assert.equal(issued,1);assert.equal(stored.phone,"01012345678");assert.equal(stored.institution,undefined);assert.equal(stored.privacy,terms.PRIVACY_TEXT);assert.equal(stored.nda,terms.NDA_TEXT);assert.equal(stored.identityVerified,false);assert.equal(new Date(stored.expiresAt).getUTCFullYear(),new Date(stored.acceptedAt).getUTCFullYear()+1);
});
test('account recovery requires authenticated identity, matching receipt, and current consent',async()=>{
 let user=null,valid=true,row={email:'teacher@example.com',expiresAt:'2099-01-01'},updates=0;
 const lib=load('../src/lib/consent-access.ts',{'@/lib/supabase/session-policy':load('../src/lib/supabase/session-policy.ts',{}),'server-only':{},'@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user},error:null})}})},'@/lib/supabase/config':{getSupabaseConfig:()=>({url:'x',key:'y'})},'@/lib/supabase/admin':{createAdminClient:()=>({auth:{admin:{updateUserById:async()=>{updates++;return {error:null}}}}})},'./confidentiality':{CONSENT_COOKIE:'c',consentId:()=> '11111111-1111-4111-8111-111111111111',consentToken:id=>'signed-'+id,validConsent:async token=>Boolean(token)&&valid,readConsent:async()=>row}});
 const req=(token='')=>({cookies:{get:()=>({value:token}),getAll:()=>[],set:()=>{}}});const res=()=>({cookies:{set:()=>{}}});
 assert.equal(await lib.restoreConsent(req(),res()),false);
 assert.equal(await lib.restoreConsent(req('cookie'),res()),true);
 user={id:'user',email:'teacher@example.com',app_metadata:{}};
 assert.equal(await lib.restoreConsent(req(),res()),false);
 assert.equal(await lib.restoreConsent(req('cookie'),res()),true);assert.equal(updates,1);
 user.app_metadata.girok_consent_id='11111111-1111-4111-8111-111111111111';
 assert.equal(await lib.restoreConsent(req(),res()),true);
 user.email='other@example.com';assert.equal(await lib.restoreConsent(req('cookie'),res()),false);
 user.email='teacher@example.com';valid=false;assert.equal(await lib.restoreConsent(req(),res()),false);
});
