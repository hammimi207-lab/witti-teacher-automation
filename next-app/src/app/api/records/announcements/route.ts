import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const table = "teacher_class_announcements";
const template = z.object({ title: z.string().trim().min(1).max(100).default("공지 양식"), category: z.string().trim().min(1).max(50).default("일반"), content: z.string().trim().min(1).max(3000) });
async function handle(request: Request) {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return Response.json({ error: "로그인 후 공지를 이용해 주세요." }, { status: 401 });
    if (request.method === "GET") {
      const result = await client.from(table).select("id,title,category,content,created_at").eq("user_id", data.user.id).order("created_at", { ascending: false });
      if (result.error) throw result.error;
      return Response.json({ announcements: result.data }, { headers: { "Cache-Control": "no-store" } });
    }
    const raw = await request.text();
    if (raw.length > 20000) return Response.json({ error: "공지 내용은 3,000자 이내로 적어 주세요." }, { status: 400 });
    const body = JSON.parse(raw);
    if (request.method === "POST" || request.method === "PATCH") {
      const parsed = (request.method === "PATCH" ? template.extend({ id: z.uuid() }) : template).safeParse(body);
      if (!parsed.success) return Response.json({ error: "공지 내용을 1~3,000자로 입력해 주세요." }, { status: 400 });
      const { title, category, content } = parsed.data;
      const query = request.method === "PATCH" && "id" in parsed.data
        ? client.from(table).update({ title, category, content }).eq("user_id", data.user.id).eq("id", parsed.data.id)
        : client.from(table).insert({ user_id: data.user.id, title, category, content });
      const result = await query.select("id,title,category,content,created_at").single();
      if (result.error) throw result.error;
      return Response.json({ announcement: result.data }, { status: request.method === "POST" ? 201 : 200 });
    }
    const parsed = z.object({ id: z.uuid() }).safeParse(body);
    if (!parsed.success) return Response.json({ error: "삭제할 공지를 확인해 주세요." }, { status: 400 });
    const result = await client.from(table).delete().eq("user_id", data.user.id).eq("id", parsed.data.id);
    if (result.error) throw result.error;
    return Response.json({ deleted: true });
  } catch (caught) {
    const code = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "";
    if (["PGRST205", "42P01", "42703", "PGRST204"].includes(code)) {
      return Response.json({ error: "공지 저장소 설정이 아직 완료되지 않았습니다. 관리자에게 공지 저장소 설정 확인을 요청해 주세요. 입력한 공지는 그대로 남아 있어요.", code: "ANNOUNCEMENTS_SETUP_REQUIRED" }, { status: 503 });
    }
    if (code === "42501") {
      return Response.json({ error: "공지 저장소의 접근 권한을 확인해야 합니다. 관리자에게 문의해 주세요. 입력한 공지는 그대로 남아 있어요.", code: "ANNOUNCEMENTS_PERMISSION_DENIED" }, { status: 503 });
    }
    if (caught instanceof SyntaxError) return Response.json({ error: "공지 요청 형식을 확인해 주세요." }, { status: 400 });
    return Response.json({ error: "공지 목록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const PATCH = handle;
