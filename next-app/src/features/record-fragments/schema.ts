import { z } from "zod";

export const recordTypeSchema = z.enum(["text", "voice", "play_photo", "record_photo", "video", "artifact"]);
export const recordPhotoSubtypeSchema = z.enum(["handwritten_note", "postit", "play_flow", "observation_sheet", "board_documentation", "other"]);
export const fragmentIdSchema = z.string().uuid();

// Original, teacher-authored, and AI-derived content intentionally have separate owners.
export const createFragmentSchema = z.object({
  classId: z.string().uuid().nullable().optional(),
  childIds: z.array(z.string().uuid()).max(100).default([]),
  recordType: recordTypeSchema,
  recordSubtype: recordPhotoSubtypeSchema.nullable().optional(),
  recordedAt: z.iso.datetime({ offset: true }),
  rawText: z.string().max(100_000).nullable().optional(),
  teacherNote: z.string().max(100_000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  playTopic: z.string().max(300).nullable().optional(),
}).superRefine((value, context) => {
  if (value.recordType !== "record_photo" && value.recordSubtype != null) {
    context.addIssue({ code: "custom", path: ["recordSubtype"], message: "Only record photos have this subtype." });
  }
});

export type RecordType = z.infer<typeof recordTypeSchema>;
export type RecordPhotoSubtype = z.infer<typeof recordPhotoSubtypeSchema>;
export type CreateFragmentInput = z.infer<typeof createFragmentSchema>;

export type RecordFragment = {
  fragmentId: string;
  userId: string;
  classId: string | null;
  childIds: string[];
  recordType: RecordType;
  recordSubtype: RecordPhotoSubtype | null;
  recordedAt: string;
  createdAt: string;
  rawText: string | null;
  teacherNote: string | null;
  tags: string[];
  playTopic: string | null;
  playClusterId: string | null;
  autoLinkedPlayIds: string[];
  teacherConfirmedPlayId: string | null;
  includedInStory: boolean;
  sourceFile: { bucket: string; path: string; durationMs: number | null } | null;
  rawTranscription: string | null;
  teacherEditedTranscription: string | null;
  aiSummary: string | null;
  aiExtractedText: string | null;
};
