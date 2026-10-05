import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);

test("fairy memo minimizes and reopens without disabling input or discarding its contents", () => {
  let collapsed = false;
  const react = { ...require("react"), useId: () => "memo-test", useRef: () => ({ current: null }), useState: () => [collapsed, value => { collapsed = value; }] };
  const code = ts.transpileModule(fs.readFileSync(new URL("../src/features/records/fairy-comment.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const target = { exports: {} };
  new Function("require", "module", "exports", code)(id => {
    if (id === "react") return react;
    if (id === "./fairy-image") return { FairyImage: () => null };
    return require(id);
  }, target, target.exports);
  const input = react.createElement("textarea", { defaultValue: "교사의 원문" });
  const comment = react.createElement("p", null, "관찰 코멘트");
  const render = available => target.exports.FairyComment({ available, children: input, comment });
  function find(node, predicate) {
    if (!node || typeof node !== "object") return;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
  }
  const old = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = fn => fn();
  try {
    let tree = render(true);
    assert.equal(find(tree, n => n.type === "aside").props.hidden, false);
    find(tree, n => n.props?.["aria-label"] === "코멘트 메모 숨기기").props.onClick();
    tree = render(true);
    assert.equal(find(tree, n => n.type === "aside").props.hidden, true);
    assert.equal(find(tree, n => n.type === "textarea"), input);
    assert.equal(find(tree, n => n.type === "p"), comment);
    assert.equal(input.props.disabled, undefined);
    const reopen = find(tree, n => n.props?.["aria-controls"] === "memo-test");
    assert.equal(reopen.props["aria-expanded"], false);
    reopen.props.onClick();
    assert.equal(find(render(true), n => n.type === "aside").props.hidden, false);
    assert.equal(find(render(false), n => n.props?.["aria-controls"] === "memo-test"), undefined);
    assert.equal(find(render(false), n => n.type === "aside").props.hidden, true);
  } finally { globalThis.requestAnimationFrame = old; }
});
