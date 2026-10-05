import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

const schema = z.object({ ids: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).min(1).max(100) });
export async function POST(request: Request) {
  if (!hasSupabaseConfig()) return Response.json({ error: "로그인 서비스 연결을 확인해 주세요." }, { status: 503 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return Response.json({ error: "로그인 후 삭제해 주세요." }, { status: 401 });
    const body = await request.text();
    if (body.length > 10000) return Response.json({ error: "선택한 기록 수를 확인해 주세요." }, { status: 400 });
    let raw: unknown;
    try { raw = JSON.parse(body); } catch { return Response.json({ error: "잘못된 요청입니다." }, { status: 400 }); }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return Response.json({ error: "삭제할 기록을 확인해 주세요." }, { status: 400 });
    // 소유자 조건과 RLS를 함께 적용하고, 영구 삭제 대신 기존 삭제 필드를 사용합니다.
    const deleted = await client.from("generated_texts").update({ deleted: true }).eq("user_id", data.user.id).eq("deleted", false).in("id", [...new Set(parsed.data.ids)]).select("id");
    if (deleted.error) return Response.json({ error: "삭제하지 못했습니다. 연결 상태와 수정 권한을 확인해 주세요." }, { status: 500 });
    return Response.json({ deletedIds: (deleted.data ?? []).map(row => row.id) });
  } catch { return Response.json({ error: "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 }); }
}
