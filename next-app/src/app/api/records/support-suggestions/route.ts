import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { readAIConsent } from "@/features/records/ai-consent";
import { supportRequestSchema, supportResponseSchema, supportSuggestionPrompt, missingSupportContext, validateSupportReview, supportCurriculum } from "@/features/records/support-suggestions";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 30000) return Response.json({ error: "입력 내용이 너무 길어요." }, { status: 400 });
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "입력 형식을 확인해 주세요." }, { status: 400 }); }
    const parsed = supportRequestSchema.safeParse(body?.input);
    if (!parsed.success) return Response.json({ error: "연령·교육과정 영역·관찰·지원 계획을 먼저 작성해 주세요." }, { status: 400 });
    try { readAIConsent(body.consent, false); } catch { return Response.json({ error: "AI 활용 안내에 먼저 동의해 주세요." }, { status: 403 }); }
    const input = parsed.data;
    const clarification = missingSupportContext(input);
    if (clarification) return Response.json({ data: clarification, references: [] });
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "AI 연결을 확인해 주세요. 작성한 계획은 그대로 유지됩니다." }, { status: 503 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45000, maxRetries: 1 });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini", store: false,
      input: [{ role: "developer", content: supportSuggestionPrompt(input) }, { role: "user", content: JSON.stringify(input) }],
      text: { format: zodTextFormat(supportResponseSchema, "support_review") }, max_output_tokens: 2500,
    });
    if (!response.output_parsed) throw new Error("No review");
    return Response.json({ data: validateSupportReview(input, response.output_parsed), references: supportCurriculum(input.ageGroup, input.curriculumAreas) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "제안을 가져오지 못했어요. 작성한 계획은 그대로예요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
