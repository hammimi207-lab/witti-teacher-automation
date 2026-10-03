import { z } from "zod";
import { missingPlaceholders, validWritingDate } from "./notice-workflow";

export const recordInputSchema = z.object({
  playName: z.string().trim().min(2, "놀이명 또는 기록명을 입력해 주세요.").max(100),
  ageGroup: z.enum(["0세", "1세", "2세", "3세", "4세", "5세"]),
  childAlias: z.string().trim().min(1, "아이 별칭을 입력해 주세요.").max(50),
  recordType: z.enum(["놀이 이야기", "일지", "알림장"]),
  curriculumAreas: z.array(z.string()),
  observation: z.string().trim().min(10, "실제로 관찰한 장면을 10자 이상 적어 주세요.").max(25000),
  playSubcategories: z.array(z.string()).default([]),
  playSubcategoryNotes: z.record(z.string(), z.string()).default({}),
  teacherSupports: z.array(z.string()).default([]),
  teacherSupportNotes: z.record(z.string(), z.string()).default({}),
  teacherInterpretation: z.string().trim().max(3000).default(""),
  centerSupport: z.string().trim().max(3000).default(""),
  homeConnection: z.string().trim().max(3000).default(""),
  mealObservation: z.string().trim().max(2000).default(""),
  toiletingObservation: z.string().trim().max(2000).default(""),
  peerInteraction: z.string().trim().max(3000).default(""),
  activityLearning: z.string().trim().max(3000).default(""),
  classAnnouncement: z.string().trim().max(3000).default(""),
  supportPlan: z.string().trim().max(2000).default(""),
  parentType: z.enum(["일반형", "예민형", "공격형", "불안형"]).default("일반형"),
  teacherStyle: z.enum(["팩트 중심형", "따뜻한 감성형", "이모티콘 활용형", "전문적 설명형"]).optional(),
  noticeMode: z.enum(["quick", "detailed"]).optional(),
  commonActivity: z.string().max(3000).optional(),
  writingDate: z.string().refine(validWritingDate, "작성일을 확인해 주세요.").optional(),
  dailyObservation: z.string().trim().max(5000).default(""),
  playObservation: z.string().trim().max(5000).default(""),
  activityObservation: z.string().trim().max(5000).default(""),
  inheritedObservation: z.string().trim().max(15000).default(""),
  openingGreeting: z.string().trim().max(500).default(""),
  closingGreeting: z.string().trim().max(500).default(""),
  openingKind: z.enum(["basic", "season", "weather", "custom", "none"]).default("none"),
  closingKind: z.enum(["basic", "weekend", "holiday", "custom", "none"]).default("none"),
});

// Keep older saved records readable; require explicit choices for new notices.
export const generationInputSchema = recordInputSchema.extend({ parentType: recordInputSchema.shape.parentType.removeDefault() }).superRefine((input, context) => {
  if (input.recordType !== "알림장" && !input.curriculumAreas.length) context.addIssue({ code: "custom", path: ["curriculumAreas"], message: "교육과정 영역을 선택해 주세요." });
  if (input.recordType === "알림장" && !input.teacherStyle) context.addIssue({ code: "custom", path: ["teacherStyle"], message: "교사의 알림장 기록 스타일을 선택해 주세요." });
  if (input.recordType === "알림장") {
    for (const key of ["classAnnouncement", "openingGreeting", "closingGreeting"] as const) {
      if (missingPlaceholders(input[key]).length) context.addIssue({ code: "custom", path: [key], message: "날짜·준비물 등의 자리표시자를 채워 주세요." });
    }
  }
});

export type RecordInput = z.infer<typeof recordInputSchema>;

export type GeneratedRecord = {
  originalPlayName?: string;
  playNameRecommendations?: { title: string; photoEvidence: string; observationEvidence: string; reason: string }[];
  playNameLearningTip?: string;
  observationRefinementRows?: {
    teacherInput: string;
    accurateObservation: string;
    firstImprovement: string;
  }[];
  curriculumLinks?: { area: string; description: string }[];
  observationEvaluation?: string;
  integratedRecord?: string;
  observation?: string;
  interpretation?: string;
  connection?: string;
  finalNotice?: string;
  recommendedEmojis?: string[];
};
