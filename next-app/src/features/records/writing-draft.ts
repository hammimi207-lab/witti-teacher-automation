import { z } from "zod";
import { writingFormSchema } from "./writing-workflow";
import { generatedSchema } from "./result-schema";
import { recordInputSchema } from "./schema";

export const draftSchema = z.object({
  version: z.literal(1), updatedAt: z.string(), input: writingFormSchema,
  result: generatedSchema.extend({ originalPlayName: z.string().optional() }).nullable(), generationId: z.string(),
  snapshot: z.object({ input: recordInputSchema, createdAt: z.string() }).nullable(),
  selectedAnnouncements: z.array(z.object({ id: z.string(), content: z.string(), created_at: z.string(), title: z.string().optional(), category: z.string().optional(), applied: z.boolean().optional() })),
});
export type WritingDraft = z.infer<typeof draftSchema>;
export function hasDraftContent(input: WritingDraft["input"]) {
  const fields = [input.childAlias, input.playName, input.observation, input.teacherInterpretation,
    input.centerSupport, input.homeConnection, input.mealObservation, input.toiletingObservation,
    input.peerInteraction, input.activityLearning, input.classAnnouncement, input.supportPlan,
    input.dailyObservation, input.playObservation, input.activityObservation, input.openingGreeting, input.closingGreeting, input.commonActivity || "",
    ...Object.values(input.playSubcategoryNotes), ...Object.values(input.teacherSupportNotes)];
  return fields.some(value => value.trim().length > 0);
}
export function draftKey(userId: string) { return `record-fairy:draft:v1:${userId}`; }
export function readDraft(raw: string | null): WritingDraft | null {
  if (!raw) return null;
  try {
    const draft = draftSchema.parse(JSON.parse(raw));
    if (draft.input.recordType === "알림장") {
      // Migrate old input areas without modifying an existing final result or saved snapshot.
      draft.input.dailyObservation ||= [draft.input.mealObservation, draft.input.toiletingObservation].filter(Boolean).join("\n\n");
      draft.input.playObservation ||= draft.input.peerInteraction;
      draft.input.activityObservation ||= draft.input.activityLearning;
      draft.input.noticeMode = "detailed";
    }
    return draft;
  } catch { return null; }
}
