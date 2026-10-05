import { requireAdmin, sameOrigin } from "@/lib/admin-session";
import { allRows, csv, readRows, validTable, mutateRecords } from "@/lib/admin-data";
import { z } from "zod";
import { displayExport } from "@/features/admin/display-data";
export async function GET(request: Request) {
  try { await requireAdmin(); } catch { return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 }); }
  const params = new URL(request.url).searchParams;
  const table = params.get("table") || "subscribers";
  if (!validTable(table)) return Response.json({ error: "지원하지 않는 데이터입니다." }, { status: 400 });
  const period = params.get("period") || "all";
  const hidden = params.get("hidden") === "true";
  try {
    if (params.get("format") === "csv") return new Response(csv(displayExport(table, await allRows(table, period, hidden))), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${table}.csv"`, "Cache-Control": "no-store" } });
    const page = Math.max(0, Math.min(100000, Number(params.get("page")) || 0));
    return Response.json(await readRows(table, period, hidden, Math.floor(page)), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "데이터를 조회하지 못했습니다. 연결과 테이블 설정을 확인해 주세요." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 }); }
  if (!sameOrigin(request)) return Response.json({}, { status: 403 });
  const parsed = z.object({ table: z.string(), ids: z.array(z.number().int().positive()).max(100), action: z.enum(["hide", "restore", "delete"]), confirm: z.string().optional(), restoreAll: z.boolean().optional(), period: z.enum(["all", "today", "week", "month"]).optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || !validTable(parsed.data.table) || (parsed.data.action === "delete" && parsed.data.confirm !== "영구삭제")) return Response.json({ error: "선택 항목과 확인 문구를 확인해 주세요." }, { status: 400 });
  if (parsed.data.restoreAll) {
    if (parsed.data.action !== "restore" || parsed.data.confirm !== "전체복구") return Response.json({}, { status: 400 });
    try {
      const rows = await allRows(parsed.data.table, parsed.data.period || "all", true);
      let count = 0;
      for (let i = 0; i < rows.length; i += 100) count += await mutateRecords(parsed.data.table, rows.slice(i, i + 100).map(row => row.id), "restore");
      return Response.json({ count });
    } catch { return Response.json({ error: "일부 복구가 완료되지 않았습니다. 남은 숨김 기록을 확인해 주세요." }, { status: 503 }); }
  }
  if (!parsed.data.ids.length) return Response.json({}, { status: 400 });
  try { return Response.json({ count: await mutateRecords(parsed.data.table, [...new Set(parsed.data.ids)], parsed.data.action) }); }
  catch { return Response.json({ error: "일부 처리가 완료되지 않았습니다. 새로 조회한 뒤 남은 항목을 확인해 주세요." }, { status: 503 }); }
}
