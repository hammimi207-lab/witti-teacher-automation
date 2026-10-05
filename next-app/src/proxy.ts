import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { restoreConsent } from "@/lib/consent-access";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Authenticated users can inspect/delete their own data even after trial consent expires.
  // The page and photo handlers independently verify login and ownership.
  if (path === "/mypage" || path === "/api/account/profile" || path === "/records/photos" || path === "/api/photos" || path.startsWith("/api/photos/")) return updateSession(request);
  if (path === "/api/consent" || path === "/login" || path === "/account-recovery" || path === "/auth/recovery-callback" || path === "/api/auth/recovery" || path === "/api/auth/find-id" || path === "/api/auth/status" || path === "/api/auth/login" || path === "/api/auth/logout" || path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/") || path === "/api/cron/consents") return updateSession(request);
  const state = NextResponse.next();
  let accepted = false;
  try { accepted = await restoreConsent(request,state); } catch { return new NextResponse("동의 기록을 확인하지 못했습니다. 잠시 후 새로고침해 주세요.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}}); }
  function withCookies(response:NextResponse) { state.cookies.getAll().forEach(cookie=>response.cookies.set(cookie));response.headers.set("Cache-Control","private, no-store");return response; }
  if(path === "/confidentiality") return withCookies(accepted ? NextResponse.redirect(new URL("/",request.url)) : NextResponse.next({request}));
  if (!accepted) {
    if(path.startsWith("/api/")) return NextResponse.json({error:"비밀유지 동의가 필요합니다."},{status:403,headers:{"Cache-Control":"no-store"}});
    return withCookies(NextResponse.redirect(new URL(path === "/records/new" && request.nextUrl.searchParams.get("guest") === "1" ? "/confidentiality?check=required&next=guest" : "/confidentiality?check=required",request.url)));
  }
  const response = await updateSession(request);
  response.headers.set("Cache-Control","private, no-store");
  return withCookies(response);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
