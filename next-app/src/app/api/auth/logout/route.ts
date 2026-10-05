import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    return Response.json({ success: true },{headers:{"Set-Cookie":"girok-login-until=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT","Cache-Control":"no-store"}});
  } catch {
    return Response.json({ error: "로그아웃하지 못했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}

