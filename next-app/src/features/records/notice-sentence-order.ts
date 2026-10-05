export type NoticeSentence = { id: string; text: string };

// Keep separators in their original slots so a final sentence without a trailing
// space can move to the front without joining two sentences together.
export function noticeParts(text: string) {
  const segments = [...new Intl.Segmenter("ko", { granularity: "sentence" }).segment(text)];
  const sentences: string[] = [];
  const separators: string[] = [];
  let prefix = "";
  for (const { segment } of segments) {
    const match = segment.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    if (!match[2]) { if (separators.length) separators[separators.length - 1] += segment; else prefix += segment; continue; }
    if (!sentences.length) prefix += match[1];
    else separators[separators.length - 1] += match[1];
    sentences.push(match[2]); separators.push(match[3]);
  }
  return { sentences, separators, prefix };
}

export function noticeText(rows: NoticeSentence[], parts: ReturnType<typeof noticeParts>) {
  return parts.prefix + rows.map((row, index) => row.text + (parts.separators[index] ?? "")).join("");
}

export function moveSentence(rows: NoticeSentence[], id: string, destination: number) {
  const source = rows.findIndex(row => row.id === id);
  if (source < 0 || destination < 0 || destination >= rows.length || source === destination) return rows;
  const moved = [...rows];
  moved.splice(destination, 0, moved.splice(source, 1)[0]);
  return moved;
}
