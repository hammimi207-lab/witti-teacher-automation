import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // 기존 Streamlit Secrets에서 옮긴 이름도 서버에서만 지원합니다.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role_key;
  if (!url || !key) throw new Error("회원가입 서버 설정을 확인해 주세요.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
