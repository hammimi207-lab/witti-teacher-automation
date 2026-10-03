import { requireAdmin } from "@/lib/admin-session";
import { allRows } from "@/lib/admin-data";
export async function GET(request: Request) {
  try { await requireAdmin(); } catch { return Response.json({}, { status: 401 }); }
  try {
    const period = new URL(request.url).searchParams.get("period") || "all";
    const tables = ["subscribers", "play_sessions", "photo_records", "generated_texts"] as const;
    const results = await Promise.all(tables.map(async table => {
      const rows = await allRows(table, period, false);
      const distribution: Record<string, number> = {};
      const key = table === "play_sessions" ? "record_type" : table === "generated_texts" ? "output_type" : "";
      if (key) for (const row of rows) { const label = String(row[key] || "미분류"); distribution[label] = (distribution[label] || 0) + 1; }
      return { table, count: rows.length, distribution };
    }));
    return Response.json(results, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "운영 현황을 조회하지 못했습니다." }, { status: 503 }); }
}
