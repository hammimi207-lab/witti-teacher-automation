import { FairyImage } from "../records/fairy-image";
export function HomeHero() {
  return <section className="task-hero" aria-labelledby="home-title">
    <div className="task-hero-heading">
      <span className="section-kicker">기록 요정 v2 작업 공간</span>
      <FairyImage className="task-hero-fairy" width={88} height={99} decorative={false} />
      <h1 id="home-title">관찰은 선생님이,<br /><span>정리는 기록 요정이.</span></h1>
    </div>
    <p>사진과 짧은 관찰을 남기면 기록요정이 알림장과 놀이 기록으로 정리해요.</p>
  </section>;
}
