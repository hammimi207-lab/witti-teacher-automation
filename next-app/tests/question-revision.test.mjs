import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
function load(name) {
  const file = path.resolve('src/features/records', name + '.ts');
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(dependency => load(dependency.replace('./', '')), loaded, loaded.exports);
  return loaded.exports;
}
const { questionRevisionFeedback } = load('revision-feedback');
const { observationPositive } = load('observation-positive');
const { revisionExplanation } = load('revision-explanation');
test('지원 수정은 탐색 방법과 아이의 주도성을 구체적으로 설명', () => {
  const result = revisionExplanation('바나나를 탐색할 수 있도록 지원해 주었음.', '바나나를 들어보며 자유롭게 탐색할 수 있도록 지원해 주었음.', '자료 지원');
  assert.match(result.items.map(item => item.why).join(' '), /지원 방식/);
  assert.match(result.items.map(item => item.why).join(' '), /주도성/);
  assert.ok(result.items.some(item => item.evidence.includes('들어보며')));
  assert.equal(revisionExplanation('바나나를 제공함.', '바나나를 제공함. 자유롭게 선택하지 않았음.', '자료 지원').items.length, 0);
});
test('계획 수정도 설명하며 단순 문장 추가는 무조건 칭찬하지 않음', () => {
  assert.ok(revisionExplanation('지원할 예정임.', '블록을 준비해 자유롭게 선택하도록 지원할 예정임.', '계획').items.length);
  const result = revisionExplanation('바나나를 만짐.', '바나나를 만짐. 기록을 마침.', '관찰');
  assert.equal(result.items.length, 0);
  assert.match(result.fallback, /기록을 마침/);
});
const { collectTeacherRevisions, describeGrowth } = load('teacher-revisions');

test('교사 최초 원문과 수정 원문은 시간·표정·줄바꿈을 축약하지 않음', () => {
  const before = '바나나를 바라봄.';
  const after = '바나나를 1~2분 응시함.\n미소지으며 껍질을 만짐.';
  const input = { playSubcategories: [], teacherSupports: [], observation: after };
  const [row] = collectTeacherRevisions(input, { observation: before });
  assert.equal(row.before, before);
  assert.equal(row.after, after);
  assert.match(describeGrowth(row).join(' '), /1~2분/);
  assert.match(describeGrowth(row).join(' '), /표정/);
  assert.equal(collectTeacherRevisions(input, {})[0].before, after);
  assert.match(describeGrowth({ ...row, before: after }).join(' '), /아직 문구를 수정하지/);
});
test('잘 작성한 관찰은 행동·시간·표정을 짚어 긍정 피드백', () => {
  const result = observationPositive('아이는 바나나를 1~2분 가량 응시하고 미소지었음.', '관찰');
  assert.match(result, /응시/); assert.match(result, /1~2분/); assert.match(result, /미소/);
  assert.equal(observationPositive('', '관찰'), null);
  assert.equal(observationPositive('매우 즐거워하고 집중하였음.', '관찰'), null);
  assert.equal(observationPositive('바나나를 제공함.', '자료 지원'), null);
});
test('반복 행동 추가를 앞서 제시한 질문과 실제 문장으로 연결', () => {
  const before = '바나나 껍질채 있는 것을 만짐.';
  const after = '바나나 껍질채 있는 것을 반복적으로 만짐. 옆에 준비된 바나나 속살도 만져보면서 촉감을 느낌.';
  const result = questionRevisionFeedback(before, after, '탐색과 반복');
  assert.equal(result[0].topic, '탐색 방법의 변화');
  assert.equal(result[0].evidence, '바나나 껍질채 있는 것을 반복적으로 만짐.');
  assert.match(result[0].why, /질문/);
});
test('이미 있던 반복 표현·무관한 수정·부정문을 보완으로 칭찬하지 않음', () => {
  assert.deepEqual(questionRevisionFeedback('바나나를 반복해서 만짐.', '바나나를 반복해서 만짐. 기록을 마침.', '탐색과 반복'), []);
  assert.deepEqual(questionRevisionFeedback('바나나를 만짐.', '바나나를 만짐. 반복하지 않았음.', '탐색과 반복'), []);
  assert.deepEqual(questionRevisionFeedback('바나나를 만짐.', '바나나를 만짐. 기록을 마침.', '탐색과 반복'), []);
});
