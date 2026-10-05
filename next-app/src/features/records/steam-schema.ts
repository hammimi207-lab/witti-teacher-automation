import { z } from "zod";

const text = z.string().max(4000);
export const steamAnalysisSchema = z.object({
  photoFacts: z.array(z.object({ photo: z.number().int().min(1).max(5), fact: text })).max(20),
  cards: z.array(z.object({
    area: z.enum(["S 과학", "T 기술", "E 공학", "A 예술", "M 수학"]),
    evidence: z.array(z.object({ source: z.enum(["photo", "observation"]), photo: z.number().int().min(0).max(5), quote: text })).min(1).max(8),
    interpretation: text, watch: text, extension: text,
    status: z.enum(["배움의 가능성", "추가 관찰 필요"]),
  })).max(5),
  support: z.object({ materials: z.array(text).min(2).max(3), teacher: text, watch: z.array(text).min(2).max(3), safety: text }),
});
export type SteamAnalysis = z.infer<typeof steamAnalysisSchema>;
export const steamVerificationSchema = z.object({
  area: z.string().max(30), source: z.enum(["photo", "observation"]), quote: text,
  verdict: z.enum(["passed", "failed", "needs_review"]), reason: z.string().max(500),
  startOffset: z.number().int().nullable(), endOffset: z.number().int().nullable(),
});
export const steamRunSchema = z.object({
  runId: z.string().uuid(), model: z.string().max(100), promptVersion: z.string().max(100), schemaVersion: z.string().max(100),
  generatedAt: z.iso.datetime(), inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  photoHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(5),
  originalAnalysis: steamAnalysisSchema, checks: z.array(steamVerificationSchema).max(40),
});
export type SteamRun = z.infer<typeof steamRunSchema>;
export const steamInputSchema = z.object({
  age: z.enum(["0세", "1세", "2세", "3세", "4세", "5세"]),
  observation: z.string().trim().min(1).max(15000),
  photoIds: z.array(z.number().int().positive().safe()).max(5),
});
export const steamSavedSchema = z.object({
  version: z.literal(1), age: steamInputSchema.shape.age,
  sourceObservation: steamInputSchema.shape.observation,
  photoIds: steamInputSchema.shape.photoIds,
  recordingIds: z.array(z.string().uuid()).max(50),
  analysis: steamAnalysisSchema,
  confirmedObservation: z.string().trim().min(10).max(15000),
  selectedAreas: z.array(z.enum(["S 과학", "T 기술", "E 공학", "A 예술", "M 수학"])).max(5),
  interpretation: z.string().max(3000), extension: z.string().max(2000),
  process: z.object({ interest: text, attempt: text, change: text, repeat: text, teacher: text, next: text }),
  draft: z.string().trim().min(10).max(25000),
  reviewed: z.literal(true),
  analyzedInput: steamInputSchema,
  run: steamRunSchema.optional(),
  previousRuns: z.array(steamRunSchema.omit({ originalAnalysis: true, checks: true })).max(100).optional(),
});
export type SteamSaved = z.infer<typeof steamSavedSchema>;
export const steamDraftSchema = z.object({
  step: z.number().int().min(0).max(5), age: steamInputSchema.shape.age,
  observation: z.string().max(15000), title: z.string().max(100), alias: z.string().max(50),
  photoIds: steamInputSchema.shape.photoIds, recordingIds: steamSavedSchema.shape.recordingIds,
  analysis: steamAnalysisSchema.nullable(), analyzedSignature: z.string().max(20000),
  confirmed: z.string().max(15000), selectedAreas: steamSavedSchema.shape.selectedAreas,
  interpretation: steamSavedSchema.shape.interpretation, extension: steamSavedSchema.shape.extension,
  process: steamSavedSchema.shape.process, draft: z.string().max(25000),
  generationId: z.union([z.literal(""), z.string().uuid()]), createdAt: z.string().max(100),
  missingPhotos: z.array(z.string().max(500)).max(5), updatedAt: z.number(),
  run: steamRunSchema.nullable().optional(),
  previousRuns: steamSavedSchema.shape.previousRuns,
});

// Teacher quotes must be exact substrings. Photo references must point to an actual image.
export function groundAnalysis(result: SteamAnalysis, observation: string, photoCount: number): SteamAnalysis {
  const photoFacts = result.photoFacts.filter(item => item.photo <= photoCount && item.fact.trim());
  const cards = result.cards.map(card => ({ ...card, evidence: card.evidence.filter(item => item.quote.trim() && (item.source === "observation" ? observation.includes(item.quote) : item.photo > 0 && item.photo <= photoCount && photoFacts.some(fact => fact.photo === item.photo && fact.fact === item.quote))) })).filter(card => card.evidence.length);
  return { ...result, photoFacts, cards: cards.filter((card, index) => cards.findIndex(other => other.area === card.area) === index) };
}

// Following Childcare Insight, verify against the source rather than trusting AI citations.
// Photo existence can be checked; the truth of a visual interpretation still needs teacher review.
export function verifySteamAnalysis(result: SteamAnalysis, observation: string, photoCount: number) {
  const checks: z.infer<typeof steamVerificationSchema>[] = [];
  for (const card of result.cards) for (const evidence of card.evidence) {
    const offset = evidence.source === "observation" && evidence.quote.trim() ? observation.indexOf(evidence.quote) : -1;
    const matched = evidence.source === "observation" ? offset >= 0 : evidence.photo > 0 && evidence.photo <= photoCount && result.photoFacts.some(fact => fact.photo === evidence.photo && fact.fact === evidence.quote && fact.fact.trim());
    checks.push({ area: card.area, source: evidence.source, quote: evidence.quote, verdict: !matched ? "failed" : evidence.source === "photo" ? "needs_review" : "passed",
      reason: !matched ? "입력 원문 또는 선택 사진에 연결되지 않은 근거라 분석 카드에서 제외했습니다." : evidence.source === "photo" ? "선택 사진 번호와 관찰 후보에 연결됩니다. 사진의 실제 내용과 해석 타당성은 교사가 확인해야 합니다." : "교사 관찰의 인용문이 원문과 일치합니다. 배움의 해석 타당성은 별도 확인이 필요합니다.",
      startOffset: offset >= 0 ? offset : null, endOffset: offset >= 0 ? offset + evidence.quote.length : null });
  }
  return { analysis: groundAnalysis(result, observation, photoCount), checks };
}

export function processDraft(process: SteamSaved["process"], interpretation = "") {
  return ([ ["처음 관심", process.interest], ["시도한 행동", process.attempt], ["시도 중 변화", process.change], ["반복하거나 바꾼 점", process.repeat], ["실제로 제공한 교사 지원", process.teacher], ["다음 관찰 계획 (아직 실행하지 않음)", process.next] ] as const)
    .map(([label, value]) => `${label}: ${value.trim() || "[교사 보충 필요]"}`).join("\n\n") + (interpretation.trim() ? `\n\n배움의 해석 (잠정적): ${interpretation.trim()}` : "");
}
