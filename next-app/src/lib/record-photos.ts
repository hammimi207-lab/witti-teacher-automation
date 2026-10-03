import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const PHOTO_BUCKET = "play-photos";
export async function photoAccess() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return { userId: data.user.id, admin: createAdminClient() };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export function photoError(error: unknown) {
  const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
  return Response.json({ error: unauthorized ? "로그인 후 사진을 관리해 주세요." : "사진을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: unauthorized ? 401 : 500, headers: privateHeaders });
}
