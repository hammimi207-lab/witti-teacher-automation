"use client";
import { useRef, useState } from "react";
import { Download } from "lucide-react";
import type { WeeklyWordContent } from "./weekly-word-document";

export function WeeklyWordDownload({ content }: { content: WeeklyWordContent }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function download() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const [{ Packer }, { buildWeeklyWordDocument }] = await Promise.all([import("docx"), import("./weekly-word-document")]);
      const blob = await Packer.toBlob(buildWeeklyWordDocument(content));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url;
      link.download = `우리반_주간_놀이_이야기_${content.range.monday}_${content.range.saturday}.docx`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError("Word 문서를 만들지 못했어요. 분석 내용은 그대로 유지됩니다. 다시 시도해 주세요."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div><button type="button" className="library-view-all" disabled={busy} onClick={download}><Download size={16} aria-hidden="true" />{busy ? "Word 문서 준비 중…" : "분석 내용 Word로 내려받기"}</button>{error && <p role="alert" className="error">{error}</p>}</div>;
}
