import { z } from "zod";
import { recordInputSchema, type RecordInput } from "./schema";
import { seoulToday } from "./notice-workflow";

export const writingFormSchema = recordInputSchema.extend({
  playName: z.string().max(100), childAlias: z.string().max(50),
  ageGroup: z.union([recordInputSchema.shape.ageGroup, z.literal("")]),
  recordType: z.union([recordInputSchema.shape.recordType, z.literal("")]),
  parentType: z.union([recordInputSchema.shape.parentType.removeDefault(), z.literal("")]),
  teacherStyle: z.union([recordInputSchema.shape.teacherStyle.unwrap(), z.literal("")]),
  curriculumAreas: z.array(z.string()), observation: z.string().max(25000),
});
export type WritingForm = z.infer<typeof writingFormSchema>;
export const emptyWritingForm: WritingForm = {
  playName: "", childAlias: "", ageGroup: "", recordType: "", parentType: "", teacherStyle: "",
  curriculumAreas: [], observation: "", playSubcategories: [], playSubcategoryNotes: {},
  teacherSupports: [], teacherSupportNotes: {}, teacherInterpretation: "", centerSupport: "",
  homeConnection: "", mealObservation: "", toiletingObservation: "", peerInteraction: "",
  activityLearning: "", classAnnouncement: "", supportPlan: "", noticeMode: "detailed", commonActivity: "",
  writingDate: seoulToday(), dailyObservation: "", playObservation: "", activityObservation: "",
  inheritedObservation: "",
  openingGreeting: "", closingGreeting: "", openingKind: "none", closingKind: "none",
};
export function nextChild(current: WritingForm): WritingForm {
  return { ...structuredClone(emptyWritingForm), recordType: current.recordType, ageGroup: current.ageGroup,
    noticeMode: "detailed", commonActivity: current.commonActivity, writingDate: current.writingDate,
    classAnnouncement: current.classAnnouncement, openingGreeting: current.openingGreeting,
    closingGreeting: current.closingGreeting, openingKind: current.openingKind, closingKind: current.closingKind };
}
export function hasPersonalWriting(input: WritingForm) {
  return [input.observation, input.dailyObservation, input.playObservation, input.activityObservation,
    input.inheritedObservation, input.teacherInterpretation, input.centerSupport, input.mealObservation,
    input.toiletingObservation, input.peerInteraction, input.activityLearning, input.homeConnection, input.supportPlan,
    ...Object.values(input.playSubcategoryNotes), ...Object.values(input.teacherSupportNotes)].some(value => value.trim());
}
export function noticeFromWriting(current: WritingForm): WritingForm {
  return { ...nextChild(current), recordType: "알림장", childAlias: current.childAlias,
    playName: current.playName, playObservation: combinedObservation(current),
    dailyObservation: current.dailyObservation || [current.mealObservation, current.toiletingObservation].filter(Boolean).join("\n\n"),
    activityObservation: current.activityObservation || current.activityLearning,
    teacherInterpretation: current.teacherInterpretation, centerSupport: current.centerSupport,
    homeConnection: current.homeConnection };
}
export function combinedObservation(input: Pick<RecordInput, "observation" | "playSubcategories" | "playSubcategoryNotes"> & Partial<Pick<RecordInput, "dailyObservation" | "playObservation" | "activityObservation" | "commonActivity">> & { recordType?: RecordInput["recordType"] | "" }) {
  if (input.recordType === "알림장") {
    return [...new Set([input.dailyObservation, input.playObservation, input.activityObservation, input.observation, input.commonActivity].map(value => value?.trim()).filter(Boolean))].join("\n\n");
  }
  return [...new Set([input.observation, ...input.playSubcategories.map(key => input.playSubcategoryNotes[key] || "")].map(value => value.trim()).filter(Boolean))].join("\n\n");
}
export function prepareWriting(input: WritingForm): RecordInput {
  return { ...input, playName: input.recordType === "알림장" ? input.playName.trim() || "알림장" : input.playName,
    writingDate: input.writingDate || seoulToday(), observation: combinedObservation(input), parentType: input.parentType || "일반형",
    inheritedObservation: input.recordType === "알림장" ? input.observation : input.inheritedObservation,
    noticeMode: "detailed",
    openingGreeting: input.openingKind === "none" ? "" : input.openingGreeting,
    closingGreeting: input.closingKind === "none" ? "" : input.closingGreeting,
    teacherStyle: input.teacherStyle || undefined, ageGroup: input.ageGroup as RecordInput["ageGroup"], recordType: input.recordType as RecordInput["recordType"] };
}
