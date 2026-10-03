export function revisionDiff(before: string, after: string): { text: string; added: boolean }[] {
  const a: string[] = before.match(/\s+|[^\s]+/g) || [];
  const b: string[] = after.match(/\s+|[^\s]+/g) || [];
  // 긴 입력에서도 UI를 멈추지 않도록 비교 크기를 제한합니다.
  if (a.length * b.length > 250000) return b.map(text => ({ text, added: !a.includes(text) }));
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) lengths[i][j] = a[i] === b[j] ? 1 + lengths[i + 1][j + 1] : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  let i = 0; let j = 0;
  const output: { text: string; added: boolean }[] = [];
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) { output.push({ text: b[j++], added: false }); i++; }
    else if (i < a.length && lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else output.push({ text: b[j++], added: true });
  }
  return output;
}
