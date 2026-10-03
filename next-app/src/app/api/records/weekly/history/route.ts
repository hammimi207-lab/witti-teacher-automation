import { createClient } from "@/lib/supabase/server";
import { historyQuery, retainWeeklyRows, type WeeklySnapshot } from "@/lib/weekly-history";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return Response.json({ error: "로그인 후 확인해 주세요." }, { status: 401, headers });
    const response = await historyQuery(client, data.user.id);
    if (response.error) throw response.error;
    const { kept } = retainWeeklyRows(response.data || []);
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const row = kept.find(row => String(row.id) === id);
      if (!row) return Response.json({ error: "보관된 주간 이야기를 찾을 수 없어요." }, { status: 404, headers });
      return Response.json(JSON.parse(row.result_text || ""), { headers });
    }
    return Response.json({ stories: kept.map(row => {
      const snapshot: WeeklySnapshot = JSON.parse(row.result_text || "");
      return { id: String(row.id), monday: snapshot.range.monday, saturday: snapshot.range.saturday,
        count: snapshot.sources.length, savedAt: row.created_at };
    }) }, { headers });
  } catch { return Response.json({ error: "주간 이야기 보관함을 불러오지 못했어요." }, { status: 503, headers }); }
}
