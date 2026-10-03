import { FairyImage } from "./fairy-image";
import type { GeneratedRecord } from "./schema";

export function PlayNameTip({ result }: { result: GeneratedRecord }) {
  const suggestions = result.playNameRecommendations ?? [];
  if (!suggestions.length) return null;
  return <aside className="play-name-tip" aria-label="기록 요정의 놀이명 제안">
    <span className="play-name-fairy" aria-hidden="true"><FairyImage /></span>
    <div className="play-name-bubble"><p><strong>놀이 이름에 작은 발견을 더해볼까요?</strong><br />“{suggestions[0].title}”는 어때요?</p>
      <details><summary>다른 이름과 추천 이유 살짝 보기</summary><p>선생님이 적은 이름: {result.originalPlayName}</p>{suggestions.map((item, i) => <div className="play-name-reason" key={i}><strong>{item.title}</strong><p>{item.reason}</p><small>사진: {item.photoEvidence}<br />관찰: {item.observationEvidence}</small></div>)}{result.playNameLearningTip && <p>{result.playNameLearningTip}</p>}<small>실제 놀이 맥락과 비교해 골라 주세요. 원래 놀이명은 그대로 유지됩니다.</small></details>
    </div>
  </aside>;
}
