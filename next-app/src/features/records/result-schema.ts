import { z } from "zod";
export const generatedSchema = z.object({
  playNameRecommendations: z.array(z.object({ title: z.string(), photoEvidence: z.string(), observationEvidence: z.string(), reason: z.string() })).max(3).default([]),
  playNameLearningTip: z.string().default(""),
  observationRefinementRows: z.array(z.object({
    teacherInput: z.string(),
    accurateObservation: z.string(),
    firstImprovement: z.string(),
  })).max(5).default([]),
  curriculumLinks: z.array(z.object({ area: z.string(), description: z.string() })).default([]),
  observationEvaluation: z.string().default(""),
  integratedRecord: z.string().default(""),
  observation: z.string().default(""),
  interpretation: z.string().default(""),
  connection: z.string().default(""),
  finalNotice: z.string().default(""),
  recommendedEmojis: z.array(z.string()).max(10).default([]),
});
