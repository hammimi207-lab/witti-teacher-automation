import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginPolicy, preferenceHeader } from "@/lib/supabase/session-policy";

const schema = z.object({ identifier:z.string().trim().min(1).max(254), password:z.string().min(6).max(128), remember:z.boolean().default(false) });
const invalid = () => Response.json({ error:"아이디 또는 이메일과 비밀번호를 확인해 주세요." }, { status:401 });

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) return Response.json({ error:"Supabase 접속 정보가 아직 연결되지 않았습니다." },{ status:503 });
  try {
    const body = await request.json();
    const parsed = schema.safeParse({ ...body, identifier: body.identifier ?? body.email });
    if (!parsed.success) return invalid();
    const input = parsed.data;
    let email = input.identifier.toLowerCase();
    let expectedUserId: string | undefined;
    if (!email.includes("@")) {
      const admin = createAdminClient();
      // 기존 회원 ID도 지원하되 입력값을 필터 문자열에 보간하지 않습니다.
      const matches = await Promise.all(["username", "platform_member_id"].map(column =>
        admin.from("subscribers").select("user_id,email").eq(column, email).eq("deleted", false).limit(2)
      ));
      if (matches.some(result => result.error)) return Response.json({error:"회원 정보를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:503});
      const profiles = matches.flatMap(result => result.data || []);
      const ids = new Set(profiles.map(profile => profile.user_id));
      if (ids.size !== 1 || !profiles[0]?.user_id || !profiles[0]?.email) return invalid();
      email = profiles[0].email;
      expectedUserId = profiles[0].user_id;
    } else if (!z.string().email().safeParse(email).success) return invalid();
    const policy = loginPolicy(input.remember);
    const supabase = await createClient(policy);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (error) {
      console.error("Login authentication failed",error.code || "unknown");
      return invalid();
    }
    // 관리자에서 숨긴 회원은 이메일로도 로그인할 수 없습니다.
    if (data.user?.id) {
      const profile = await createAdminClient().from("subscribers").select("deleted,is_active").eq("user_id", data.user.id).limit(1);
      if (profile.error) {
        await supabase.auth.signOut({ scope: "local" });
        return Response.json({error:"회원 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:503});
      }
      if (profile.data?.some(row => row.deleted === true || row.is_active === false)) {
        await supabase.auth.signOut({ scope: "local" });
        return invalid();
      }
    }
    if (expectedUserId && data.user?.id !== expectedUserId) {
      await supabase.auth.signOut({ scope: "local" });
      return invalid();
    }
    return Response.json({ ok:true },{headers:{"Set-Cookie":preferenceHeader(policy),"Cache-Control":"no-store"}});
  } catch { return invalid(); }
}
