import { savedEnvelopeSchema } from "./save-contract";
import { generatedSchema } from "./result-schema";
import { TeacherGrowthTable } from "./teacher-growth-table";
import { WordDownload } from "./word-download";
import { teacherDocumentSections } from "./teacher-document-sections";
import { PhotoGallery } from "./photo-gallery";
import Link from "next/link";

export type SavedRecord = { id: number; session_id?: string | null; output_type: string | null; result_text: string | null; edited_text: string | null; created_at: string | null };
export function unpackRecord(record: SavedRecord) {
  let raw: unknown;
  try { raw = JSON.parse(record.result_text || ""); } catch { raw = null; }
  const envelope = savedEnvelopeSchema.safeParse(raw);
  if (envelope.success) return { sessionId: record.session_id || envelope.data.generationId, teacherRevisions: envelope.data.teacherRevisions, kinds: envelope.data.savedKinds as string[], result: envelope.data.result, title: envelope.data.input.playName, plain: "", input: envelope.data.input };
  const parsed = generatedSchema.safeParse(raw);
  const isResult = !!raw && typeof raw === "object" && ["integratedRecord", "finalNotice", "observation", "observationRefinementRows"].some((key) => key in raw);
  const result = parsed.success && isResult ? parsed.data : generatedSchema.parse({});
  return { sessionId: record.session_id, teacherRevisions: undefined, kinds: ["record", ...(result.observationRefinementRows.length ? ["language"] : [])], result, title: record.output_type || "생성 기록", plain: isResult ? "" : record.result_text || "내용 없음", input: null };
}
export function SavedRecordCard({ record, language }: { record: SavedRecord; language: boolean }) {
  let steam;
  try { steam = savedEnvelopeSchema.parse(JSON.parse(record.result_text || "null")).steam; } catch { /* Older records remain readable. */ }
  const { result, title, plain, input, teacherRevisions, sessionId } = unpackRecord(record);
  const finalText = (record.output_type === "알림장" ? result.finalNotice : result.integratedRecord) || result.integratedRecord || plain || record.edited_text || "";
  return <article className="panel result saved-record-card">
    <header className="saved-record-header"><h2>{title}</h2><span className="section-kicker">{record.output_type || "기록"}</span></header>
    <p className="saved-record-meta">{input?.writingDate || (record.created_at ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(record.created_at)) : "작성일 없음")}{input && <> · 아이 별칭 {input.childAlias} · {input.ageGroup}</>}</p>
    {steam && sessionId && <Link className="button secondary" href={`/records/steam?session=${encodeURIComponent(sessionId)}`}>STEAM 과정 기록 다시 열기</Link>}
    {language ? <TeacherGrowthTable revisions={teacherRevisions} /> : <>
      <p className="saved-record-excerpt">{finalText || "자세히 보기에서 저장된 내용을 확인해 주세요."}</p>
      <details className="saved-record-details"><summary>생성 결과 자세히 보기</summary><div className="saved-record-body">
        <section className="saved-final-record"><h3>{record.output_type === "알림장" ? "완성형 알림장" : "종합 기록"}</h3><pre>{finalText || "저장된 최종 문장이 없습니다."}</pre></section>
        {record.output_type === "알림장" && result.integratedRecord && result.integratedRecord !== finalText && <section><h3>종합 기록</h3><pre>{result.integratedRecord}</pre></section>}
        {result.curriculumLinks.length > 0 && <section><h3>교육과정 연계</h3><ul>{result.curriculumLinks.map((link, i) => <li key={i}><b>{link.area}</b> · {link.description}</li>)}</ul></section>}
        {result.observationEvaluation && <section><h3>관찰 및 평가</h3><pre>{result.observationEvaluation}</pre></section>}
        {([["observation", "WHAT HAPPENED", "관찰"], ["interpretation", "WHAT IT MAY MEAN", "해석"], ["connection", "WHAT'S NEXT", "연결"]] as const).map(([key, english, label]) => result[key] && <div className="analysis-block" key={key}><span>{english}</span><h2>{label}</h2><pre>{result[key]}</pre></div>)}
        {record.edited_text && <details className="saved-record-details"><summary>교사가 수정한 1차 기록 보기</summary><div className="saved-record-body"><pre>{record.edited_text}</pre></div></details>}
        {input && <details className="saved-record-details"><summary>교사가 입력한 내용 보기</summary><div className="saved-record-body">
          <section><h3>교사가 관찰한 실제 장면</h3><pre>{input.observation}</pre></section>
          {[...input.playSubcategories.map(key => [key, input.playSubcategoryNotes[key]]), ...input.teacherSupports.map(key => [key, input.teacherSupportNotes[key]]), ...teacherDocumentSections(input)].map(([label, value]) => value && <section key={label}><h3>{label}</h3><pre>{value}</pre></section>)}
        </div></details>}
        {sessionId && <PhotoGallery sessionId={sessionId} photoIds={steam?.photoIds} lazy />}
        <WordDownload title={title} result={result} input={input} recordType={record.output_type} createdAt={record.created_at} plain={plain} edited={record.edited_text || ""} sessionId={sessionId} photoIds={steam?.photoIds} steamRecord={Boolean(steam)} />
      </div></details>
    </>}
  </article>;
}
