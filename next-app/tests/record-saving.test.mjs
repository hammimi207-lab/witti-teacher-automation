import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(name) {
  const source = fs.readFileSync(new URL(`../src/features/records/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const target = { exports: {} };
  new Function("require", "module", "exports", code)((id) => id.startsWith("./") ? load(id.slice(2)) : require(id), target, target.exports);
  return target.exports;
}
const { saveRequestSchema, mergeSavedRecord } = load("save-contract");
test("수정 비교는 변경 어절만 표시하고 같은 종류의 추가 근거도 감지", () => {
  const { revisionDiff } = load("revision-diff");
  const { revisionFeedback } = load("revision-feedback");
  const before = "바나나를 만졌음.";
  const after = "바나나를 만졌음. 2분 응시했음.";
  const parts = revisionDiff(before, after);
  assert.equal(parts.map(part => part.text).join(""), after);
  assert.ok(parts.some(part => !part.added && part.text === "바나나를"));
  assert.ok(parts.some(part => part.added && part.text === "응시했음."));
  assert.ok(revisionFeedback(before, after, "관찰").some(item => item.evidence === "응시"));
});
test("해석 안내는 관찰 근거를 묻고 구체적인 관찰에는 추가 질문을 하지 않음", () => {
  const { reflectionHints } = load("reflection-hints");
  assert.deepEqual(reflectionHints("바나나를 1~2분 응시하고 미소지었음.", "관찰"), []);
  assert.match(reflectionHints("재료에 관심을 보이는 과정으로 이해함", "해석")[0].question, /아이의 말이나 행동/);
});
test("지원 계획은 관찰과 분리해 구체적인 계획에 피드백", () => {
  const { supportPlanFeedback } = load("support-plan-feedback");
  assert.equal(supportPlanFeedback("노란색 큰 폼폼이, 노란색 공을 준비해서 바나나처럼 노란색깔로 놀이하도록 지원하겠음.").positive, true);
  assert.equal(supportPlanFeedback("잘 지원하겠음").positive, false);
  assert.equal(supportPlanFeedback("자료를 준비하겠음").positive, false);
  assert.equal(supportPlanFeedback(" "), null);
  assert.ok(!supportPlanFeedback("잘 지원하겠음").text.includes("관찰"));
});
test("수정 피드백은 새 관찰 근거를 짚고 단순 길이 증가와 원복을 칭찬하지 않음", () => {
  const { revisionFeedback } = load("revision-feedback");
  const original = "아이는 집중해서 탐색하였음.";
  const improved = original + " 바나나를 1~2분 응시하고 미소지었음.";
  assert.equal(revisionFeedback(original, improved, "관찰").length, 3);
  assert.deepEqual(revisionFeedback(original, original + " 매우 정말 집중했음.", "관찰"), []);
  assert.deepEqual(revisionFeedback(original, original + "\n", "관찰"), []);
  assert.deepEqual(revisionFeedback(original, original, "관찰"), []);
  assert.deepEqual(revisionFeedback("", improved, "관찰"), []);
});
test("돌아보기 질문은 엔터와 관계없이 표시하며 빈 입력은 제외", () => {
  const { reflectionHints, normalizeObservation } = load("reflection-hints");
  for (const context of ["표현과 구성", "관계와 상호작용", "자료 지원", "해석", "계획"]) {
    const plain = reflectionHints("바나나가 노랗다고 말함.", context);
    if (context === "표현과 구성") assert.deepEqual(plain, []);
    if (context === "해석") assert.ok(plain.length > 0);
    assert.deepEqual(reflectionHints("바나나가\n노랗다고 말함.\n", context), plain);
    assert.deepEqual(reflectionHints(" \n\r\n", context), []);
  }
  assert.equal(normalizeObservation("말함.\r\n"), "말함.");
});
test("항목별 점검은 짧은 발화를 인정하고 자료 선택 근거를 구분", () => {
  const { checkObservation } = load("observation-check");
  assert.deepEqual(checkObservation("바나나가 노랗다고 말함", "표현과 구성"), []);
  assert.equal(checkObservation("바나나 송이 제공함", "자료 지원")[0].topic, "자료 선택의 근거");
  assert.equal(checkObservation("바나나 송이 제공함", "시간 지원")[0].topic, "시간 조정");
  assert.deepEqual(checkObservation("", "자료 지원"), []);
});
const request = saveRequestSchema.parse({ generationId: "f7fd8d75-cd6d-4a9f-9011-35e8eed63541", kind: "record", createdAt: "2026-09-04", input: { playName: "블록 놀이", ageGroup: "2세", childAlias: "테스트", recordType: "놀이 이야기", curriculumAreas: ["의사소통"], observation: "블록을 나란히 놓고 길을 만들었습니다." }, result: { integratedRecord: "최종 기록", observationRefinementRows: [{ teacherInput: "원문", accurateObservation: "관찰 언어", firstImprovement: "개선 내용" }] } });
test("종합 기록 저장은 관찰 언어 보관에 자동 추가하지 않음", () => {
  const saved = mergeSavedRecord(request);
  assert.deepEqual(saved.savedKinds, ["record"]);
  assert.equal(saved.result.integratedRecord, "최종 기록");
  assert.deepEqual(saved.result.observationRefinementRows, []);
});
test("관찰 언어만 저장하면 종합 기록은 저장하지 않음", () => {
  const saved = mergeSavedRecord({ ...request, kind: "language" });
  assert.deepEqual(saved.savedKinds, ["language"]);
  assert.equal(saved.result.integratedRecord, "");
  assert.equal(saved.result.observationRefinementRows.length, 1);
});
test("저장 순서와 재시도에 관계없이 선택한 두 내용을 보존", () => {
  for (const first of ["record", "language"]) {
    let saved = mergeSavedRecord({ ...request, kind: first });
    saved = mergeSavedRecord({ ...request, kind: first === "record" ? "language" : "record" }, saved);
    saved = mergeSavedRecord(request, saved);
    assert.equal(saved.savedKinds.length, 2);
    assert.equal(saved.result.integratedRecord, "최종 기록");
    assert.equal(saved.result.observationRefinementRows.length, 1);
  }
});
test("생성 요청에서는 DB 저장을 수행하지 않음", () => {
  const source = fs.readFileSync(new URL("../src/app/api/records/generate/route.ts", import.meta.url), "utf8");
  assert.ok(!source.includes(".insert("));
  assert.ok(!source.includes(".update("));
  assert.ok(source.includes("saved: false"));
});
test("교사가 수정한 최종 문장을 재저장하고 별도 보관한 비교표는 유지", () => {
  const first = mergeSavedRecord(request, mergeSavedRecord({ ...request, kind: "language" }));
  const updated = mergeSavedRecord({ ...request, result: { ...request.result, observation: "교사가 수정한 관찰", integratedRecord: "교사가 검토한 최종 문장", finalNotice: "수정한 알림장" } }, first);
  assert.equal(updated.generationId, first.generationId);
  assert.equal(updated.result.observation, "교사가 수정한 관찰");
  assert.equal(updated.result.integratedRecord, "교사가 검토한 최종 문장");
  assert.equal(updated.result.finalNotice, "수정한 알림장");
  assert.deepEqual(updated.result.observationRefinementRows, first.result.observationRefinementRows);
  const route = fs.readFileSync(new URL("../src/app/api/records/save/route.ts", import.meta.url), "utf8");
  assert.ok(!route.includes("previous?.savedKinds.includes(input.kind)"));
});
test("놀이 이야기와 알림장 모두 비교표 지침과 허구 금지 포함", () => {
  const { buildRecordPrompt } = load("prompt");
  for (const recordType of ["놀이 이야기", "알림장"]) {
    const prompt = buildRecordPrompt({ ...request.input, recordType });
    for (const text of ["teacherInput", "accurateObservation", "firstImprovement", "입력하지 않은", "발달"]) assert.ok(prompt.includes(text));
  }
});
