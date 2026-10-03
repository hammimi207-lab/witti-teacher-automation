import OpenAI from "openai";
import { saveWeeklyHistory } from "@/lib/weekly-history";
import { zodTextFormat } from "openai/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { readAIConsent } from "@/features/records/ai-consent";
import { weekRange, weeklySources, weeklyResultSchema, weeklyPrompt, validWeeklyReferences, type WeeklyRow } from "@/features/records/weekly-story";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };
async function load(day: string) {
  const range = weekRange(day);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: "로그인 후 주간 기록을 확인해 주세요.", status: 401 } as const;
  const rows: WeeklyRow[] = [];
  // Page through the entire week; do not silently analyze only the latest 100 records.
  for (let offset = 0; ; offset += 500) {
    const result = await supabase.from("generated_texts").select("id,session_id,created_at,result_text")
      .eq("user_id", data.user.id).eq("deleted", false).eq("output_type", "놀이 이야기")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .gte("created_at", range.start).lt("created_at", range.end)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 499);
    if (result.error) return { error: "저장된 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", status: 503 } as const;
    rows.push(...(result.data || []) as WeeklyRow[]);
    if ((result.data?.length || 0) < 500) break;
    if (rows.length >= 5000) return { error: "이 주의 기록이 너무 많아 한 번에 분석할 수 없어요.", status: 413 } as const;
  }
  const sources = weeklySources(rows);
  return { range, sources, excluded: rows.length - sources.length };
}
export async function GET(request: Request) {
  try {
    const data = await load(new URL(request.url).searchParams.get("day") || "");
    return Response.json(data, { status: "error" in data ? data.status : 200, headers });
  } catch { return Response.json({ error: "날짜와 로그인 상태를 확인해 주세요." }, { status: 400, headers }); }
}
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "요청 경로를 확인해 주세요." }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 2000) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413, headers });
    let body;
    try { body = JSON.parse(raw); weekRange(body.day); } catch { return Response.json({ error: "날짜를 확인해 주세요." }, { status: 400, headers }); }
    try { readAIConsent(body.consent, false); } catch { return Response.json({ error: "주간 분석 AI 활용 안내에 동의해 주세요." }, { status: 403, headers }); }
    const data = await load(body.day);
    if ("error" in data) return Response.json(data, { status: data.status, headers });
    if (!data.sources.length) return Response.json({ error: "이 주에 분석할 놀이 이야기 기록이 없어요." }, { status: 400, headers });
    const content = JSON.stringify(data.sources);
    if (data.sources.length > 150 || content.length > 120000) return Response.json({ error: "한 번에 분석할 수 있는 분량을 넘었어요. 기록은 누락 없이 유지됩니다. 주간 분석 분량 조정이 필요합니다." }, { status: 413, headers });
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "AI 연결 설정을 확인해 주세요." }, { status: 503, headers });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 100000, maxRetries: 0 });
    const response = await client.responses.parse({ model: process.env.OPENAI_MODEL || "gpt-5.4-mini", store: false,
      input: [{ role: "developer", content: weeklyPrompt }, { role: "user", content }],
      text: { format: zodTextFormat(weeklyResultSchema, "weekly_play_story") }, max_output_tokens: 14000 });
    const result = response.output_parsed;
    if (!result || !validWeeklyReferences(result, data.sources)) throw new Error("Invalid source references");
    try {
      const historyId = await saveWeeklyHistory({ ...data, result });
      return Response.json({ ...data, result, historyId }, { headers });
    } catch {
      return Response.json({ ...data, result, saveError: "분석은 완료했지만 보관함에 저장하지 못했어요. 이 화면을 닫기 전에 Word로 내려받아 주세요." }, { headers });
    }
  } catch { return Response.json({ error: "주간 분석을 완료하지 못했어요. 원래 기록은 그대로 보관되어 있습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers }); }
}
