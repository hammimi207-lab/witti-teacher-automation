import type { ReactNode } from "react";
import { Eye, Sprout, Compass, HandHeart, RefreshCw } from "lucide-react";
import type { WeeklyResult, WeeklySource } from "./weekly-story";

export function WeeklyPlayMap({ result, playIndex, sources, direction, support, response, actions }: {
  result: WeeklyResult; playIndex: number; sources: WeeklySource[]; direction: string;
  support?: ReactNode; response?: ReactNode; actions?: ReactNode;
}) {
  const play = result.plays[playIndex];
  const interests = result.interests.filter(interest => interest.sourceIds.some(id => play.sourceIds.includes(id)));
  const related = sources.filter(source => play.sourceIds.includes(source.id));
  return <section className="weekly-play-map" aria-label="우리 반 놀이 흐름 지도">
    <header><span className="section-kicker">아이들의 흥미를 따라 이어가는 놀이</span><h3>우리 반 놀이 흐름 지도</h3><p>{play.title}</p></header>
    <p className="play-map-guide">관찰에서 배움을 읽고, 지원한 뒤 아이의 반응에 따라 다시 조정해요. 정해진 활동을 차례대로 완수하는 계획이 아니에요.</p>
    <ol className="play-map-path">
      <li className="play-map-node map-interest"><span className="map-stage"><Eye size={18} aria-hidden="true" />01 · 관찰에서 출발</span><h4>아이들이 보인 흥미</h4>
        {interests.length ? interests.map((interest, i) => <div key={i}><strong>{interest.interest}</strong><details><summary>흥미의 관찰 근거 · 주간 분석</summary><p>{interest.evidence}</p></details></div>) : <p>흥미를 단정하지 않고 아래 실제 관찰 장면부터 살펴봐요.</p>}
        <details><summary>아이별 실제 관찰 원문 {related.length}건</summary>{related.map(source => <div key={source.id}><small>{source.childAlias} · {source.date} 저장</small><p>{source.observation}</p></div>)}</details>
      </li>
      <li className="play-map-node map-learning"><span className="map-stage"><Sprout size={18} aria-hidden="true" />02 · 놀이에서 배움 읽기</span><h4>이 경험을 어떻게 이해할까요?</h4><p>{play.teacherInterpretation || "아이가 무엇을 보고, 시도하고, 표현했는지 실제 장면을 바탕으로 함께 살펴봐요."}</p><small>교사의 해석과 주간 분석 · 관찰 사실과 구분해 검토해요.</small>
        <details><summary>표준보육과정과 함께 살펴보기</summary><p>신체운동·건강, 의사소통, 사회관계, 예술경험, 자연탐구의 경험을 놀이 안에서 통합적으로 살펴봐요. 모든 영역을 채우거나 영역을 활동 순서로 정하지 않아요.</p><p>0~2세는 2024 개정 표준보육과정의 해당 연령 내용을, 3~5세는 누리과정을 기준으로 검토해요.</p></details>
      </li>
      <li className="play-map-node map-direction"><span className="map-stage"><Compass size={18} aria-hidden="true" />03 · 이어갈 가능성</span><h4>{direction}</h4><p>{play.nextSupportPlan}</p><small>교사의 기존 계획과 AI 제안을 함께 검토해요. 아직 실행한 사실은 아니에요.</small></li>
      <li className="play-map-node map-support"><span className="map-stage"><HandHeart size={18} aria-hidden="true" />04 · 교사의 지원 계획</span><h4>놀이가 이어지도록 준비해요</h4><div className="map-support-tags"><span>시간</span><span>공간</span><span>자료</span><span>상호작용</span></div>
        {support || <p>위의 교사 계획이나 지원 아이디어를 선택하면 이곳에서 실제로 준비할 지원을 조정하고 저장할 수 있어요.</p>}
      </li>
      <li className="play-map-node map-response"><span className="map-stage"><Eye size={18} aria-hidden="true" />05 · 지원 후 다시 관찰</span><h4>아이의 반응을 살펴봐요</h4>{response || <p>지원 뒤 아이가 한 말·행동·표정, 놀이가 이어지거나 바뀐 장면을 살펴봐요. 아직 관찰하지 않은 반응은 사실로 적지 않아요.</p>}<small>예상한 변화가 없어도 아이가 선택한 놀이를 충분히 존중해요.</small></li>
    </ol>
    <div className="play-map-return"><RefreshCw size={20} aria-hidden="true" /><div><strong>아이의 반응에서 다시 출발해요</strong><p>흥미가 이어지면 충분히 지속하도록 돕고, 새 관심이 보이면 방향을 조정해요. 다음 관찰과 지원 계획으로 연결해요.</p></div></div>
    {actions}
    <p className="play-map-source">2024 개정 표준보육과정의 관찰·배움 이해·지원·평가를 참고해 구성한 지도입니다. 공식 단계 도식을 그대로 옮긴 것은 아닙니다. <a href="https://i-nuri.go.kr/teacher/board/view.do?board_idx=4329&manage_idx=137&menu_idx=20" target="_blank" rel="noreferrer">실행자료 보기</a></p>
  </section>;
}
