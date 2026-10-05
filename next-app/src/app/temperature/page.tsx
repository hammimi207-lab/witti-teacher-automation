import { TemperatureDiary } from "@/features/temperature/temperature-diary";

export default function TemperaturePage() {
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">교사의 온도</span><h1>지금 그리고 오늘, 교사의 온도</h1><p>하루를 마무리하며 교사의 마음을 짧게 기록하는 공간입니다.</p></header><TemperatureDiary /></main>;
}
