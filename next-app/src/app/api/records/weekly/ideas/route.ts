import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { loadSupportSources } from "@/lib/weekly-support-records";
import { readAIConsent } from "@/features/records/ai-consent";
import { ideaRequestSchema, ideasSchema, ideasPrompt, validIdeas } from "@/features/records/weekly-support";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "요청 경로를 확인해 주세요." }, { status: 403, headers });
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return Response.json({ error: "로그인 후 이용해 주세요." }, { status: 401, headers });
    const raw = await request.text();
    if (raw.length > 18000) return Response.json({ error: "입력이 너무 길어요." }, { status: 413, headers });
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "입력을 확인해 주세요." }, { status: 400, headers }); }
    const parsed = ideaRequestSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "놀이와 확장 방향을 선택해 주세요." }, { status: 400, headers });
    try { readAIConsent(body.consent, false); } catch { return Response.json({ error: "아이디어 생성을 위한 AI 활용에 동의해 주세요." }, { status: 403, headers }); }
    const sources = await loadSupportSources(supabase, data.user.id, parsed.data.day, parsed.data.sourceIds);
    const content = JSON.stringify({ ...parsed.data, sources });
    if (content.length > 120000) return Response.json({ error: "관찰 분량이 너무 많아요. 더 작은 놀이 묶음을 선택해 주세요." }, { status: 413, headers });
    if (!process.env.OPENAI_API_KEY) throw new Error("AI unavailable");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45000, maxRetries: 0 });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await client.responses.parse({ model: process.env.OPENAI_MODEL || "gpt-5.4-mini", store: false,
        input: [{ role: "developer", content: ideasPrompt + (attempt ? "\n이전 응답은 근거 원문 검증에 실패했습니다. evidence.quote의 조사·어미·문장부호를 바꾸지 말고 관찰 원문에서 짧은 구절을 그대로 복사하세요." : "") }, { role: "user", content }], text: { format: zodTextFormat(ideasSchema, "weekly_support_ideas") }, max_output_tokens: 7000 });
      if (response.output_parsed && validIdeas(response.output_parsed.ideas, sources)) return Response.json(response.output_parsed, { headers });
    }
    throw new Error("Invalid evidence");
  } catch { return Response.json({ error: "관찰에 근거한 아이디어를 가져오지 못했어요. 원본 기록이 변경되었다면 주간 분석을 다시 실행해 주세요." }, { status: 503, headers }); }
}
