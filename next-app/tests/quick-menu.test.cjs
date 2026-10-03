/* eslint-disable @typescript-eslint/no-require-imports -- Offline auth preference tests. */
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
const root = path.resolve(__dirname, "../src");
function load(file, mocks = {}) {
  const target = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(id => mocks[id] || (id.startsWith("@/") ? load(path.join(root, id.slice(2) + ".ts"), mocks) : require(id)), target, target.exports);
  return target.exports;
}
test("member quick menu starts empty and repairs invalid or duplicated stored preferences", () => {
  const { readQuickMenu } = load(path.join(root, "features/home/quick-menu.ts"));
  assert.deepEqual(readQuickMenu(null), [null,null,null,null]);
  assert.deepEqual(readQuickMenu(["video","observation","audio","records"]), ["video","observation","audio","records"]);
  assert.deepEqual(readQuickMenu(["video","video","unknown",null]), ["video",null,null,null]);
});
test("quick menu writes only authenticated user preferences and rejects duplicates, malformed arrays and cross-origin writes", async () => {
  let signedIn = true, failure = false; const updates = [];
  const api = load(path.join(root, "app/api/account/quick-menu/route.ts"), {
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: "owner" } : null }, error: null }), updateUser: async value => { updates.push(value); return { error: failure ? {} : null }; } } }) },
  });
  function post(slots, origin = "https://app.test") { return api.PATCH(new Request("https://app.test/api/account/quick-menu", { method:"PATCH",headers:{origin,"content-type":"application/json"},body:JSON.stringify({slots}) })); }
  assert.equal((await post([null,null,null,null],"https://other.test")).status,403);
  signedIn = false; assert.equal((await post([null,null,null,null])).status,401); signedIn=true;
  for(const slots of [["video","video",null,null],["wrong",null,null,null],[null]]) assert.equal((await post(slots)).status,400);
  assert.equal(updates.length,0);
  const response=await post(["audio","video","new","records"]);assert.equal(response.status,200);assert.match(response.headers.get("cache-control"),/no-store/);
  assert.deepEqual(updates,[{data:{girok_quick_menu:["audio","video","new","records"]}}]);
  failure=true;assert.equal((await post([null,null,null,null])).status,503);
});
test("uploaded recording analysis requires membership and consent before forwarding to existing transcription", async () => {
  let signedIn = false; const calls = [];
  const api = load(path.join(root, "app/api/observations/audio-file/route.ts"), {
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id:"owner" } : null }, error:null }) } }) },
    "../transcribe/route": { POST: async request => { const form=await request.formData(); calls.push(form.get("audio")); return Response.json({text:"확인한 말"}); } },
  });
  function post(consent="accepted") {const form=new FormData();form.set("consent",consent);form.set("audio",new File(["test"],"test.wav",{type:"audio/wav"}));return api.POST(new Request("https://app.test/api/observations/audio-file",{method:"POST",headers:{origin:"https://app.test"},body:form}));}
  assert.equal((await post()).status,401);signedIn=true;assert.equal((await post("no")).status,403);assert.equal(calls.length,0);
  assert.equal((await post()).status,200);assert.equal(calls[0].name,"test.wav");
});
