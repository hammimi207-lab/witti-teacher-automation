const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
function load(file, mocks = {}) { const module = {exports:{}}; const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText; new Function('require','module','exports',code)(id => mocks[id] || require(id),module,module.exports); return module.exports; }
const lib = load(path.join(__dirname,'../src/features/steam/references.ts'));
const work = {DOI:'10.1234/fixture',title:['<b>Children block play</b>'],type:'journal-article',author:[{given:'Test',family:'Author'}],published:{'date-parts':[[2020]]},abstract:'<p>Preschool children built blocks.</p>'};
test('references use registered metadata, reject malformed/irrelevant/duplicate/correction works', () => {
  const results = lib.readReferences([work,work,{...work,DOI:'javascript:unsafe'},{...work,DOI:'10.1234/unrelated',title:['Adult water management'],abstract:''},{...work,DOI:'10.1234/correction',title:['Correction: Children block play']}], 'block play early childhood');
  assert.equal(results.length,1); assert.equal(results[0].url,'https://doi.org/10.1234/fixture'); assert.equal(results[0].year,2020); assert.equal(results[0].authors,'Test Author'); assert.doesNotMatch(results[0].title,/<b>/);
  assert.deepEqual(results[0].matched,['block']); assert.match(lib.playSearchQuery('기찻길 블록을 길게 연결했다.'),/block/);
  const sparse = lib.readReferences([{DOI:'10.1234/sparse',title:['Infant block play'],type:'book-chapter'}], 'block play'); assert.equal(sparse[0].year,null); assert.equal(sparse[0].abstract,'');
});
test('reference API gates auth/origin and sends only query to fixed academic API', async () => {
  let signedIn=true, calls=0, unavailable=false;
  const route = load(path.join(__dirname,'../src/app/api/steam/references/route.ts'),{'@/features/steam/references':lib,'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:'owner'}:null}})}})}});
  const previous=global.fetch; global.fetch=async url=>{calls++; assert.equal(url.hostname,'api.crossref.org'); assert.equal(url.searchParams.get('query.bibliographic'),'block play early childhood'); return unavailable? new Response('',{status:503}):Response.json({message:{items:[work]}});};
  const post=(origin='https://app.test')=>route.POST(new Request('https://app.test/api/steam/references',{method:'POST',headers:{origin},body:JSON.stringify({query:'block play early childhood',observation:'private child observation'})}));
  try { assert.equal((await post('https://other.test')).status,403);signedIn=false;assert.equal((await post()).status,401);signedIn=true;assert.equal(calls,0);const response=await post();assert.equal(response.status,200);assert.equal((await response.json()).references.length,1);unavailable=true;assert.equal((await post()).status,503); } finally {global.fetch=previous;}
});
