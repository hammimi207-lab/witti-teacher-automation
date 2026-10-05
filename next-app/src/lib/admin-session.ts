import "server-only";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "witti-admin";
export const ADMIN_TTL = 60 * 60 * 4;
export function adminCredentials() {
  return { id: process.env.ADMIN_ID || process.env.id || "", password: process.env.ADMIN_PASSWORD || process.env.password || "" };
}
function signature(value: string) {
  const { id, password } = adminCredentials();
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role_key;
  if (!id || !password || !secret) throw new Error("관리자 서버 설정을 확인해 주세요.");
  return createHmac("sha256", secret).update(`admin-session-v1|${id}|${password}|${value}`).digest("hex");
}
export function equalSecret(a: string, b: string) {
  const digest = (s: string) => createHmac("sha256", "witti-comparison").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}
export function issueAdminToken() {
  const payload = `${Date.now() + ADMIN_TTL * 1000}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}
export function verifyAdminToken(token: string) {
  try {
    const [expires, nonce, mac, extra] = token.split(".");
    if (extra || !/^\d{13}$/.test(expires) || !/^[a-f0-9]{48}$/.test(nonce) || !mac || Number(expires) <= Date.now()) return false;
    return equalSecret(mac, signature(`${expires}.${nonce}`));
  } catch { return false; }
}
export async function isAdmin() { return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value || ""); }
export async function requireAdmin() { if (!await isAdmin()) throw new Error("관리자 로그인이 필요합니다."); }
export function sameOrigin(request: Request) { return request.headers.get("origin") === new URL(request.url).origin; }
