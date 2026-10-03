import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function load(name) {
  const file = [".tsx", ".ts"].map(ext => new URL(`../src/features/records/${name}${ext}`, import.meta.url)).find(fs.existsSync);
  const source = fs.readFileSync(file, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const target = { exports: {} };
  new Function("require", "module", "exports", code)((id) => id.startsWith("./") ? load(id.slice(2)) : require(id), target, target.exports);
  return target.exports;
}
const { PlayNameTip } = load("play-name-tip");
const { StoryDocumentPreview } = load("story-document-preview");
test("놀이명 추천은 작은 말풍선이며 상세 근거는 기본 접힘", () => {
  const html = renderToStaticMarkup(React.createElement(PlayNameTip, { result: { originalPlayName: "블록 놀이", playNameRecommendations: [{ title: "길을 이어 만드는 우리 동네", reason: "배치하는 과정", photoEvidence: "블록", observationEvidence: "길 만들기" }] } }));
  assert.ok(html.includes("play-name-bubble"));
  assert.ok(html.includes("<details>"));
  assert.ok(!html.includes("<details open"));
});
test("종합 기록은 기본 정보·사진·교육과정·최종 기록·관찰 평가·입력 순서", () => {
  const html = renderToStaticMarkup(React.createElement(StoryDocumentPreview, { result: { integratedRecord: "생성된 놀이 이야기", observationEvaluation: "실제 관찰 평가" }, snapshot: { files: [], createdAt: "2026. 9. 4.", input: { playName: "블록 놀이", recordType: "놀이 이야기", ageGroup: "2세", childAlias: "별님", curriculumAreas: ["의사소통"], playSubcategories: [], playSubcategoryNotes: {}, teacherSupports: [], teacherSupportNotes: {}, observation: "교사 관찰 원문", supportPlan: "" } } }));
  const headings = ["기록 기본 정보", "등록 사진", "표준보육과정", "놀이 이야기 기록 예시", "영아", "교사가 직접 입력한 내용"];
  for (let i = 1; i < headings.length; i++) assert.ok(html.indexOf(headings[i - 1]) < html.indexOf(headings[i]));
  assert.ok(html.includes("교사 관찰 원문"));
  assert.ok(!html.includes("전자알림장"));
  assert.ok(!html.includes("상태: 일치"));
});
test("전자알림장 노출 조건은 생성 당시 유형을 사용", () => {
  const source = fs.readFileSync(new URL("../src/features/records/record-wizard.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('isNotice={snapshot?.input.recordType === "알림장"}'));
  assert.ok(source.includes("input: submittedInput, files: submittedFiles"));
});
test("미리보기에도 교사의 해석과 이전 형식의 다음 놀이 지원 계획을 표시", () => {
  const input = { playName: "블록 놀이", recordType: "놀이 이야기", ageGroup: "2세", childAlias: "별님", curriculumAreas: ["의사소통"], playSubcategories: [], playSubcategoryNotes: {}, teacherSupports: [], teacherSupportNotes: {}, observation: "교사 관찰 원문", teacherInterpretation: "재료를 비교하는 과정으로 이해했습니다.", supportPlan: "", centerSupport: "크기가 다른 블록을 준비할 계획입니다." };
  const html = renderToStaticMarkup(React.createElement(StoryDocumentPreview, { result: {}, snapshot: { files: [], createdAt: "2026-09-18", input } }));
  for (const text of ["교사의 해석", input.teacherInterpretation, "다음 놀이 지원 계획", input.centerSupport]) assert.ok(html.includes(text));
  assert.equal(html.split(input.centerSupport).length - 1, 1);
});
