import { NextResponse } from "next/server";
import { adminCredentials, equalSecret, issueAdminToken, ADMIN_COOKIE, ADMIN_TTL, sameOrigin } from "@/lib/admin-session";
// 한 프로세스에서 반복된 관리자 암호 추측을 제한합니다. 배포 시 프록시에서도 제한하세요.
const attempts: number[] = [];
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 403 });
  const now = Date.now();
  while (attempts.length && attempts[0] < now - 60000) attempts.shift();
  if (attempts.length >= 5) return NextResponse.json({ error: "로그인 시도가 많습니다. 1분 뒤 다시 시도해 주세요." }, { status: 429 });
  attempts.push(now);
  const body = await request.json().catch(() => ({}));
  const credentials = adminCredentials();
  if (!credentials.id || !credentials.password) return NextResponse.json({ error: "관리자 계정 설정을 확인해 주세요." }, { status: 503 });
  if (typeof body.id !== "string" || typeof body.password !== "string" || body.id.length > 200 || body.password.length > 500 || !equalSecret(body.id.trim(), credentials.id) || !equalSecret(body.password, credentials.password)) return NextResponse.json({ error: "관리자 아이디 또는 비밀번호를 확인해 주세요." }, { status: 401 });
  try {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, issueAdminToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: ADMIN_TTL });
    return response;
  } catch { return NextResponse.json({ error: "관리자 서버 설정을 확인해 주세요." }, { status: 503 }); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
