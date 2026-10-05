import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import JSZip from "jszip";
import { Packer } from "docx";
const require = createRequire(import.meta.url);
function load(name) {
  const base = new URL(`../src/features/records/${name}`, import.meta.url);
  const file = [".ts", ".tsx"].map(ext => new URL(base.href + ext)).find(fs.existsSync);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const target = { exports: {} };
  new Function("require", "module", "exports", code)((id) => {
    if (id === "react") return { ...require(id), useRef: value => ({ current: value }), useState: value => [value, () => {}] };
    return id.startsWith("./") ? load(id.slice(2)) : require(id);
  }, target, target.exports);
  return target.exports;
}
const { WordDownload } = load("word-download");
const { unpackRecord } = load("saved-record-library");
test("STEAM export contains separate play judgments and grounded age-specific curriculum analysis", async () => {
  const { steam } = require('./steam-word-fixture.cjs');
  const { steamDocumentAnalysis } = load('steam-document-analysis');
  const analysis = steamDocumentAnalysis(steam);
  assert.equal(analysis.framework, '2024 개정 표준보육과정');
  assert.equal(analysis.band, '2세');
  assert.ok(analysis.links.some(link => link.area === '자연탐구' && /자석/.test(link.reason)));
  assert.ok(analysis.links.some(link => link.area === '사회관계'));
  assert.ok(!analysis.links.some(link => link.area === '예술경험'));
  for (const link of analysis.links) for (const evidence of link.evidence) assert.ok(steam.confirmedObservation.includes(evidence));
  const missing = steamDocumentAnalysis({...steam, confirmedObservation:'관찰 내용을 아직 자세히 기록하지 않았습니다.', interpretation:'노래를 불렀다.', extension:'친구와 함께 그림을 그릴 계획'});
  assert.equal(missing.links.length, 0, 'Interpretations and future plans must not become observed curriculum evidence');
  assert.equal(steamDocumentAnalysis({...steam,age:'4세'}).framework,'2019 개정 누리과정');
  assert.equal(steamDocumentAnalysis({...steam,age:'0세'}).band,'0~1세');
  const document = load('story-word-document').buildStoryWordDocument('기찻길 놀이', result, input, null, {steam});
  const zip = await JSZip.loadAsync(await Packer.toBuffer(document)); const xml = await zip.file('word/document.xml').async('string');
  for (const text of ['사진별 STEAM 영역과 판단 근거','사진 1의 놀이','사진 2의 놀이','E 공학','S 과학','교사가 확인한 관찰','이 내용범주와 연결한 이유','생활 속에서 탐구하기','다음 놀이 제안 아직 실행하지 않음','과정 중심 관찰기록 초안','과정 기록의 해석으로 선택하지 않음']) assert.ok(xml.includes(text),text);
  assert.doesNotMatch(xml,/생성된 교육과정 연계 설명이 없습니다/);
});
const input = {
  playName: "카드 꾸미기 놀이", recordType: "놀이 이야기", ageGroup: "2세", childAlias: "별님",
  curriculumAreas: ["의사소통"], observation: "아이가 종이에 스티커를 붙이며 카드를 꾸몄다.",
  playSubcategories: ["탐색"], playSubcategoryNotes: { 탐색: "스티커의 색을 비교하였다." },
  teacherSupports: ["자료 지원"], teacherSupportNotes: { "자료 지원": "색종이를 제공하였다." },
  teacherInterpretation: "재료의 차이에 관심을 보였다.", centerSupport: "색종이 제공", homeConnection: "가정에서 이야기 나누기", supportPlan: "다른 재료도 제공할 계획이다.",
};
const result = { integratedRecord: "카드를 꾸미며 친구와 대화하였다.", observationEvaluation: "색깔을 말로 표현하였다.", curriculumLinks: [{ area: "의사소통", description: "자신의 생각을 말한다." }], finalNotice: "오늘 카드 꾸미기를 즐겼습니다.", observation: "스티커를 붙였다.", interpretation: "관심을 보였다.", connection: "재료를 제공한다." };
async function clickDownload(t, props) {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/records/word");
    assert.equal(options.method, "POST");
    assert.equal(options.cache, "no-store");
    const record = JSON.parse(options.body.get("record"));
    const document = load("story-word-document").buildStoryWordDocument(record.title, record.result, record.input, record.createdAt, record);
    return new Response(new Uint8Array(await Packer.toBuffer(document)));
  });
  let blob;
  let clicked = false;
  t.mock.method(URL, "createObjectURL", value => { blob = value; return "blob:test"; });
  t.mock.method(globalThis, "setTimeout", () => 0);
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  globalThis.document = { createElement: () => ({ click() { clicked = true; }, remove() {} }), body: { appendChild() {} } };
  globalThis.window = globalThis;
  try {
    const element = WordDownload(props);
    await element.props.children.find(child => child.type === "button").props.onClick();
    assert.ok(clicked, "Download must succeed rather than fall into the error handler");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return zip.file("word/document.xml").async("string");
  } finally {
    globalThis.document = oldDocument;
    globalThis.window = oldWindow;
  }
}
function checkTables(xml) {
  const tables = xml.match(/<w:tbl>.*?<\/w:tbl>/gs) || [];
  assert.ok(tables.length >= 3, "Every download, including legacy records, must contain real Word tables");
  for (const table of tables) {
    assert.match(table, /<w:tblLayout w:type="fixed"/);
    const columns = [...table.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(m => Number(m[1]));
    assert.equal(columns.reduce((a, b) => a + b), 10200);
    if (columns.length === 2) assert.deepEqual(columns, [3060, 7140]);
    for (const row of table.match(/<w:tr>.*?<\/w:tr>/gs) || []) {
      const widths = [...row.matchAll(/<w:tcW w:type="dxa" w:w="(\d+)"/g)].map(m => Number(m[1]));
      assert.deepEqual(widths, columns);
    }
    for (const cell of table.match(/<w:tc>.*?<\/w:tc>/gs) || []) {
      assert.match(cell, /<w:tcBorders>/);
      for (const edge of ["top", "bottom", "left", "right"]) assert.match(cell, new RegExp(`<w:${edge} w:val="single" w:color="AAB8C8" w:sz="6"`));
    }
    assert.doesNotMatch(table, /<w:(trHeight|noWrap|cantSplit)/);
  }
  assert.doesNotMatch(xml, /w:fill="1F4E78"/);
  assert.match(xml, /w:fill="EAF3FB"/);
}
for (const recordType of ["놀이 이야기", "알림장", "일지"]) {
  test(`${recordType}: actual download button retains preview tables and saved content`, async t => {
    const xml = await clickDownload(t, { title: input.playName, input: { ...input, recordType }, result, edited: "교사가 수정한 문장" });
    checkTables(xml);
    for (const text of [result.integratedRecord, result.finalNotice, input.observation, "교사의 해석", input.teacherInterpretation, "다음 놀이 지원 계획", input.supportPlan, "교사가 수정한 문장", recordType]) assert.ok(xml.includes(text));
  });
}
test("old text-only saved records keep all text and use the same bordered layout", async t => {
  const plain = "이전에 저장한 놀이 이야기의 원문입니다. ".repeat(300);
  const record = { output_type: "놀이 이야기", result_text: plain, edited_text: "기존 수정 내용" };
  const unpacked = unpackRecord(record);
  const xml = await clickDownload(t, { ...unpacked, recordType: record.output_type, edited: record.edited_text });
  checkTables(xml);
  assert.ok(xml.includes(plain));
  assert.ok(xml.includes(record.edited_text));
  assert.ok(xml.includes("의 놀이 이야기"));
  assert.ok(!xml.includes("놀이 이야기 기록 문서"));
});
test("previously saved version-1 records retain their input tables on download", async t => {
  const saved = { version: 1, generationId: "550e8400-e29b-41d4-a716-446655440000", savedKinds: ["record"], input, result, createdAt: "2026-09-18T11:00:00Z" };
  const record = { output_type: "놀이 이야기", result_text: JSON.stringify(saved) };
  const xml = await clickDownload(t, { ...unpackRecord(record), recordType: record.output_type });
  checkTables(xml);
  for (const text of [input.playName, input.childAlias, input.playSubcategoryNotes["탐색"], input.teacherSupportNotes["자료 지원"]]) assert.ok(xml.includes(text));
});
test("saved stories with centerSupport retain teacher interpretation and next play plan", async t => {
  const oldInput = { ...input, supportPlan: "", centerSupport: "다음 놀이에서는 다양한 크기의 스티커를 준비하겠습니다." };
  const saved = { version: 1, generationId: "550e8400-e29b-41d4-a716-446655440000", savedKinds: ["record"], input: oldInput, result, createdAt: "2026-09-18T11:00:00Z" };
  const record = { output_type: "놀이 이야기", result_text: JSON.stringify(saved) };
  const xml = await clickDownload(t, { ...unpackRecord(record), recordType: record.output_type });
  assert.ok(xml.includes("교사의 해석"));
  assert.ok(xml.includes(input.teacherInterpretation));
  assert.ok(xml.includes("다음 놀이 지원 계획"));
  assert.equal(xml.split(oldInput.centerSupport).length - 1, 1);
});
test("explicit support plans take priority while separate center support remains intact", () => {
  const { teacherDocumentSections } = load("teacher-document-sections");
  const sections = teacherDocumentSections(input);
  assert.deepEqual(sections.find(([label]) => label === "다음 놀이 지원 계획"), ["다음 놀이 지원 계획", input.supportPlan]);
  assert.deepEqual(sections.find(([label]) => label === "원 내 확장 지원"), ["원 내 확장 지원", input.centerSupport]);
  const basic = teacherDocumentSections({ ...input, curriculumAreas: ["기본생활"], supportPlan: "", centerSupport: "생활 지원 계획" });
  assert.ok(basic.some(([label, text]) => label === "다음 지원 계획" && text === "생활 지원 계획"));
  const empty = teacherDocumentSections({ ...input, teacherInterpretation: "", supportPlan: "", centerSupport: "", homeConnection: "" });
  assert.deepEqual(empty, []);
});
