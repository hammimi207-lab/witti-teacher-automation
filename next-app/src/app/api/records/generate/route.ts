import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { randomUUID } from "node:crypto";
import { generatedSchema } from "@/features/records/result-schema";
import { buildRecordPrompt } from "@/features/records/prompt";
import { presentGeneratedRecord } from "@/features/records/result-presentation";
import { generationInputSchema } from "@/features/records/schema";


import { readAIConsent } from "@/features/records/ai-consent";
import sharp from "sharp";
import { assembleNotice } from "@/features/records/notice-workflow";

export const runtime = "nodejs";



export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const rawInput = JSON.parse(String(form.get("input") ?? "{}"));
    const input = generationInputSchema.parse(rawInput);
    const images = form.getAll("images").filter((value): value is File => value instanceof File);
    try { readAIConsent(JSON.parse(String(form.get("consent") || "null")), images.length > 0); }
    catch { return Response.json({ error: "AI 활용 및 사진 활용 확인란에 동의해 주세요." }, { status: 403 }); }
    if (images.length > 5) return Response.json({ error: "AI 분석 사진은 최대 5장입니다." }, { status: 400 });
    const imageContent = await Promise.all(images.map(async (file) => {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("사진은 JPG, PNG, WEBP 형식의 10MB 이하 파일만 사용할 수 있습니다.");
      const bytes = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 20000000 }).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      const base64 = bytes.toString("base64");
      return { type: "input_image" as const, image_url: `data:image/jpeg;base64,${base64}`, detail: "low" as const };
    }));
    if (!process.env.OPENAI_API_KEY) return Response.json({ error: "서버에 OpenAI API 키가 연결되지 않았습니다." }, { status: 503 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      store: false,
      input: [{ role: "user", content: [{ type: "input_text", text: buildRecordPrompt(input) }, ...imageContent] }],
      text: { format: zodTextFormat(generatedSchema.extend({ observationRefinementRows: generatedSchema.shape.observationRefinementRows.removeDefault().min(1) }), "teacher_record") },
      // Keep room for detailed observations as well as the parent-facing text.
      max_output_tokens: 16000,
    });
    if (!response.output_parsed) throw new Error("기록 결과를 해석하지 못했습니다.");
    const result = { ...presentGeneratedRecord(response.output_parsed), originalPlayName: input.playName };
    if (input.recordType === "알림장") result.finalNotice = assembleNotice(result.finalNotice || "", input);
    return Response.json({ data: result, saved: false, generationId: randomUUID() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "기록 생성 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 400 });
  }
}
