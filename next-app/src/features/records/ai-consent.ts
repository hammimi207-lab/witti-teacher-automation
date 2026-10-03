import { z } from "zod";

export const AI_CONSENT_VERSION = "2026-09-19";
export const AI_CONSENT_TEXT = "입력한 관찰 내용과 선택한 사진이 OpenAI에 전달되어 AI 기록 작성에 사용됨을 확인했습니다. 아이의 실명·연락처 등 불필요한 개인정보를 입력하지 않고, AI가 만든 내용은 실제 관찰과 비교하여 교사가 검토·수정하겠습니다.";
export const PHOTO_CONSENT_TEXT = "사진 속 아동의 보호자 동의와 기관의 사진 활용 지침을 확인했습니다. 종합 기록을 저장하면 사진의 크기를 줄인 사본이 비공개로 보관되며, 내 기록의 내 사진 관리에서 직접 삭제할 수 있음을 확인했습니다.";
export const aiConsentSchema = z.object({ version: z.literal(AI_CONSENT_VERSION), aiAccepted: z.literal(true), photoAccepted: z.boolean() });
export type AIConsent = z.infer<typeof aiConsentSchema>;
export function readAIConsent(value: unknown, hasPhotos: boolean): AIConsent {
  const parsed = aiConsentSchema.safeParse(value);
  if (!parsed.success || (hasPhotos && !parsed.data.photoAccepted)) throw new Error("AI 활용 및 사진 활용 확인란에 동의해 주세요.");
  return parsed.data;
}
