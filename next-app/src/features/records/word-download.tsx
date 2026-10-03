"use client";
import { useRef, useState } from "react";
import type { GeneratedRecord, RecordInput } from "./schema";

export function WordDownload({ title, result, input, recordType, createdAt, plain = "", edited = "", files = [], sessionId }: { title: string; result: GeneratedRecord; input?: RecordInput | null; recordType?: string | null; createdAt?: string | null; plain?: string; edited?: string; files?: File[]; sessionId?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function download() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("record", JSON.stringify({ title, result, input, recordType, createdAt, plain, edited, sessionId }));
      if (!sessionId) for (const file of files) form.append("photo", file);
      const response = await fetch("/api/records/word", { method: "POST", body: form, cache: "no-store" });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || "Word 문서를 만들지 못했습니다. 다시 시도해 주세요.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url;
      link.download = `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80) || "기록"}_기록.docx`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Word 문서를 만들지 못했습니다. 다시 시도해 주세요. 기록 내용은 유지됩니다."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="word-download"><h3>Word 문서</h3><button type="button" className="button primary" disabled={busy} onClick={download}>{busy ? "사진과 Word 문서 준비 중…" : "Word 문서 다운로드"}</button><p>현재 기록과 첨부·보관된 사진을 .docx 파일로 내려받습니다. 삭제된 사진은 포함하지 않습니다. 다운로드만으로 내 기록에 저장되지는 않습니다.</p>{error && <p className="error" role="alert">{error}</p>}</div>;
}
