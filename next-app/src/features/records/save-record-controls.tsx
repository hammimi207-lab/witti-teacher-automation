"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GeneratedRecord } from "./schema";
import type { RecordSnapshot } from "./story-document-preview";

export function SaveRecordControls({ generationId, result, snapshot, onRecordDecision, languageTarget, dialogTarget, onBusyChange, onPhotosSaved, onNeedsAction }: { generationId: string; result: GeneratedRecord; snapshot: RecordSnapshot; onRecordDecision: () => void; languageTarget: HTMLDivElement | null; dialogTarget: HTMLDivElement | null; onBusyChange: (busy: boolean) => void; onPhotosSaved: () => void; onNeedsAction?: (field: string, message: string) => void }) {
  const [savedVersions, setSavedVersions] = useState<Partial<Record<"record" | "language", string>>>({});
  const { observationRefinementRows, ...recordContent } = result;
  const versions = { record: JSON.stringify(recordContent), language: JSON.stringify(observationRefinementRows) };
  const savedKinds = (["record", "language"] as const).filter(kind => savedVersions[kind] === versions[kind]);
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<"record" | "language">("record");
  const saving = useRef(false);
  const uploadedSlots = useRef(new Set<number>());
  async function save(kind: "record" | "language") {
    if (saving.current || savedKinds.includes(kind)) return;
    if (!snapshot.consent?.aiAccepted || (kind === "record" && snapshot.files.length && !snapshot.consent.photoAccepted)) {
      const field = !snapshot.consent?.aiAccepted ? "aiConsent" : "photoConsent";
      const message = field === "aiConsent" ? "AI 활용 동의 후 기록을 저장해 주세요." : "사진 활용 동의 후 기록을 저장해 주세요.";
      setError(message); setErrorKind(kind); onNeedsAction?.(field, message); return;
    }
    saving.current = true; setBusy(true); onBusyChange(true); setError(""); setErrorKind(kind);
    try {
      const response = await fetch("/api/records/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generationId, kind, result, consent: snapshot.consent, teacherRevisions: snapshot.teacherRevisions, input: snapshot.input, createdAt: snapshot.createdAt }) });
      const payload = await response.json();
      if (!response.ok || payload.saved !== true) { if (payload.field) onNeedsAction?.(payload.field, payload.error); throw new Error(payload.error || "저장하지 못했습니다. 다시 시도해 주세요."); }
      if (kind === "record") {
        for (const [slot, photo] of snapshot.files.entries()) {
          if (uploadedSlots.current.has(slot)) continue;
          try {
            const body = new FormData(); body.set("sessionId", generationId); body.set("slot", String(slot)); body.set("photo", photo);
            const uploaded = await fetch("/api/photos", { method: "POST", body });
            if (!uploaded.ok) throw new Error("사진 보관 실패");
            uploadedSlots.current.add(slot);
          } catch { throw new Error("기록은 저장됐지만 일부 사진을 보관하지 못했습니다. 이 화면에서 저장 버튼을 다시 눌러 주세요."); }
        }
        onPhotosSaved();
      }
      setSavedVersions(previous => ({ ...previous, [kind]: versions[kind] }));
      if (kind === "record") onRecordDecision();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "저장하지 못했습니다."); }
    finally { saving.current = false; setBusy(false); onBusyChange(false); }
  }
  return <>
    {dialogTarget && createPortal(<div className="dialog-save-control"><button type="button" className="button secondary" disabled={busy || savedKinds.includes("record")} onClick={() => save("record")}>{savedKinds.includes("record") ? "✓ 저장 완료" : busy ? "저장 중…" : "저장하기"}</button>{savedKinds.includes("record") && <span role="status">내 기록에 저장했습니다.</span>}{error && errorKind === "record" && <p className="error" role="alert">{error}</p>}</div>, dialogTarget)}
    {languageTarget && createPortal(<div className="language-save-area">
      <button type="button" className="button secondary" disabled={busy || savedKinds.includes("language") || !result.observationRefinementRows?.length} onClick={() => save("language")}>{savedKinds.includes("language") ? "정확한 관찰 언어 저장 완료" : "✦ 정확한 관찰 언어 저장"}</button>
      <p role="status">{busy && errorKind === "language" ? "저장 중입니다…" : savedKinds.includes("language") ? "내 기록의 ‘정확한 관찰 언어’ 탭에 저장했습니다." : "이 표를 개인 장학 자료로 보관할 수 있어요."}</p>
      {error && errorKind === "language" && <p className="error" role="alert">{error}</p>}
    </div>, languageTarget)}
    <section className="save-record-controls" aria-label="기록 저장 선택"><h2>이 기록을 저장할까요?</h2><p>종합 기록을 저장하면 함께 등록한 사진의 크기를 줄인 사본도 비공개로 보관합니다. 사진은 내 기록의 내 사진 관리에서 별도로 삭제할 수 있습니다. 정확한 관찰 언어만 저장하면 사진은 보관하지 않습니다.</p>
      <div className="save-record-actions"><button type="button" className="button primary" disabled={busy || savedKinds.includes("record")} onClick={() => save("record")}>{savedKinds.includes("record") ? "종합 기록 저장 완료" : "종합 기록 저장"}</button>
      {!savedKinds.includes("record") && <button type="button" className="button secondary" disabled={busy} onClick={() => { setDeclined(true); setError(""); onRecordDecision(); }}>저장하지 않기</button>}</div>
      <p role="status">{busy && errorKind === "record" ? "저장 중입니다…" : declined && !savedKinds.includes("record") ? "종합 기록은 저장하지 않았습니다. 화면에서 계속 검토하거나 나중에 저장할 수 있습니다." : savedKinds.includes("record") ? "종합 기록을 내 기록에서 확인할 수 있습니다." : "저장하지 않은 결과는 화면을 떠나거나 다시 생성하면 사라집니다."}</p>
      {error && errorKind === "record" && <p className="error" role="alert">{error}</p>}
    </section>
  </>;
}
