import { z } from "zod";
import { recordInputSchema } from "./schema";
import { generatedSchema } from "./result-schema";
import { aiConsentSchema } from "./ai-consent";
const teacherRevisions = z.array(z.object({ context: z.string(), before: z.string(), after: z.string() })).optional();

export const saveRequestSchema = z.object({
  generationId: z.string().uuid(),
  kind: z.enum(["record", "language"]),
  input: recordInputSchema,
  result: generatedSchema,
  createdAt: z.string().max(100),
  teacherRevisions,
  consent: aiConsentSchema.optional(),
});
export const savedEnvelopeSchema = z.object({
  version: z.literal(1),
  generationId: z.string().uuid(),
  savedKinds: z.array(z.enum(["record", "language"])),
  input: recordInputSchema,
  result: generatedSchema,
  createdAt: z.string(),
  teacherRevisions,
  consent: aiConsentSchema.extend({ acceptedAt: z.string().optional(), aiText: z.string().optional(), photoText: z.string().optional() }).optional(),
});
export type SavedEnvelope = z.infer<typeof savedEnvelopeSchema>;

export function mergeSavedRecord(request: z.infer<typeof saveRequestSchema>, previous?: SavedEnvelope): SavedEnvelope {
  const savedKinds = [...new Set([...(previous?.savedKinds ?? []), request.kind])];
  const result = { ...(previous?.result ?? generatedSchema.parse({})) };
  if (request.kind === "record") {
    const rows = result.observationRefinementRows;
    Object.assign(result, request.result);
    result.observationRefinementRows = rows;
  } else result.observationRefinementRows = request.result.observationRefinementRows;
  return { version: 1, generationId: request.generationId, savedKinds, input: request.input, result, createdAt: request.createdAt, teacherRevisions: request.teacherRevisions ?? previous?.teacherRevisions, consent: previous?.consent ?? request.consent };
}
