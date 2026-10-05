import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "id" ? "id" : "password";
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const client = await createClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(`/account-recovery?mode=${mode}&verified=1`, url.origin));
    } catch { /* 재요청 안내로 이동 */ }
  }
  return NextResponse.redirect(new URL(`/account-recovery?mode=${mode}&error=1`, url.origin));
}
