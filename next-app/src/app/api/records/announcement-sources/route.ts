import { createClient } from "@/lib/supabase/server";
import { announcementTemplate, reusableAnnouncement } from "@/features/records/notice-workflow";

export async function GET() {
  try {
    const client = await createClient();
    const { data: auth, error } = await client.auth.getUser();
    if (error || !auth.user) return Response.json({ error: "로그인 후 검색해 주세요." }, { status: 401 });
    const result = await client.from("generated_texts").select("id,result_text,created_at").eq("user_id", auth.user.id).eq("deleted", false).eq("output_type", "알림장").order("created_at", { ascending: false }).limit(100);
    if (result.error) throw result.error;
    const items: { id: string; title: string; category: string; content: string; created_at: string }[] = [];
    const seen = new Set<string>();
    for (const row of result.data || []) {
      try {
        const saved = JSON.parse(row.result_text || "");
        const raw = typeof saved?.input?.classAnnouncement === "string" ? saved.input.classAnnouncement : "";
        if (!raw.trim()) continue;
        const content = announcementTemplate(reusableAnnouncement(raw, typeof saved.input.childAlias === "string" ? saved.input.childAlias : ""));
        if (seen.has(content)) continue;
        seen.add(content);
        items.push({ id: `record-${row.id}`, title: `기존 공지: ${content.split("\n")[0].slice(0, 30)}`, category: "기존 기록", content: content.slice(0, 3000), created_at: row.created_at || "" });
      } catch { /* Text-only legacy records have no reliably separable announcement. */ }
    }
    return Response.json({ announcements: items, scope: "본인의 최근 알림장 100건에서 별도로 저장된 공지를 검색합니다. 학습 업로드 원문 검색 저장소는 연결되어 있지 않습니다." }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "기존 알림장을 검색하지 못했어요. 직접 작성하거나 등록한 양식을 사용해 주세요." }, { status: 503 }); }
}
