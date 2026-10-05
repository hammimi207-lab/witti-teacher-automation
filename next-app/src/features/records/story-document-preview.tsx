"use client";

import { useEffect, useRef } from "react";
import type { GeneratedRecord, RecordInput } from "./schema";
import { WordDownload } from "./word-download";
import { teacherDocumentSections } from "./teacher-document-sections";
import type { AIConsent } from "./ai-consent";
import { PhotoGallery } from "./photo-gallery";
import { documentTitle } from "./document-title";

export type RecordSnapshot = { input: RecordInput; files: File[]; createdAt: string; consent?: AIConsent; photoSessionId?: string; teacherRevisions?: import("./teacher-revisions").TeacherRevision[] };

function DocumentPhoto({ file, index }: { file: File; index: number }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <figure>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={ref} alt={`기록에 사용한 사진 ${index + 1}`} />
    <figcaption>사진 {index + 1}</figcaption>
  </figure>;
}

function NotesTable({ headings, rows }: { headings: [string, string]; rows: [string, string][] }) {
  return <table className="story-document-table"><thead><tr>{headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map(([label, value], i) => <tr key={i}><td>{label}</td><td>{value || "—"}</td></tr>)}</tbody></table>;
}

export function StoryDocumentPreview({ result, snapshot, allowDownload = true }: { result: GeneratedRecord; snapshot: RecordSnapshot; allowDownload?: boolean }) {
  const { input, files, createdAt } = snapshot;
  const infant = ["0세", "1세", "2세"].includes(input.ageGroup);
  const metadata = [["놀이명", input.playName], ["기록 유형", input.recordType], ["연령", input.ageGroup], ["아이 별칭", input.childAlias], ["교육과정 영역", input.curriculumAreas.join(", ")], ["생성일시", createdAt]];
  return <section className="story-document-wrap" aria-label="종합 기록 문서 미리보기"><h2>종합 기록</h2><p className="story-document-note">첨부 Word 양식과 기존 미리보기의 구성을 참고한 문서형 미리보기입니다.</p><article className="story-document-paper">
    <h3 className="story-document-brand">{documentTitle(createdAt, input.childAlias, input.recordType)}</h3>
    <h4>기록 기본 정보</h4><table className="story-document-table metadata"><tbody>{metadata.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>
    <h4>등록 사진</h4>{snapshot.photoSessionId ? <PhotoGallery sessionId={snapshot.photoSessionId} /> : files.length ? <div className="story-document-photos">{files.map((file, i) => <DocumentPhoto file={file} index={i} key={`${file.name}-${i}`} />)}</div> : <p>사진 없이 교사 관찰을 바탕으로 작성한 기록입니다.</p>}
    <h4>{infant ? "표준보육과정" : "누리과정"} 연계</h4>{result.curriculumLinks?.length ? <NotesTable headings={["영역", "내용"]} rows={result.curriculumLinks.map((item) => [item.area, item.description])} /> : <p>생성된 교육과정 연계 설명이 없습니다.</p>}
    <h4>놀이 이야기 기록 예시</h4><div className="story-document-final"><strong>최종 기록</strong><p>{result.integratedRecord || "생성된 종합 기록이 없습니다."}</p></div>
    <h4>{infant ? "영아" : "유아"} 관찰 및 평가</h4><p>{result.observationEvaluation || "생성된 관찰 및 평가가 없습니다."}</p>
    <h4>교사가 직접 입력한 내용</h4>
    <h5>놀이 세부 구분과 실제 장면</h5><NotesTable headings={["놀이 세부 구분", "교사가 입력한 실제 장면"]} rows={input.playSubcategories.map((item) => [item, input.playSubcategoryNotes[item]])} />
    <h5>교사의 지원과 구체 지원</h5><NotesTable headings={["교사의 지원", "교사가 입력한 구체 지원"]} rows={input.teacherSupports.map((item) => [item, input.teacherSupportNotes[item]])} />
    <h5>교사가 관찰한 실제 장면</h5><p>{input.observation}</p>
    {teacherDocumentSections(input).map(([label, value]) => <section key={label}><h5>{label}</h5><p>{value}</p></section>)}
    <div className="story-document-footer">놀이 기록 자동화 | 사진과 교사 입력을 바탕으로 생성된 기록입니다.</div>
  </article>{allowDownload && <WordDownload title={input.playName} result={result} input={input} createdAt={createdAt} files={files} sessionId={snapshot.photoSessionId} />}</section>;
}
