import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { QUICK_MENU_IDS } from "@/features/home/quick-menu";
const headers = { "Cache-Control": "private, no-store" };
const schema = z.object({ slots: z.array(z.enum(QUICK_MENU_IDS).nullable()).length(4) }).strict().refine(
  value => new Set(value.slots.filter(Boolean)).size === value.slots.filter(Boolean).length);
export async function PATCH(request: Request) {
  const reply = (error: string, status: number) => Response.json({ error }, { status, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply("잘못된 요청입니다.", 403);
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return reply("로그인 후 퀵메뉴를 설정해 주세요.", 401);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return reply("중복 없이 네 칸의 기능을 선택해 주세요.", 400);
    const saved = await client.auth.updateUser({ data: { girok_quick_menu: parsed.data.slots } });
    if (saved.error) return reply("퀵메뉴를 저장하지 못했어요. 다시 시도해 주세요.", 503);
    return Response.json({ slots: parsed.data.slots }, { headers });
  } catch { return reply("퀵메뉴를 저장하지 못했어요. 다시 시도해 주세요.", 503); }
}
