import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ name: z.string().trim().min(1).max(100), institution: z.string().trim().max(200), position: z.string().trim().max(50), mailing: z.boolean() }).strict();
export async function PATCH(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "잘못된 요청입니다." }, { status: 403 });
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return Response.json({ error: "로그인 후 이용해 주세요." }, { status: 401 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "성명과 입력 내용의 길이를 확인해 주세요." }, { status: 400 });
    const input = parsed.data;
    const result = await createAdminClient().from("subscribers").update({ display_name: input.name, subscriber_name: input.name, institution_name: input.institution, position: input.position, mailing_agree: input.mailing ? "True" : "False" }).eq("user_id", data.user.id).eq("deleted", false).select("user_id");
    if (result.error || !result.data?.length) return Response.json({ error: "가입 정보를 저장하지 못했습니다. 다시 시도해 주세요." }, { status: 503 });
    return Response.json({ saved: true });
  } catch { return Response.json({ error: "가입 정보를 저장하지 못했습니다. 다시 시도해 주세요." }, { status: 503 }); }
}
