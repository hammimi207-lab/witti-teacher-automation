import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const module = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('src/features/records/result-presentation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(module.exports);
const { removeMissingInputNotices, recommendedEmojis, presentGeneratedRecord } = module.exports;
test('screenshot missing-input sentences disappear while observed play remains', () => {
  const actual = '그림그리기를 하면서 웃음을 보였어요.';
  assert.equal(removeMissingInputNotices(`도준이는 오늘 식사와 배변 관찰이 따로 입력되지 않았습니다.\n\n${actual}\n\n반 공지 내용은 입력되지 않았습니다.`), actual);
});
test('actual negatives, decimals, quotes and announcement line breaks are preserved', () => {
  const actual = '점심을 먹지 않았어요. 아이는 "안 할래!"라고 말했어요.\n\n준비물: 물 0.5L\n모이는 시간: 9:30';
  assert.equal(removeMissingInputNotices(actual), actual);
});
test('all parent-facing result fields remove missing-input boilerplate', () => {
  const result = presentGeneratedRecord({ finalNotice: '반 공지 내용은 입력되지 않았습니다.', integratedRecord: '식사 관찰이 제공되지 않았습니다. 그림을 그렸어요.' });
  assert.equal(result.finalNotice, ''); assert.equal(result.integratedRecord, '그림을 그렸어요.');
});
test('exactly ten distinct emoji options even for older results with no recommendations', () => {
  for (const input of [undefined, [], ['🎨', '🎨', 'not emoji']]) {
    const emojis = recommendedEmojis(input); assert.equal(emojis.length, 10); assert.equal(new Set(emojis).size, 10); assert(!emojis.includes('not emoji'));
  }
});
