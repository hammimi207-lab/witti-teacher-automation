"use client";
import { CommonActivity } from "./common-activity";
import type { RecordInput } from "./schema";
type NoticeField = "dailyObservation" | "playObservation" | "activityObservation" | "commonActivity";
export function NoticeObservations({ input, onChange, disabled, userId }: {
  userId: string; disabled?: boolean; input: Pick<RecordInput, NoticeField> & { writingDate?: string };
  onChange: (field: NoticeField, value: string) => void;
}) {
  return <section className="field full story-details" aria-labelledby="notice-observations-title">
    <div className="detail-heading"><b id="notice-observations-title">교사가 관찰한 오늘의 하루</b><span>한 번 적은 관찰을 생성에 그대로 활용해요. 비워 둔 영역은 생략해요.</span></div>
    {([
      ["dailyObservation", "일상", "식사, 배변, 낮잠, 건강, 기본생활 등"],
      ["playObservation", "놀이", "자유놀이, 또래 관계, 관심과 탐색 등"],
      ["activityObservation", "활동", "교사가 제공한 활동, 행사, 바깥놀이 등"],
    ] as const).map(([key, label, hint]) => <label className="field" key={key} htmlFor={key}>{label} <small>{hint}</small>
      <textarea id={key} rows={4} maxLength={5000} disabled={disabled} value={input[key]} onChange={event => onChange(key, event.target.value)} placeholder="직접 관찰한 내용을 자유롭게 적어 주세요. 시간 정보가 있으면 함께 적어 주세요." />
    </label>)}
    {userId ? <CommonActivity userId={userId} writingDate={input.writingDate} value={input.commonActivity || ""} onChange={text => onChange("commonActivity", text)} /> : <label>반 공통 활동 <small>아이별 반응은 위에 한 번만 적어 주세요.</small><textarea value={input.commonActivity || ""} maxLength={3000} rows={3} onChange={event => onChange("commonActivity", event.target.value)} /></label>}
  </section>;
}
