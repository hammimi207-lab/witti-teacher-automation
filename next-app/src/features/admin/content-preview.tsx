/* eslint-disable @next/next/no-img-element */
import { Fragment, type ReactNode } from "react";
import { documentFrom, safeLink, type ContentRecord, type Asset } from "@/lib/platform-content";
const colors: Record<string, string> = { 남색: "#172B4D", 파랑: "#1D4ED8", 초록: "#188B55", 주황: "#B54708", 빨강: "#B42318", 보라: "#6941C6", 회색: "#475467" };
const highlights: Record<string, string> = { 노랑: "#FFF3B0", 하늘: "#DFF4FF", 연두: "#DCFCE7", 분홍: "#FFE4E6", 보라: "#EEE5FF" };
function inline(text: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|https?:\/\/[^\s<>]+)/g).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\((.+)\)$/);
    if (link && safeLink(link[2])) return <a key={i} href={safeLink(link[2])} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (safeLink(part)) return <a key={i} href={safeLink(part)} target="_blank" rel="noopener noreferrer">{part}</a>;
    return part;
  });
}
function AssetImage({ asset }: { asset: Asset }) {
  const image = asset.url ? <img src={asset.url} alt={asset.image_alt_text || "공지 이미지"} style={{ maxWidth: "100%", height: "auto" }} /> : <p>이미지를 불러오지 못했습니다.</p>;
  return <figure>{safeLink(asset.image_link_url) ? <a href={safeLink(asset.image_link_url)} target="_blank" rel="noopener noreferrer">{image}</a> : image}{asset.image_caption && <figcaption>{asset.image_caption}</figcaption>}</figure>;
}
export function ContentPreview({ record }: { record: ContentRecord }) {
  const doc = documentFrom(record); const lines = (doc.body || "").split("\n"); const rendered: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith(":::style|") || line.startsWith(":::callout|")) {
      const parts = line.split("|"); const body: string[] = [];
      while (++i < lines.length && lines[i].trim() !== ":::") body.push(lines[i]);
      if (parts[0] === ":::callout") rendered.push(<aside className={`notice-callout ${["info", "success", "warning", "danger"].includes(parts[1]) ? parts[1] : "info"}`} key={i}><strong>{parts[2]}</strong><p>{inline(body.join("\n"))}</p></aside>);
      else rendered.push(<div key={i} style={{ color: colors[parts[2]], background: highlights[parts[3]], fontSize: parts[1]?.startsWith("헤딩") ? `${Math.max(1, 2 - Number(parts[1].slice(-1)) * .15)}em` : undefined, fontWeight: parts[1]?.startsWith("헤딩") ? 700 : undefined }}>{inline(body.join("\n"))}</div>);
    } else if (line.trim() === "---") rendered.push(<hr key={i} />);
    else if (/^\[\[이미지:/.test(line.trim())) { const id = line.trim().slice(6, -2); const asset = doc.assets?.find(a => a.asset_id === id); if (asset) rendered.push(<AssetImage key={i} asset={asset} />); }
    else if (/^#{1,5} /.test(line)) rendered.push(<h3 key={i}>{line.replace(/^#+ /, "")}</h3>);
    else rendered.push(<Fragment key={i}>{inline(line)}<br /></Fragment>);
  }
  return <div className="notice-document" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{rendered}{!!doc.attachments?.length && <section><h3>첨부파일</h3>{doc.attachments.map((asset, i) => <p key={asset.attachment_id || i}>{asset.url ? <a href={asset.url} target="_blank" rel="noopener noreferrer">{asset.attachment_original_file_name || "첨부파일 다운로드"}</a> : "첨부파일을 불러오지 못했습니다."}</p>)}</section>}</div>;
}
