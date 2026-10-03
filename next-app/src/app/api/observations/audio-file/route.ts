import { createClient } from "@/lib/supabase/server";
import { POST as transcribe } from "../transcribe/route";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "이 사이트에서 다시 요청해 주세요." }, { status: 403, headers });
  try {
    const { data, error } = await (await createClient()).auth.getUser();
    if (error || !data.user) return Response.json({ error: "녹음 파일 분석은 로그인 후 이용해 주세요." }, { status: 401, headers });
    if (Number(request.headers.get("content-length") || 0) > 4_064_000) return Response.json({ error: "녹음 파일은 4MB 이하로 선택해 주세요." }, { status: 413, headers });
    const form = await request.formData();
    if (form.get("consent") !== "accepted") return Response.json({ error: "음성 전사 전송을 확인해 주세요." }, { status: 403, headers });
    const forwarded = new Headers(request.headers); forwarded.delete("content-type"); forwarded.delete("content-length");
    return transcribe(new Request(request.url, { method: "POST", headers: forwarded, body: form, signal: request.signal }));
  } catch { return Response.json({ error: "녹음 파일을 분석하지 못했어요. 다시 시도해 주세요." }, { status: 503, headers }); }
}
