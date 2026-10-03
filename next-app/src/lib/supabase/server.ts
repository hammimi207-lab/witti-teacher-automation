import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import { REMEMBER_COOKIE, sessionCookieOptions } from "./session-policy";

export async function createClient(loginPreference?: string) {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();
  const preference = loginPreference ?? cookieStore.get(REMEMBER_COOKIE)?.value;
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, sessionCookieOptions(options,preference))); }
        catch { /* Server Component에서는 proxy가 세션 쿠키를 갱신합니다. */ }
      },
    },
  });
}
