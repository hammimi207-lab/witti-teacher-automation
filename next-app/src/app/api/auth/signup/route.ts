import { randomInt, createHmac } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendVerificationMail } from "@/lib/verification-mail";

export const runtime = "nodejs";
const emailSchema = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), email: emailSchema }),
  z.object({ action: z.literal("signup"), email: emailSchema, code: z.string().regex(/^\d{6}$/), name: z.string().trim().min(1).max(100), username: z.string().regex(/^[a-z0-9_]{4,20}$/), password: z.string().min(8).max(128), privacy: z.literal(true), mailing: z.boolean(), institution: z.string().max(200), position: z.string().max(50) }),
]);
function hash(email: string, code: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role_key;
  if (!secret) throw new Error("Missing server configuration");
  return createHmac("sha256", secret).update(`witti-signup|${email}|${code}`).digest("hex");
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "잘못된 요청입니다." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "입력 내용과 필수 동의를 확인해 주세요." }, { status: 400 });
  const input = parsed.data;
  try {
    const db = createAdminClient();
    const now = new Date();
    const { data: rows, error } = await db.from("email_verifications").select("id,code_hash,expires_at,attempts,verified,created_at").eq("email", input.email).eq("purpose", "signup").order("created_at", { ascending: false }).limit(1);
    if (error) throw error;
    const row = rows?.[0];
    if (input.action === "send") {
      if (row && now.getTime() - Date.parse(row.created_at) < 60000) return Response.json({ error: "인증번호 재발송은 1분 후에 가능합니다." }, { status: 429 });
      const code = String(randomInt(1000000)).padStart(6, "0");
      const { data: issued, error: insertError } = await db.from("email_verifications").insert({ email: input.email, purpose: "signup", code_hash: hash(input.email, code), expires_at: new Date(now.getTime() + 300000).toISOString(), attempts: 0, verified: false }).select("id").single();
      if (insertError) throw insertError;
      try { await sendVerificationMail(input.email, code, "signup"); }
      catch (e) { await db.from("email_verifications").update({ expires_at: now.toISOString() }).eq("id", issued.id); throw e; }
      return Response.json({ message: "인증번호를 발송했습니다. 5분 안에 입력하고 회원가입을 완료해 주세요." });
    }
    if (!row || row.verified || Date.parse(row.expires_at) <= now.getTime() || row.attempts >= 5) return Response.json({ error: "인증번호가 만료되었거나 사용되었습니다. 새 인증번호를 받아 주세요." }, { status: 400 });
    // Compare-and-set reserves each attempt, including successful redemption.
    const correct = row.code_hash === hash(input.email, input.code);
    const { data: claimed, error: claimError } = await db.from("email_verifications").update({ attempts: row.attempts + 1, verified: correct }).eq("id", row.id).eq("attempts", row.attempts).eq("verified", false).gt("expires_at", new Date().toISOString()).select("id");
    if (claimError) throw claimError;
    if (!claimed?.length || !correct) return Response.json({ error: "인증번호가 일치하지 않거나 이미 처리되었습니다. 다시 확인해 주세요." }, { status: 400 });
    const { data: existing, error: lookupError } = await db.from("subscribers").select("user_id").eq("username", input.username).limit(1);
    if (lookupError) throw lookupError;
    if (existing?.length) return Response.json({ error: "이미 사용 중인 아이디입니다. 아이디를 변경한 뒤 새 인증번호를 받아 주세요." }, { status: 409 });
    const { data: account, error: authError } = await db.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { username: input.username, member_name: input.name } });
    if (authError || !account.user) return Response.json({ error: "회원가입을 완료하지 못했습니다. 이미 가입한 이메일인지 확인한 뒤 다시 인증해 주세요." }, { status: 400 });
    const { error: profileError } = await db.from("subscribers").insert({ user_id: account.user.id, platform_member_id: input.username, username: input.username, display_name: input.name, subscriber_name: input.name, role: "teacher", email: input.email, institution_name: input.institution, position: input.position, privacy_agree: "True", mailing_agree: input.mailing ? "True" : "False", is_active: true, deleted: false, member_created_at: now.toISOString(), last_login_at: now.toISOString() });
    if (profileError) { await db.auth.admin.deleteUser(account.user.id); throw profileError; }
    return Response.json({ message: "이메일 인증과 회원가입이 완료되었습니다. 로그인해 주세요.", complete: true });
  } catch {
    return Response.json({ error: "인증 또는 회원가입 처리에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
