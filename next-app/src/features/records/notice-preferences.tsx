"use client";

import { PARENT_TYPES } from "./constants";
import { TEACHER_STYLES } from "./notice-style";

const parentDescriptions = {
  일반형: "따뜻하고 자연스럽게 전달해요",
  예민형: "사실을 섬세하고 중립적으로 전해요",
  공격형: "판단 없이 사실과 지원을 명료하게 전해요",
  불안형: "차분하게 상황과 돌봄을 설명해요",
};

export function NoticePreferences({ parentType, teacherStyle, disabled, onParentChange, onStyleChange }: {
  parentType: string; teacherStyle: string; disabled: boolean;
  onParentChange: (value: typeof PARENT_TYPES[number]) => void;
  onStyleChange: (value: typeof TEACHER_STYLES[number]["label"]) => void;
}) {
  const count = Number(!!parentType) + Number(!!teacherStyle);
  return <section className="notice-preferences field full" id="noticePreferences" tabIndex={-1} aria-labelledby="notice-preferences-title">
    <div className="notice-preferences-heading"><h2 id="notice-preferences-title">알림장 쓰기 전, 두 가지만 선택해 주세요</h2><strong role="status">{count}/2 선택 완료</strong></div>
    <fieldset disabled={disabled}><legend>1. 보호자 전달 유형 <span>필수</span></legend>
      <div className="notice-preference-grid">{PARENT_TYPES.map(type => <label className="notice-preference-card" key={type}>
        <input type="radio" name="noticeParentType" checked={parentType === type} onChange={() => onParentChange(type)} />
        <span><b>{type}{parentType === type && " ✓"}</b><small>{parentDescriptions[type]}</small></span>
      </label>)}</div>
    </fieldset>
    <fieldset disabled={disabled}><legend>2. 교사의 알림장 기록 스타일 <span>필수</span></legend>
      <div className="notice-preference-grid">{TEACHER_STYLES.map(style => <label className="notice-preference-card" key={style.label}>
        <input type="radio" name="noticeTeacherStyle" checked={teacherStyle === style.label} onChange={() => onStyleChange(style.label)} />
        <span><b>{style.label}{teacherStyle === style.label && " ✓"}</b><small>{style.description}</small></span>
      </label>)}</div>
    </fieldset>
    <p>{count === 2 ? "선택한 방식으로 알림장을 만들어요. 언제든 바꿀 수 있어요." : "각 항목에서 하나씩 선택하면 아래 작성란이 열려요."}</p>
  </section>;
}
