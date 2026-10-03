import type { GeneratedRecord } from "./schema";

const fallbackEmojis = ["😊", "🌷", "🌱", "✨", "💛", "🎨", "🧩", "📚", "🌈", "👏"];
export function recommendedEmojis(values: string[] = []) {
  return [...new Set([...values.filter(value => value.length <= 16 && /\p{Extended_Pictographic}/u.test(value)), ...fallbackEmojis])].slice(0, 10);
}

// Remove input-status boilerplate, never factual negatives such as “점심을 먹지 않았어요”.
export function removeMissingInputNotices(text: string) {
  const missing = /(?:입력|기재|제공)(?:이|가|은|는)?\s*(?:되지\s*않|되지\s*못|되지\s*않았|없|된\s*(?:내용|정보|관찰|사항)(?:이|가)?\s*없)|(?:입력된|제공된)\s*(?:내용|정보|관찰|사항)(?:이|가)?\s*없|미입력/;
  return text.split(/\n\s*\n/).map(paragraph => (paragraph.match(/[^.!?]+(?:[.!?]+|$)/g) || []).filter(sentence => !missing.test(sentence)).join("").trim()).filter(Boolean).join("\n\n");
}
export function presentGeneratedRecord(result: GeneratedRecord): GeneratedRecord {
  const next = { ...result, recommendedEmojis: recommendedEmojis(result.recommendedEmojis) };
  for (const key of ["finalNotice", "integratedRecord", "observation", "interpretation", "connection", "observationEvaluation"] as const) {
    if (next[key]) next[key] = removeMissingInputNotices(next[key]);
  }
  return next;
}
