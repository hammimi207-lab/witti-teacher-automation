import { AlignmentType, BorderStyle, Document, Footer, HeadingLevel, PageNumber, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from "docx";
import type { WeeklyResult, WeeklySource } from "./weekly-story";

export type WeeklyWordContent = { range: { monday: string; saturday: string }; sources: WeeklySource[]; result: WeeklyResult };
export const WEEKLY_DOCUMENT_TITLE = "우리반 주간 놀이 이야기";

export function buildWeeklyWordDocument({ range, sources, result }: WeeklyWordContent) {
  const width = 9638; // A4, 20 mm margins; keep table, grid and cell widths identical.
  const border = { style: BorderStyle.SINGLE, size: 5, color: "BCCDD7" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const font = { name: "맑은 고딕", eastAsia: "맑은 고딕" };
  const run = (text: string, bold = false, color = "253642", size = 21) => new TextRun({ text, bold, color, size, font });
  const paragraphs = (text: string, small = false) => text.split(/\r?\n/).map(line => new Paragraph({ children: [run(line, false, small ? "647581" : "253642", small ? 17 : 21)], spacing: { after: small ? 70 : 110, line: small ? 260 : 330 }, widowControl: true }));
  const children: (Paragraph | Table)[] = [];
  const heading = (text: string, newPage = false) => children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: newPage, keepNext: true, children: [run(text, true, "000000", 28)], spacing: { before: 240, after: 150 } }));
  const label = (text: string) => new Paragraph({ children: [run(text, true, "163A5F", 21)], spacing: { after: 50, line: 290 }, keepNext: true });
  const cell = (content: Paragraph[], cellWidth: number, fill?: string) => new TableCell({ width: { size: cellWidth, type: WidthType.DXA }, borders, shading: fill ? { fill } : undefined, margins: { top: 130, bottom: 110, left: 170, right: 170 }, children: content });
  const table = (rows: TableRow[], columns: number[]) => {
    children.push(new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: columns, layout: TableLayoutType.FIXED, alignment: AlignmentType.CENTER, rows }));
    children.push(new Paragraph({ spacing: { after: 90 }, children: [] }));
  };
  const box = (title: string, content: Paragraph[]) => table([
    new TableRow({ tableHeader: true, cantSplit: true, children: [cell([label(title)], width, "EAF3FB")] }),
    // Long prose can flow over page breaks; never force an entire observation onto one page.
    new TableRow({ children: [cell(content.length ? content : paragraphs("—"), width)] }),
  ], [width]);
  const references = (ids: string[]) => ids.map(id => {
    const source = sources.find(item => item.id === id);
    return source ? `${source.date} · ${source.childAlias} · ${source.playName}` : "";
  }).filter(Boolean).join(" / ");

  children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [run(WEEKLY_DOCUMENT_TITLE, true, "000000", 40)], spacing: { after: 200 } }));
  const meta: [string, string][] = [
    ["분석 기간", `${range.monday} ~ ${range.saturday}  월~토`],
    ["기록 범위", `놀이 이야기 ${sources.length}건 · 한국 시간 저장일 기준`],
    ["아이 별칭", [...new Set(sources.map(source => source.childAlias))].join(", ") || "—"],
    ["연령", [...new Set(sources.map(source => source.ageGroup))].join(", ") || "—"],
  ];
  table(meta.map(([key, value]) => new TableRow({ children: [cell([label(key)], 2000, "EAF3FB"), cell(paragraphs(value), width - 2000)] })), [2000, width - 2000]);
  children.push(...paragraphs("한 주에 저장한 놀이 기록을 바탕으로 아이들의 흥미와 놀이 흐름, 교사의 지원과 다음 계획을 정리한 문서입니다. AI 분석 내용은 실제 관찰과 비교하여 교사가 검토해 주세요.", true));
  heading("한 주의 놀이 흐름");
  children.push(...paragraphs(result.overview));
  heading("이번 주에 드러난 흥미");
  result.interests.forEach(item => box(item.interest, [...paragraphs(item.evidence), ...paragraphs(`관찰 근거  ${references(item.sourceIds)}`, true)]));
  result.plays.forEach((play, index) => {
    heading(`${index + 1}  ${play.title}`, true);
    children.push(...paragraphs(`관련 기록  ${references(play.sourceIds)}`, true));
    box("교사가 관찰한 실제 장면", play.scenes.flatMap(scene => [new Paragraph({ children: [run(references(scene.sourceIds), true, "647581", 17)], keepNext: true, spacing: { before: 100, after: 70 } }), ...paragraphs(scene.observation)]));
    box("교사의 지원", paragraphs(play.teacherSupport));
    box("교사의 해석", paragraphs(play.teacherInterpretation));
    box("다음 놀이 지원 계획", paragraphs(play.nextSupportPlan));
  });
  if (result.limitations) { heading("함께 살펴볼 점"); children.push(...paragraphs(result.limitations)); }
  return new Document({ title: WEEKLY_DOCUMENT_TITLE, creator: "기록 요정", description: "주간 놀이의 흥미와 흐름 및 교사 지원 계획",
    styles: { default: { document: { run: { font, size: 21 }, paragraph: { spacing: { line: 330, after: 110 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("기록 요정  ·  ", false, "647581", 16), new TextRun({ children: [PageNumber.CURRENT], font, size: 16, color: "647581" })] })] }) } }],
  });
}
