import { AlignmentType, BorderStyle, Document, Footer, ImageRun, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from "docx";
import type { GeneratedRecord, RecordInput } from "./schema";
import { teacherDocumentSections } from "./teacher-document-sections";
import type { DocumentPhoto } from "./document-photos";
import { documentTitle } from "./document-title";

// Streamlit build_record_word_document와 사용자가 제공한 이전 Word 양식의 구성입니다.
export function buildStoryWordDocument(title: string, result: GeneratedRecord, input?: RecordInput | null, createdAt?: string | null, options: { recordType?: string | null; plain?: string; edited?: string; photos?: DocumentPhoto[] } = {}) {
  const recordType = input?.recordType || options.recordType || "기록";
  const children: (Paragraph | Table)[] = [];
  const run = (text: string, bold = false, color = "222222", size = 21) => new TextRun({ text, bold, color, size, font: { name: "맑은 고딕", eastAsia: "맑은 고딕" } });
  const para = (text: string, bold = false, color = "222222", size = 21) => new Paragraph({ children: text.split(/\r?\n/).flatMap((line, i) => i ? [new TextRun({ break: 1 }), run(line, bold, color, size)] : [run(line, bold, color, size)]), spacing: { after: 100, line: 372 } });
  const heading = (text: string, small = false) => children.push(new Paragraph({ children: [run(text, true, "163A5F", small ? 24 : 27)], spacing: { before: 200, after: 120 }, keepNext: true }));
  const border = { style: BorderStyle.SINGLE, size: 6, color: "AAB8C8" };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  // Match the printable page width in tblW, tblGrid and every cell's tcW.
  // docx otherwise emits 100-twip grid columns, which Word can collapse.
  const tableWidth = 10200;
  const columns = [3060, 7140]; // Same 30:70 ratio as story-document-table in the preview.
  const cell = (text: string, width: number, fill?: string, bold = false, color = "222222") => new TableCell({ borders: cellBorders, width: { size: width, type: WidthType.DXA }, children: [para(text || "—", bold, color, 20)], shading: fill ? { fill } : undefined, margins: { top: 120, bottom: 120, left: 150, right: 150 } });
  const table = (rows: TableRow[], columnWidths = columns) => {
    children.push(new Table({ width: { size: tableWidth, type: WidthType.DXA }, columnWidths, layout: TableLayoutType.FIXED, alignment: AlignmentType.CENTER, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }, rows }));
    children.push(new Paragraph({ spacing: { after: 80 } }));
  };
  const pairs = (headers: [string, string], rows: [string, string][]) => table([
    new TableRow({ tableHeader: true, children: headers.map((text, i) => cell(text, columns[i], "EAF3FB", true, "163A5F")) }),
    ...rows.map(([left, right]) => new TableRow({ children: [cell(left, columns[0]), cell(right, columns[1])] })),
  ]);
  const box = (label: string, text: string, fill = "EDF5FC") => table([new TableRow({ children: [new TableCell({ borders: cellBorders, width: { size: tableWidth, type: WidthType.DXA }, shading: { fill }, margins: { top: 210, bottom: 210, left: 240, right: 240 }, children: [para(label, true, "163A5F", 22), para(text)] })] })], [tableWidth]);
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(documentTitle(createdAt, input?.childAlias, recordType), true, "163A5F", 38)], spacing: { after: 280 } }));
  heading("기록 기본 정보");
  const date = createdAt && !Number.isNaN(Date.parse(createdAt)) ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(createdAt)) : createdAt || "-";
  table([["놀이명", title], ["기록 유형", recordType], ["연령", input?.ageGroup || "—"], ["아이 별칭", input?.childAlias || "—"], ["교육과정 영역", input?.curriculumAreas.join(", ") || "—"], ...(input?.writingDate ? [["작성일", input.writingDate]] : []), ["생성일시", date]].map(([label, value]) => new TableRow({ children: [cell(label, columns[0], "EAF3FB", true, "163A5F"), cell(value, columns[1])] })));
  heading("등록 사진");
  const photos = options.photos || [];
  if (photos.length) {
    const rows: TableRow[] = [];
    for (let start = 0; start < photos.length; start += 3) {
      rows.push(new TableRow({ cantSplit: true, children: Array.from({ length: 3 }, (_, column) => {
        const photo = photos[start + column];
        const scale = photo ? Math.min(200 / photo.width, 160 / photo.height, 1) : 1;
        return new TableCell({ borders: cellBorders, width: { size: 3400, type: WidthType.DXA }, margins: { top: 90, bottom: 90, left: 110, right: 110 }, children: photo ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "jpg", data: photo.data, transformation: { width: Math.round(photo.width * scale), height: Math.round(photo.height * scale) }, altText: { title: `사진 ${start + column + 1}`, description: "교사가 등록한 놀이 사진", name: `photo-${start + column + 1}` } })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`사진 ${start + column + 1}`, false, "667085", 17)] })] : [new Paragraph("")] });
      }) }));
    }
    table(rows, [3400, 3400, 3400]);
  } else box("사진 안내", "첨부되거나 보관 중인 사진이 없습니다. 이전에 사진을 보관하지 않았거나 삭제한 기록은 사진 없이 내려받습니다.", "F7FAFD");
  const infant = input && ["0세", "1세", "2세"].includes(input.ageGroup);
  heading(`${input ? infant ? "표준보육과정" : "누리과정" : "교육과정"} 연계`);
  if (result.curriculumLinks?.length) pairs(["영역", "내용"], result.curriculumLinks.map(link => [link.area, link.description]));
  else children.push(para("생성된 교육과정 연계 설명이 없습니다."));
  heading(recordType === "놀이 이야기" ? "놀이 이야기 기록 예시" : "종합 기록"); box("최종 기록", result.integratedRecord || options.plain || "생성된 종합 기록이 없습니다.");
  if (result.finalNotice) { heading("완성형 알림장"); box("알림장", result.finalNotice); }
  heading(`${input ? infant ? "영아" : "유아" : "영유아"} 관찰 및 평가`); children.push(para(result.observationEvaluation || "생성된 관찰 및 평가가 없습니다."));
  if (recordType !== "놀이 이야기") {
    for (const [label, value] of [["관찰", result.observation], ["해석", result.interpretation], ["연결", result.connection]] as const) {
      if (value) { heading(label); box(label, value, "F7FAFD"); }
    }
  }
  if (options.edited) { heading("교사가 수정한 1차 기록"); box("수정 기록", options.edited, "F7FAFD"); }
  if (input) {
    heading("교사가 직접 입력한 내용");
    heading("놀이 세부 구분과 실제 장면", true);
    pairs(["놀이 세부 구분", "교사가 입력한 실제 장면"], input.playSubcategories.map(key => [key, input.playSubcategoryNotes[key] || "-"]));
    heading("교사의 지원과 구체 지원", true);
    pairs(["교사의 지원", "교사가 입력한 구체 지원"], input.teacherSupports.map(key => [key, input.teacherSupportNotes[key] || "-"]));
    heading("교사가 관찰한 실제 장면", true); children.push(para(input.observation));
    for (const [label, value] of teacherDocumentSections(input)) {
      heading(label, true); children.push(para(value));
    }
  }
  return new Document({ creator: "놀이 기록 자동화", title: `${title}_${recordType}`, styles: { default: { document: { run: { font: "맑은 고딕", size: 21 } } } }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 964, bottom: 964, left: 1020, right: 1020 } } }, children, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("놀이 기록 자동화 | 사진 분석과 교사 입력을 바탕으로 생성된 문서입니다.", false, "667085", 16.6)] })] }) } }] });
}
