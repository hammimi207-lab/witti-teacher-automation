import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);

function load(relative) {
  const filename = new URL(`../src/features/records/${relative}`, import.meta.url);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", code)(id => id.startsWith("./") ? load(id.slice(2) + ".ts") : require(id), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { buildRecordPrompt } = load("prompt.ts");
const { RECORD_TYPES } = load("constants.ts");
const { recordInputSchema } = load("schema.ts");
const input = recordInputSchema.parse({ playName: "블록 놀이", ageGroup: "3세", childAlias: "테스트반", recordType: "놀이 이야기", curriculumAreas: ["자연탐구"], observation: "블록 두 개를 나란히 놓고 그 위에 긴 블록을 올렸다.", playSubcategories: ["탐색"], playSubcategoryNotes: { 탐색: "블록을 돌려서 다시 올렸다." }, teacherSupports: ["자료"], teacherSupportNotes: { 자료: "긴 블록을 추가로 제공했다." } });

test("일지는 작성 선택지에서만 숨기고 기존 데이터 스키마는 유지", () => {
  assert.deepEqual(RECORD_TYPES, ["놀이 이야기", "알림장"]);
  assert.equal(recordInputSchema.parse({ ...input, recordType: "일지" }).recordType, "일지");
});
test("놀이명 추천은 기존 이름, 사진, 세부 관찰과 지원을 모두 참고", () => {
  const prompt = buildRecordPrompt(input);
  for (const text of [input.playName, input.observation, "블록을 돌려서 다시 올렸다.", "긴 블록을 추가로 제공했다.", "첨부된 모든 사진", "playNameRecommendations", "photoEvidence", "observationEvidence", "playNameLearningTip"]) assert.ok(prompt.includes(text), text);
});
test("사진 부재·불확실성과 기존 이름 보존 지침 포함", () => {
  const prompt = buildRecordPrompt(input);
  for (const text of ["사진 미첨부", "차이와 한계를 명시", "기존 놀이명은 임의로 바꾸지", "교사를 평가하거나"]) assert.ok(prompt.includes(text), text);
});
test("알림장 생성 지침에는 놀이명 추천을 추가하지 않음", () => {
  const prompt = buildRecordPrompt({ ...input, recordType: "알림장" });
  assert.ok(prompt.includes("finalNotice"));
  assert.ok(!prompt.includes("[교사의 배움을 위한 놀이명 추천]"));
});
