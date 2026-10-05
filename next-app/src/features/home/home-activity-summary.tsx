export function HomeActivitySummary({ observations, observationDirty, photos, selected, onObservations, onPhotos }: {
  observations: number; observationDirty: boolean; photos: number; selected: number;
  onObservations: () => void; onPhotos: () => void;
}) {
  if (!observationDirty && !photos) return null;
  return <section className="home-activity" aria-label="현재 작업">
    {observationDirty && <button type="button" onClick={onObservations}>{observations ? `이 화면의 녹음 ${observations}개` : "작성 중인 관찰"} · 이어서 보기</button>}
    {photos > 0 && <button type="button" onClick={onPhotos}>열어 둔 사진 {photos}장 · {selected}장 선택</button>}
    <p>화면을 떠나면 현재 녹음·메모와 사진 선택 내용이 사라져요. 필요한 자료는 먼저 내려받아 주세요.</p>
  </section>;
}
