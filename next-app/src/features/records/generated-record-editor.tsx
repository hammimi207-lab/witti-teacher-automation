"use client";
import { useRef, useState } from "react";
import { Check, Pencil } from "lucide-react";
import type { GeneratedRecord } from "./schema";
import { recommendedEmojis } from "./result-presentation";
import { NoticeSentenceEditor, type NoticeEditorHandle } from "./notice-sentence-editor";

export function GeneratedRecordEditor({ result, onChange, disabled, isNotice, onCopy, copied, guest = false }: { guest?: boolean; result: GeneratedRecord; onChange: (result: GeneratedRecord) => void; disabled: boolean; isNotice: boolean; onCopy?: () => void; copied?: boolean }) {
  const [applied, setApplied] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const noticeEditor = useRef<NoticeEditorHandle>(null);
  const fields = [["observation", "관찰"], ["interpretation", "해석"], ["connection", "연결"]] as const;
  if (isNotice) return <fieldset disabled={disabled} className="notice-final-workspace">
    <div className="final-notice-heading"><h2>부모님께 보낼 알림장</h2><button type="button" className="button primary" disabled={!result.finalNotice?.trim()} onClick={onCopy}>{copied ? "복사 완료" : "내용 복사"}</button></div>
    <NoticeSentenceEditor editorRef={noticeEditor} text={result.finalNotice ?? ""} disabled={disabled} onChange={finalNotice => onChange({ ...result, finalNotice })} />
    <div className="notice-emoji-picker"><strong>추천 이모지 10개</strong><p>원하는 이모지를 누르면 글의 커서 위치에 넣을 수 있어요.</p><div role="group" aria-label="추천 이모지">{recommendedEmojis(result.recommendedEmojis).map(emoji => <button key={emoji} type="button" className="button secondary" aria-label={`${emoji} 넣기`} onClick={() => {
      noticeEditor.current?.insert(emoji);
    }}>{emoji}</button>)}</div></div>
    <p>{guest ? "수정한 글을 복사할 수 있어요. 비회원 기록은 저장되지 않습니다." : "수정한 글을 복사할 수 있어요. 보관하려면 아래 ‘종합 기록 저장’을 눌러 주세요."}</p>
    <details className="record-result-disclosure"><summary>관찰·해석·연결과 종합 기록 자세히 보기</summary><GeneratedRecordEditor result={result} onChange={onChange} disabled={disabled} isNotice={false} /></details>
  </fieldset>;
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <p>관찰·해석·연결을 실제 상황에 맞게 수정해 주세요. 아래 반영 버튼을 누르면 세 내용을 순서대로 합쳐 종합 기록에 넣습니다.</p>
    {fields.map(([key, label]) => <div className={`analysis-block${editing === key ? " analysis-block-editing" : ""}`} key={key}>
      <div className="analysis-block-heading">
        <h2>{label}</h2>
        <button type="button" className="analysis-edit-toggle" aria-label={`${label} ${editing === key ? "수정 마치기" : "내용 수정하기"}`} aria-expanded={editing === key} aria-controls={`generated-${key}`} onClick={() => setEditing(editing === key ? null : key)}>{editing === key ? <Check size={20} aria-hidden="true" /> : <Pencil size={20} aria-hidden="true" />}{editing === key ? "수정 마치기" : "내용 수정하기"}</button>
      </div>
      {editing === key ? <label className="field"><textarea id={`generated-${key}`} aria-label={`${label} 내용`} autoFocus rows={4} value={result[key] ?? ""} onChange={event => { setApplied(false); onChange({ ...result, [key]: event.target.value }); }} /></label> : <pre id={`generated-${key}`}>{result[key] || "작성된 내용이 없습니다. 수정 버튼을 눌러 입력해 주세요."}</pre>}
    </div>)}
    <div className="record-edit-actions">
    <button type="button" className="button secondary" onClick={() => {
      const text = fields.map(([key]) => result[key]?.trim()).filter(Boolean).join("\n\n");
      onChange({ ...result, integratedRecord: text,  });
      setApplied(true);
    }}>수정 내용을 종합 기록에 반영</button>
    <p role="status">{applied ? "반영했습니다. 아래 최종 문장을 검토한 뒤 저장해 주세요." : "반영하면 기존 종합 기록" + " 문장을 교체합니다. 자동 저장되지는 않습니다."}</p>
    </div>
    <div className="record-final-editors">
    <label className="field"><span>종합 기록 · 최종 문장 수정</span><textarea rows={8} value={result.integratedRecord ?? ""} onChange={event => onChange({ ...result, integratedRecord: event.target.value })} /></label>
    <p>미리보기와 저장에는 수정한 최종 문장이 사용됩니다. 수정 후에는 ‘종합 기록 저장’을 눌러 주세요.</p>
    </div>
  </fieldset>;
}
