import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("send"), email: z.string().email(), mode: z.enum(["id", "password"]) }), z.object({ action: z.literal("update"), password: z.string().min(8).max(128) })]);
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: "입력 내용을 확인해 주세요." }, { status: 400 });
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) return Response.json({ error: "이메일 또는 비밀번호 형식을 확인해 주세요. 비밀번호는 8자 이상입니다." }, { status: 400 });
    const client = await createClient();
    if (parsed.data.action === "send") {
      // 공유 Supabase 프로젝트의 다른 서비스 발신자/템플릿을 사용하지 않습니다.
      return Response.json({ error: "기록요정 전용 인증 메일 연결을 준비 중입니다. 현재 인증 메일을 발송할 수 없습니다." }, { status: 503 });
    }
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user) return Response.json({ error: "이메일 인증을 다시 진행해 주세요." }, { status: 401 });
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) return Response.json({ error: "비밀번호를 변경하지 못했습니다. 새 비밀번호 정책 또는 인증 유효기간을 확인해 주세요." }, { status: 400 });
    await client.auth.signOut({ scope: "local" });
    return Response.json({ message: "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요." });
  } catch { return Response.json({ error: "요청을 처리하지 못했습니다. 다시 시도해 주세요." }, { status: 400 }); }
}
