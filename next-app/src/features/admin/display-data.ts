type Row = Record<string, unknown>;
export const displayColumns: Record<string, [string, string][]> = {
  subscribers: [["id", "번호"], ["subscriber_name", "성명"], ["username", "아이디"], ["email", "이메일"], ["institution_name", "기관명"], ["position", "직책"], ["created_at", "가입일"]],
  play_sessions: [["id", "번호"], ["play_name", "놀이명"], ["age_group", "연령"], ["child_alias", "아이 별칭"], ["record_type", "기록 유형"], ["teacher_observed_situation", "관찰 내용"], ["created_at", "작성일"]],
  photo_records: [["id", "번호"], ["play_title", "놀이명"], ["original_file_name", "사진 이름"], ["observed_action", "관찰 내용"], ["created_at", "등록일"]],
  generated_texts: [["id", "번호"], ["output_type", "기록 유형"], ["result_text", "생성 결과"], ["edited_text", "교사가 수정한 내용"], ["created_at", "작성일"]],
  phrase_logs: [["id", "번호"], ["record_type", "기록 유형"], ["play_keyword", "놀이 주제"], ["generated_text", "생성 내용"], ["created_at", "작성일"]],
};
function readable(value: unknown): string {
  if (value == null || value === "null" || value === "") return "—";
  if (Array.isArray(value)) return value.map(readable).filter(v => v !== "—").join(", ") || "—";
  if (typeof value === "object") return "—";
  return String(value);
}
function generated(value: unknown): string {
  let data = value;
  if (typeof data === "string") {
    const text = data;
    try { data = JSON.parse(text); } catch { return text; }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return readable(data);
  const envelope = data as Row;
  const result = (envelope.result && typeof envelope.result === "object" ? envelope.result : envelope) as Row;
  for (const key of ["integratedRecord", "finalNotice", "generated_text", "text"]) if (typeof result[key] === "string" && result[key]) return result[key] as string;
  const sections = [["observation", "관찰"], ["interpretation", "해석"], ["connection", "연결"]].flatMap(([key, label]) => typeof result[key] === "string" && result[key] ? [`${label}\n${result[key]}`] : []);
  return sections.join("\n\n") || "저장된 본문이 없습니다.";
}
export function displayValue(row: Row, key: string): string {
  let value = row[key];
  if (key === "subscriber_name") value = value || row.display_name;
  if (key === "username") value = value || row.platform_member_id;
  if (key === "original_file_name") value = value || row.original_filename;
  if (key === "play_title") value = value || row.play_name || row.play_keyword;
  if (key === "generated_text") value = value || row.result_text;
  if (key === "created_at") {
    const date = new Date(String(value || row.member_created_at || ""));
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  return ["result_text", "generated_text", "edited_text"].includes(key) ? generated(value) : readable(value);
}
export function displayExport(table: string, rows: Row[]) {
  const columns = displayColumns[table] || [];
  return rows.map(row => Object.fromEntries(columns.map(([key, label]) => [label, displayValue(row, key)])));
}
