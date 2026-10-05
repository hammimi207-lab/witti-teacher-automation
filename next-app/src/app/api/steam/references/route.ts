import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readReferences } from "@/features/steam/references";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("허용되지 않은 요청입니다.", 403);
  try {
    const { data, error } = await (await createClient()).auth.getUser();
    if (error || !data.user) return fail("로그인 후 참고문헌을 찾아 주세요.", 401);
    const raw = await request.text(); if (raw.length > 1024) return fail("놀이 검색어를 짧게 입력해 주세요.", 413);
    const parsed = z.object({ query: z.string().trim().min(3).max(150) }).safeParse(JSON.parse(raw));
    if (!parsed.success) return fail("놀이 검색어를 입력해 주세요.", 400);
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query.bibliographic", parsed.data.query); url.searchParams.set("rows", "40");
    const response = await fetch(url, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]), headers: { Accept: "application/json", "User-Agent": "GirokFairyV2/1.0 (play-references)" }, cache: "no-store" });
    if (!response.ok) return fail("학술 검색 서비스가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.", 503);
    const body = await response.json();
    if (!Array.isArray(body.message?.items)) return fail("학술 검색 결과를 확인하지 못했습니다.", 502);
    return Response.json({ references: readReferences(body.message.items, parsed.data.query), query: parsed.data.query, checkedAt: new Date().toISOString(), provider: "Crossref" }, { headers });
  } catch (error) {
    return fail(error instanceof SyntaxError ? "검색어 형식을 확인해 주세요." : "참고문헌을 불러오지 못했습니다. 기존 기록은 그대로 사용할 수 있습니다. 다시 시도해 주세요.", error instanceof SyntaxError ? 400 : 503);
  }
}
