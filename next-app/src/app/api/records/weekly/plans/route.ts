import { createClient } from "@/lib/supabase/server";
import { loadSupportSources } from "@/lib/weekly-support-records";
import { SUPPORT_PLAN_TYPE, planSchema, savePlanSchema, reviewPlanSchema } from "@/features/records/weekly-support";
import { weekRange } from "@/features/records/weekly-story";

const headers = { "Cache-Control": "private, no-store" };
async function handle(request: Request) {
  if (request.method !== "GET" && request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "요청 경로를 확인해 주세요." }, { status: 403, headers });
  try {
    const supabase = await createClient();
    const { data: auth, error } = await supabase.auth.getUser();
    if (error || !auth.user) return Response.json({ error: "로그인 후 계획을 확인해 주세요." }, { status: 401, headers });
    const userId = auth.user.id;
    const owned = () => supabase.from("generated_texts").select("id,result_text,session_id").eq("user_id", userId).eq("output_type", SUPPORT_PLAN_TYPE).eq("deleted", false).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    if (request.method === "GET") {
      const response = await owned().order("created_at", { ascending: false }).limit(100);
      if (response.error) throw response.error;
      const plans = (response.data || []).flatMap(row => { try { const parsed = planSchema.safeParse(JSON.parse(row.result_text || "")); return parsed.success ? [{ ...parsed.data, id: row.id }] : []; } catch { return []; } });
      return Response.json({ plans }, { headers });
    }
    const raw = await request.text();
    if (raw.length > 20000) return Response.json({ error: "계획 내용이 너무 길어요." }, { status: 413, headers });
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "입력을 확인해 주세요." }, { status: 400, headers }); }
    if (request.method === "POST") {
      const parsed = savePlanSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: "계획 제목과 지원 내용을 확인해 주세요." }, { status: 400, headers });
      const { requestId, plan } = parsed.data;
      const sources = await loadSupportSources(supabase, userId, plan.sourceWeek, plan.sourceIds);
      const saved = { ...plan, sourceWeek: weekRange(plan.sourceWeek).monday, targetWeek: weekRange(plan.targetWeek).monday, childAliases: [...new Set(sources.map(source => source.childAlias))], status: "planned" as const, reflection: "" };
      const previous = await owned().eq("session_id", requestId).limit(1);
      if (previous.error) throw previous.error;
      if (previous.data?.length) return Response.json({ saved: true, id: previous.data[0].id }, { headers });
      const session = await supabase.from("play_sessions").select("session_id").eq("user_id", userId).eq("session_id", requestId).limit(1);
      if (session.error) throw session.error;
      if (!session.data?.length) {
        const inserted = await supabase.from("play_sessions").insert({ session_id: requestId, user_id: userId, play_name: saved.title, play_goal: "", age_group: sources[0].ageGroup, child_alias: "주간 지원 계획", curriculum_areas: [], record_type: "놀이 이야기", play_subcategories: [], play_subcategory_notes: {}, teacher_supports: [], teacher_support_notes: {}, deleted: false });
        if (inserted.error) throw inserted.error;
      }
      const response = await supabase.from("generated_texts").insert({ session_id: requestId, user_id: userId, output_type: SUPPORT_PLAN_TYPE, result_text: JSON.stringify(saved), edited_text: "", source_text: "", expires_at: new Date(Date.now() + 365 * 86400000).toISOString(), deleted: false }).select("id");
      if (response.error || !response.data?.length) throw new Error("Save failed");
      return Response.json({ saved: true, id: response.data[0].id }, { headers });
    }
    const parsed = reviewPlanSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "계획과 돌아보기 내용을 확인해 주세요." }, { status: 400, headers });
    const previous = await owned().eq("id", parsed.data.id).limit(1);
    if (previous.error) throw previous.error;
    if (!previous.data?.length) return Response.json({ error: "계획을 찾을 수 없어요." }, { status: 404, headers });
    const plan = planSchema.parse(JSON.parse(previous.data[0].result_text || ""));
    const { id, ...changes } = parsed.data;
    const response = await supabase.from("generated_texts").update({ result_text: JSON.stringify({ ...plan, ...changes, targetWeek: weekRange(changes.targetWeek).monday }) }).eq("id", id).eq("user_id", userId).eq("output_type", SUPPORT_PLAN_TYPE).eq("deleted", false).select("id");
    if (response.error || !response.data?.length) throw new Error("Update failed");
    return Response.json({ saved: true }, { headers });
  } catch { return Response.json({ error: "계획을 저장하거나 불러오지 못했어요. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers }); }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
