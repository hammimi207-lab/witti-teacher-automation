/* eslint-disable @typescript-eslint/no-require-imports -- Unit-test loader for a pure TypeScript module. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const loaded = { exports: {} };
new Function("module", "exports", ts.transpileModule(fs.readFileSync(require.resolve("../src/features/home/photo-analysis.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(loaded, loaded.exports);
const { signatureFromPixels, visualDistance, closestVisualGroup, sameVisualScene } = loaded.exports;
function scene(background, foreground, shift = 0, brightness = 0) {
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const color = x >= 4 + shift && x < 11 + shift && y > 4 && y < 12 ? foreground : background;
    const i = (y * 16 + x) * 4;
    pixels.set([...color.map(n => n + brightness), 255], i);
  }
  return signatureFromPixels(pixels, 16, 16);
}
test("same scene and small lighting/composition changes cluster; distinct scenes remain separate", () => {
  const original = scene([210, 165, 70], [190, 40, 30]);
  const near = scene([210, 165, 70], [190, 40, 30], 1, 4);
  const different = scene([25, 80, 190], [20, 170, 70]);
  assert.equal(visualDistance(original, original), 0);
  assert.ok(visualDistance(original, near) < .16);
  assert.ok(visualDistance(original, different) > .16);
  assert.equal(closestVisualGroup(near, new Map([["blocks", original], ["outdoor", different]])), "blocks");
  assert.equal(closestVisualGroup(different, new Map([["blocks", original]])), undefined);
});
test("layout affects matching even when color histograms are the same", () => {
  const left = scene([200, 80, 30], [30, 50, 200], -3);
  const right = scene([200, 80, 30], [30, 50, 200], 3);
  assert.deepEqual(left.histogram, right.histogram);
  assert.ok(visualDistance(left, right) > 0);
  assert.ok(Number.isFinite(visualDistance(left, right)));
  assert.equal(sameVisualScene(left, right), false);
});

test("known different capture dates cannot form a similar-scene group", () => {
  const original = scene([210, 165, 70], [190, 40, 30]);
  assert.equal(sameVisualScene({ ...original, captureDay: "20260914" }, { ...original, captureDay: "20260918" }), false);
});

test("all group members must match, not just a bridging representative", () => {
  const a = scene([210, 165, 70], [190, 40, 30], -2);
  const b = scene([210, 165, 70], [190, 40, 30], 0);
  const c = scene([210, 165, 70], [190, 40, 30], 2);
  assert.equal(sameVisualScene(a, b), true);
  assert.equal(sameVisualScene(b, c), true);
  assert.equal(closestVisualGroup(c, new Map([["group", [b, a]]])), undefined);
});
