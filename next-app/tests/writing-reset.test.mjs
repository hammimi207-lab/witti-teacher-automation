import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function loader(mocks) {
  function load(name) {
    if (name.endsWith(".css")) return { default: {} };
    const file = [".ts", ".tsx"].map(ext => new URL(`../src/features/records/${name}${ext}`, import.meta.url)).find(fs.existsSync);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const target = { exports: {} };
    new Function("require", "module", "exports", code)(id => mocks[id] || (id.startsWith("../") ? load(id) : id.startsWith("./") ? load(id.slice(2)) : require(id)), target, target.exports);
    return target.exports;
  }
  return load;
}
test("whole-form reset clears inputs, photos, consent, generated result, and local draft", () => {
  const values = [];
  let cleared = false;
  const react = { ...require("react"), useEffect: () => {}, useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }), useState: value => { value = typeof value === "function" ? value() : value; const index = values.length; values.push(value); return [value, next => { values[index] = typeof next === "function" ? next(values[index]) : next; }]; } };
  const load = loader({ react, "./record-assembly": { RecordAssembly: () => null }, "./use-writing-draft": { useWritingDraft: () => ({ ready: true, clear() { cleared = true; } }) } });
  const tree = load("record-wizard").RecordWizard({ userId: "owner" });
  const { emptyWritingForm } = load("writing-workflow");
  const inputIndex = values.findIndex(value => value === emptyWritingForm || value?.ageGroup === "");
  values[inputIndex] = Object.fromEntries(Object.entries(emptyWritingForm).map(([key, value]) => [key, typeof value === "string" ? "previous child" : Array.isArray(value) ? ["previous"] : { previous: "text" }]));
  function find(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "button" && node.props.children === "전체 초기화 · 새 기록 작성") return node;
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child); if (result) return result; }
  }
  const oldWindow = globalThis.window;
  globalThis.window = { setTimeout() {} };
  try { find(tree).props.onClick(); } finally { globalThis.window = oldWindow; }
  assert.deepEqual(values[inputIndex], emptyWritingForm);
  assert(cleared);
  // The state slots following input are files, AI consent, photo consent, message and result.
  assert.deepEqual(values.slice(inputIndex + 1, inputIndex + 6), [[], false, false, "", null]);
});
test("clearing a draft invalidates pending writes and cleanup from the previous record", () => {
  const effects = [];
  const callbacks = [];
  const storage = new Map();
  const old = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
  globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.window = { setTimeout: fn => { callbacks.push(fn); return 0; }, addEventListener() {}, removeEventListener() {} };
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  const react = { ...require("react"), useRef: value => ({ current: value }), useState: value => [value === false ? true : value, () => {}], useEffect: fn => effects.push(fn) };
  try {
    const load = loader({ react });
    const { emptyWritingForm } = load("writing-workflow");
    const draft = load("use-writing-draft").useWritingDraft("owner", { input: { ...emptyWritingForm, childAlias: "이전 아이", mealObservation: "이전 식사" }, result: null, generationId: "", selectedAnnouncements: [], snapshot: null });
    const cleanups = effects.map(fn => fn());
    callbacks[0]();
    assert.equal(storage.size, 1);
    draft.clear();
    callbacks[0]();
    cleanups.forEach(fn => fn?.());
    assert.equal(storage.size, 0, "old cleanup must not restore the cleared child");
  } finally { Object.assign(globalThis, old); }
});
