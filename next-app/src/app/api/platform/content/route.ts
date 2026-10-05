import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { visible, type ContentRecord } from "@/lib/platform-content";
import { signContent } from "@/lib/platform-content-server";
export async function GET() {
  try {
    const member = await createClient(); const { data: user } = await member.auth.getUser(); const db = createAdminClient();
    const [noticeResult, popupResult] = await Promise.all([
      db.from("platform_notices").select("id,title,is_active,deleted,display_start_at,display_end_at").eq("deleted", false).eq("is_active", true).eq("is_pinned", true).order("id", { ascending: false }),
      db.from("platform_popups").select("id,is_active,deleted,display_start_at,display_end_at,audience,priority,popup_position,link_url,image_bucket,image_path,image_alt_text").eq("deleted", false).eq("is_active", true).order("priority", { ascending: true }).order("id", { ascending: true }),
    ]);
    if (noticeResult.error || popupResult.error) throw new Error();
    const popups = ((popupResult.data || []) as ContentRecord[]).filter(row => visible(row) && (row.audience !== "member" || user.user)).slice(0, 3);
    const signed = await Promise.all(popups.map(signContent));
    return Response.json({ notices: ((noticeResult.data || []) as ContentRecord[]).filter(row => visible(row)).map(row => ({ id: row.id, title: row.title })), popups: signed.map(row => ({ id: row.id, url: row.url, image_alt_text: row.image_alt_text, link_url: row.link_url, popup_position: row.popup_position })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ notices: [], popups: [] }, { status: 503 }); }
}
