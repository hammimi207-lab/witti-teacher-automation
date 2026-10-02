import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import JSZip from "jszip";
import { Packer } from "docx";
const require = createRequire(import.meta.url);
function load(name) {
  const file = [".ts", ".tsx"].map(ext => new URL(`../src/features/records/${name}${ext}`, import.meta.url)).find(fs.existsSync);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)(id => id.startsWith("./") ? load(id.slice(2)) : require(id), module, module.exports);
  return module.exports;
}
const { noticeParts, noticeText, moveSentence } = load("notice-sentence-order");
function rows(parts) { return parts.sentences.map((text, i) => ({ id: `test-${i}`, text })); }
test("sentence extraction preserves punctuation, emoji, blank lines and whitespace exactly", () => {
  for (const text of ["", "  ", "첫 문장입니다. 두 문장입니다.", "  안녕하세요! 😊\n\n오늘 놀았어요.\r\n끝입니다.  ", "같아요. 같아요. 끝이에요.", "문장 부호 없는 기록", "안녕하세요.\n오늘 놀았어요."]) {
    const parts = noticeParts(text);
    assert.equal(noticeText(rows(parts), parts), text);
  }
});
test("duplicate sentences have independent IDs and moving last sentence keeps separation", () => {
  const parts = noticeParts("같아요. 같아요. 끝이에요.");
  const original = rows(parts);
  const moved = moveSentence(original, "test-1", 2);
  assert.deepEqual(moved.map(row => row.id), ["test-0", "test-2", "test-1"]);
  assert.deepEqual(original.map(row => row.id), ["test-0", "test-1", "test-2"]);
  assert.equal(noticeText(moveSentence(original, "test-2", 0), parts), "끝이에요. 같아요. 같아요.");
  assert.equal(moveSentence(original, "missing", 0), original);
  assert.equal(moveSentence(original, "test-0", -1), original);
});
test("reordered finalNotice survives save, re-save, reload and actual Word XML", async () => {
  const { saveRequestSchema, savedEnvelopeSchema, mergeSavedRecord } = load("save-contract");
  const { unpackRecord } = load("saved-record-library");
  const parts = noticeParts("첫 문장입니다. 같은 문장입니다. 같은 문장입니다. 마지막입니다.");
  const finalNotice = noticeText(moveSentence(rows(parts), "test-3", 0), parts);
  const request = saveRequestSchema.parse({ generationId: "6f7c88a9-107e-4f75-803c-9dcf9d532f66", kind: "record", createdAt: "2026-10-03", input: { playName: "블록 놀이", ageGroup: "3세", childAlias: "별님", recordType: "알림장", curriculumAreas: ["자연탐구"], observation: "아이가 블록 세 개를 쌓았다." }, result: { finalNotice, integratedRecord: "기존 종합 기록" } });
  const envelope = mergeSavedRecord(request);
  const restored = savedEnvelopeSchema.parse(JSON.parse(JSON.stringify(envelope)));
  const saved = { id: 1, output_type: "알림장", result_text: JSON.stringify(restored), created_at: "2026-10-03", edited_text: null, source_text: null };
  const result = unpackRecord(saved).result;
  assert.equal(result.finalNotice, finalNotice);
  assert.equal(result.integratedRecord, "기존 종합 기록");
  assert.equal(mergeSavedRecord(request, restored).result.finalNotice, finalNotice);
  const document = load("story-word-document").buildStoryWordDocument("블록 놀이", result, request.input, request.createdAt);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
  const xml = await zip.file("word/document.xml").async("string");
  assert.ok(xml.includes(finalNotice));
});
