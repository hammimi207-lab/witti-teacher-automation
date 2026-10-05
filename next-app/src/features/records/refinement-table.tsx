import type { GeneratedRecord } from "./schema";

export function RefinementTable({ rows }: { rows: GeneratedRecord["observationRefinementRows"] }) {
  return <section className="refinement-section"><h2>어떤 표현이 달라졌을까요?</h2><p>원문과 관찰 언어를 비교하며 나의 기록을 돌아보세요. AI가 제안한 내용이 실제 관찰과 일치하는지 확인해 주세요.</p>{rows?.length ? <div className="refinement-table-wrap"><table className="refinement-table"><thead><tr><th scope="col">교사들이 작성한 내용</th><th scope="col" className="accurate-language-column"><span aria-hidden="true">✦ </span>정확한 관찰 언어</th><th scope="col">1차 개선 내용</th></tr></thead><tbody>{rows.map((row, i) => <tr key={i}><td>{row.teacherInput}</td><td className="accurate-language-column">{row.accurateObservation}</td><td>{row.firstImprovement}</td></tr>)}</tbody></table></div> : <p>이 기록에는 관찰 언어 비교표가 없습니다. 새로 생성한 기록에서 확인할 수 있습니다.</p>}</section>;
}
