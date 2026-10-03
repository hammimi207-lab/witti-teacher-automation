export const REMEMBER_COOKIE = "girok-login-until";
export const REMEMBER_SECONDS = 30 * 86400;
export function loginPolicy(remember: boolean) { return remember ? String(Date.now() + REMEMBER_SECONDS * 1000) : "session"; }
export function sessionCookieOptions<T extends {maxAge?: number; expires?: Date}>(options: T, policy?: string): T {
  if(options.maxAge === 0) return options;
  const result = {...options};
  delete result.maxAge; delete result.expires;
  const deadline = Number(policy);
  if(policy && Number.isFinite(deadline) && deadline > Date.now()) {
    result.maxAge = Math.min(REMEMBER_SECONDS,Math.floor((deadline-Date.now())/1000));
    result.expires = new Date(Date.now()+result.maxAge*1000);
  }
  return result;
}
export function preferenceHeader(policy: string) {
  const persistent = policy !== "session";
  return `${REMEMBER_COOKIE}=${policy}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}${persistent ? `; Max-Age=${REMEMBER_SECONDS}` : ""}`;
}
