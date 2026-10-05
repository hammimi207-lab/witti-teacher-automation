import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { steamPhotoBlobs } from "@/lib/steam-photos";
import { readAIConsent } from "@/features/records/ai-consent";
import { steamInputSchema, steamSingleAnalysisSchema, steamGroupedAnalysisSchema, verifySteamAnalysis, groupSteamAnalysis, photoObservationText } from "@/features/records/steam-schema";
import { STEAM_PROMPT, STEAM_PROMPT_VERSION, STEAM_SCHEMA_VERSION } from "@/features/steam/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const reply = (error: string, status: number) => Response.json({ error }, { status, headers });
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("허용되지 않은 요청입니다.", 403);
  try {
    const { data, error } = await (await createClient()).auth.getUser();
    if (error || !data.user) return reply("로그인 후 분석해 주세요.", 401);
    if (Number(request.headers.get("content-length") || 0) > 4000000) return reply("사진 용량을 줄여 주세요.", 413);
    const form = await request.formData();
    const raw = String(form.get("input") || "");
    if (raw.length > 60000) return reply("관찰 내용이 너무 깁니다.", 413);
    const parsed = steamInputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return reply("연령과 관찰 내용을 확인해 주세요.", 400);
    const input = parsed.data;
    const entries = form.getAll("images");
    const files = entries.filter((item): item is File => item instanceof File);
    const count = input.photoIds.length + files.length;
    if (input.photoObservations && (input.photoObservations.length !== count || new Set(input.photoObservations.map(note => note.photo)).size !== count || input.photoObservations.some(note => note.photo > count))) return reply("각 사진의 관찰 연결을 확인해 주세요.", 400);
    if (count < 1 || count > 5 || files.length !== entries.length || files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 600000)) return reply("사진 1~5장을 선택해 주세요. 새 사진은 600KB 이하 JPG·PNG·WEBP만 사용할 수 있습니다.", 400);
    try { readAIConsent(JSON.parse(String(form.get("consent") || "null")), true); }
    catch { return reply("AI 및 사진 활용 동의가 필요합니다.", 403); }
    const saved = await steamPhotoBlobs(data.user.id, input.photoIds);
    if (!process.env.OPENAI_API_KEY) return reply("서버 AI 연결이 필요합니다. 입력은 유지됩니다.", 503);
    const prepared = await Promise.all([...saved, ...files].map(async file => {
      const bytes = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 20000000 }).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      return { hash: createHash("sha256").update(bytes).digest("hex"), image: { type: "input_image" as const, image_url: `data:image/jpeg;base64,${bytes.toString("base64")}`, detail: "auto" as const } };
    }));
    const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
    const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45000, maxRetries: 0 });
    const response = await ai.responses.parse({ model, store: false,
      input: [{ role: "developer", content: STEAM_PROMPT + (!input.photoObservations ? "\n기존 호환 요청에서는 plays 없이 한 분석 객체로 응답한다." : "") }, { role: "user", content: [{ type: "input_text", text: JSON.stringify({ age: `만 ${input.age}`, observation: input.photoObservations ? undefined : input.observation, photoObservations: input.photoObservations?.map(note => ({ ...note, observation: photoObservationText(note) })), photoCount: count, photoOrder: "저장 사진 선택 순서, 이어서 새 사진 순서. 각 사진은 서로 다른 놀이." }) }, ...prepared.map(photo => photo.image)] }],
      text: { format: zodTextFormat(input.photoObservations ? steamGroupedAnalysisSchema : steamSingleAnalysisSchema, "steam_analysis") }, max_output_tokens: 12000,
    }, { signal: request.signal });
    if (!response.output_parsed) return reply("분석 결과가 비어 있습니다. 다시 시도해 주세요.", 502);
    const grouped = input.photoObservations ? groupSteamAnalysis(steamGroupedAnalysisSchema.parse(response.output_parsed), input.photoObservations, count) : null;
    const verified = grouped || verifySteamAnalysis(steamSingleAnalysisSchema.parse(response.output_parsed), input.observation, count);
    const photoHashes = prepared.map(photo => photo.hash);
    const run = { runId: randomUUID(), model, promptVersion: STEAM_PROMPT_VERSION, schemaVersion: STEAM_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(), inputHash: createHash("sha256").update(JSON.stringify({ age: input.age, observation: input.observation, photoObservations: input.photoObservations, photoHashes })).digest("hex"),
      photoHashes, originalAnalysis: grouped?.originalAnalysis || response.output_parsed, checks: verified.checks };
    return Response.json({ analysis: verified.analysis, analyzedInput: input, run }, { headers });
  } catch (caught) {
    if (caught instanceof Error && caught.message === "INVALID_PHOTOS") return reply("선택 사진이 삭제되었거나 접근할 수 없습니다.", 404);
    if (caught instanceof SyntaxError) return reply("입력 형식을 확인해 주세요.", 400);
    return reply("분석하지 못했습니다. 입력과 수정 내용은 유지됩니다. 사진과 연결 상태를 확인하고 다시 시도해 주세요.", 502);
  }
}
