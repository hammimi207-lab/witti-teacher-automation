import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { mergeSavedRecord, savedEnvelopeSchema, saveRequestSchema } from "@/features/records/save-contract";
import { AI_CONSENT_TEXT, PHOTO_CONSENT_TEXT } from "@/features/records/ai-consent";
import { storySource } from "@/features/records/steam-schema";
import { ownedSteamPhotos } from "@/lib/steam-photos";

export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  let stage = "입력 확인";
  if (!hasSupabaseConfig()) return Response.json({ error: "저장하려면 로그인 서비스 연결이 필요합니다." }, { status: 503 });
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return Response.json({ error: "로그인 후 저장해 주세요. 현재 화면의 결과는 유지됩니다." }, { status: 401 });
    const raw = await request.text();
    if (raw.length > 200000) return Response.json({ error: "저장 내용이 너무 큽니다." }, { status: 413 });
    const parsed = saveRequestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return Response.json({ error: "저장할 기록 형식을 확인해 주세요." }, { status: 400 });
    const input = parsed.data;
    if (!input.consent) return Response.json({ error: "AI 활용 동의 후 기록을 저장해 주세요.", field: "aiConsent" }, { status: 403 });
    if (input.kind === "language" && !input.result.observationRefinementRows.length) return Response.json({ error: "저장할 비교표가 없습니다." }, { status: 400 });
    const userId = auth.user.id;
    if (input.steam) {
      const steam = input.steam;
      if (input.kind !== "record" || !input.consent.photoAccepted || steam.age !== input.input.ageGroup || steam.age !== steam.analyzedInput.age || steam.sourceObservation !== steam.analyzedInput.observation || JSON.stringify(steam.photoIds) !== JSON.stringify(steam.analyzedInput.photoIds) || input.input.observation !== steam.confirmedObservation || input.input.teacherInterpretation !== steam.interpretation || input.input.supportPlan !== steam.extension || input.result.observation !== steam.confirmedObservation || input.result.interpretation !== steam.interpretation || input.result.connection !== steam.extension || input.result.integratedRecord !== (steam.story?.text || steam.draft) || (steam.story && JSON.stringify(steam.story.source) !== JSON.stringify(storySource(steam)))) return Response.json({ error: "관찰·해석·제안의 저장 내용을 확인하고, 입력을 바꿨다면 다시 분석해 주세요." }, { status: 400 });
      try { await ownedSteamPhotos(userId, steam.photoIds); } catch { return Response.json({ error: "선택 사진이 삭제되었거나 접근할 수 없습니다." }, { status: 404 }); }
      if (steam.recordingIds.length) {
        const recordings = await supabase.from("record_fragments").select("fragment_id").eq("user_id", userId).eq("record_type", "voice").is("deleted_at", null).in("fragment_id", steam.recordingIds);
        if (recordings.error || recordings.data?.length !== new Set(steam.recordingIds).size) return Response.json({ error: "연결 녹음이 삭제되었거나 접근할 수 없습니다." }, { status: 404 });
      }
    }
    stage = "기존 기록 조회";
    // 생성별 고정 세션을 사용해 저장 버튼의 재시도에서도 같은 기록을 찾습니다.
    const existing = await supabase.from("generated_texts").select("id,result_text").eq("user_id", userId).eq("session_id", input.generationId).eq("deleted", false).limit(1);
    if (existing.error) throw existing.error;
    const row = existing.data?.[0];
    const previous = row ? savedEnvelopeSchema.parse(JSON.parse(row.result_text)) : undefined;
    // 같은 생성 결과를 수정해 저장하면 기존 행의 내용을 갱신합니다.
    const envelope = mergeSavedRecord(input, previous);
    envelope.consent = { ...input.consent, acceptedAt: previous?.consent?.acceptedAt || new Date().toISOString(), aiText: AI_CONSENT_TEXT, photoText: input.consent.photoAccepted ? PHOTO_CONSENT_TEXT : undefined };
    if (!row) {
      stage = "놀이 세션 조회";
      const session = await supabase.from("play_sessions").select("session_id").eq("user_id", userId).eq("session_id", input.generationId).limit(1);
      if (session.error) throw session.error;
      if (!session.data?.length) {
        stage = "놀이 세션 저장";
        const created = await supabase.from("play_sessions").insert({
          session_id: input.generationId, user_id: userId, play_name: input.input.playName, play_goal: "", age_group: input.input.ageGroup,
          child_alias: input.input.childAlias, curriculum_areas: input.input.curriculumAreas, record_type: input.input.recordType,
          play_subcategories: input.input.playSubcategories, play_subcategory_notes: input.input.playSubcategoryNotes,
          teacher_supports: input.input.teacherSupports, teacher_support_notes: input.input.teacherSupportNotes, deleted: false,
        });
        if (created.error) throw created.error;
      }
    }
    const resultText = JSON.stringify(envelope);
    stage = "종합 기록 저장";
    const saved = row
      ? await supabase.from("generated_texts").update({ result_text: resultText }).eq("id", row.id).eq("user_id", userId).select("id")
      : await supabase.from("generated_texts").insert({ session_id: input.generationId, user_id: userId, output_type: input.input.recordType,
        result_text: resultText, edited_text: "", source_text: input.input.observation, expires_at: new Date(Date.now() + 365 * 86400000).toISOString(), deleted: false }).select("id");
    if (saved.error) throw saved.error;
    if (!saved.data?.length) throw { code: "NO_ROW" };
    return Response.json({ saved: true, savedKinds: envelope.savedKinds });
  } catch (caught) {
    const rawCode = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "UNKNOWN";
    const code = /^[A-Z0-9_]{1,20}$/.test(rawCode) ? rawCode : "UNKNOWN";
    const reason = code === "42501" ? "현재 계정의 데이터베이스 저장·조회 권한을 확인해야 합니다." : ["PGRST204", "42703", "42P01"].includes(code) ? "현재 데이터베이스의 테이블·열 구성이 저장 양식과 일치하지 않습니다." : code === "22P02" ? "데이터베이스의 식별자 또는 값 형식이 저장 양식과 일치하지 않습니다." : code === "23503" ? "연결할 회원 또는 놀이 세션 정보를 확인해야 합니다." : "연결 상태와 저장 설정을 확인해야 합니다.";
    return Response.json({ error: `저장하지 못했습니다. ${reason} [${stage} · ${code}] 결과는 화면에 유지됩니다.` }, { status: 500 });
  }
}
