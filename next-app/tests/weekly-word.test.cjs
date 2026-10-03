/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const JSZip = require("jszip");
const { Packer } = require("docx");
function load(name) {
  const file = [".ts", ".tsx"].map(ext => path.resolve(__dirname, `../src/features/records/${name}${ext}`)).find(fs.existsSync);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(id => id === "react" ? { ...require("react"), useRef: value => ({ current: value }), useState: value => [value, () => {}] } : id.startsWith("./") ? load(id.slice(2)) : require(id), mod, mod.exports);
  return mod.exports;
}
const { buildWeeklyWordDocument } = load("weekly-word-document");
const { WeeklyWordDownload } = load("weekly-word-download");
const content = {
  range: { monday: "2026-09-14", saturday: "2026-09-19" },
  sources: [{ id: "1", date: "2026-09-14", childAlias: "별님", ageGroup: "2세", playName: "블록 기차 놀이" }, { id: "2", date: "2026-09-18", childAlias: "달님", ageGroup: "2세", playName: "길 만들기" }],
  result: { overview: "기차와 길을 구성하며 놀이를 이어 갔습니다.\n친구의 구성물에도 관심을 보였습니다.", interests: [{ interest: "기차와 길 구성하기", evidence: "블록을 이어 붙이며 기차와 길이라고 말했습니다.", sourceIds: ["1", "2"] }], plays: [
    { title: "블록 기차와 길 놀이", sourceIds: ["1", "2"], scenes: [{ sourceIds: ["1"], observation: "별님이는 블록 세 개를 연결하며 ‘기차야’라고 말했습니다." }, { sourceIds: ["2"], observation: "달님이는 친구의 기차 옆에 길을 만들었습니다." }], teacherSupport: "블록을 보관해 주었더니 오후 놀이 때 다시 사용했습니다.", teacherInterpretation: "교사는 구성물을 이어 가는 데 관심을 보인 것으로 해석했습니다.", nextSupportPlan: "긴 블록을 준비하고 길을 잇는 과정을 살펴볼 계획입니다." },
  ], limitations: "두 아이의 저장 기록을 바탕으로 정리했습니다. 기록에 없는 반응은 확인되지 않습니다." },
};
test("weekly download button produces a real Word file, with the requested title and complete visible analysis", async t => {
  let blob, filename, clicked = false;
  t.mock.method(URL, "createObjectURL", value => { blob = value; return "blob:test"; });
  const oldDocument = global.document, oldWindow = global.window;
  global.document = { createElement: () => ({ set download(value) { filename = value; }, click() { clicked = true; }, remove() {} }), body: { appendChild() {} } };
  global.window = { setTimeout() {} };
  try {
    const element = WeeklyWordDownload({ content });
    await element.props.children[0].props.onClick();
    assert.ok(clicked);
    assert.equal(filename, "우리반_주간_놀이_이야기_2026-09-14_2026-09-19.docx");
    const bytes = Buffer.from(await blob.arrayBuffer());
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml").async("string");
    for (const text of ["우리반 주간 놀이 이야기", "2026-09-19", "월~토", "교사가 관찰한 실제 장면", "교사의 지원", "교사의 해석", "다음 놀이 지원 계획", ...content.result.overview.split("\n"), content.result.interests[0].evidence, content.result.limitations,
      ...content.result.plays.flatMap(play => [play.title, play.teacherSupport, play.teacherInterpretation, play.nextSupportPlan, ...play.scenes.map(scene => scene.observation)])]) assert.ok(xml.includes(text), text);
    assert.match(xml, /w:pStyle w:val="Title"/);
    assert.match(xml, /w:pgSz w:w="11906" w:h="16838"/);
    const tables = xml.match(/<w:tbl>.*?<\/w:tbl>/gs);
    assert.equal(tables.length, 6);
    for (const table of tables) {
      assert.match(table, /w:tblLayout w:type="fixed"/);
      const grid = [...table.matchAll(/w:gridCol w:w="(\d+)"/g)].map(m => +m[1]);
      assert.equal(grid.reduce((a, b) => a + b), 9638);
      for (const row of table.match(/<w:tr>.*?<\/w:tr>/gs)) assert.deepEqual([...row.matchAll(/w:tcW w:type="dxa" w:w="(\d+)"/g)].map(m => +m[1]), grid);
    }
    if (process.env.WEEKLY_WORD_QA === "1") fs.writeFileSync(path.resolve(__dirname, "../.qa/weekly-word-sample.docx"), bytes);
  } finally { global.document = oldDocument; global.window = oldWindow; }
});
test("long multi-play records retain their text and allow body rows to flow across pages", async () => {
  const long = "아이가 만든 기차의 길을 이어 가며 친구와 이야기를 나누었습니다.\n".repeat(120);
  const fixture = { ...content, result: { ...content.result, plays: [...content.result.plays, { ...content.result.plays[0], title: "길을 더 이어 가기", teacherSupport: long }] } };
  const bytes = await Packer.toBuffer(buildWeeklyWordDocument(fixture));
  const xml = await (await JSZip.loadAsync(bytes)).file("word/document.xml").async("string");
  assert.equal((xml.match(/아이가 만든 기차의 길을 이어 가며 친구와 이야기를 나누었습니다./g) || []).length, 120);
  const row = (xml.match(/<w:tr>.*?<\/w:tr>/gs) || []).find(row => row.includes("아이가 만든 기차의 길을"));
  assert.doesNotMatch(row, /w:cantSplit|w:trHeight/);
  if (process.env.WEEKLY_WORD_QA === "1") fs.writeFileSync(path.resolve(__dirname, "../.qa/weekly-word-long.docx"), bytes);
});
