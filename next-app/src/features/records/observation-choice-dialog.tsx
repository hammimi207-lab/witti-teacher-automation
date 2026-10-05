"use client";

import { useEffect, useRef } from "react";

export function ObservationChoiceDialog({ onChoose, onWriteNotice, saveTargetRef, saving = false }: { onChoose: (keep: boolean) => void; onWriteNotice?: () => void; saveTargetRef?: (node: HTMLDivElement | null) => void; saving?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="observation-choice-dialog" aria-labelledby="observation-choice-title" aria-describedby="observation-choice-description" onCancel={(event) => { event.preventDefault(); if (!saving) onChoose(true); }}>
    {onWriteNotice ? <>
      <h2 id="observation-choice-title">알림장을 작성하시겠습니까?</h2>
      <p id="observation-choice-description">현재 아이의 <strong>관찰 장면을 다시 입력하지 않고 이어서</strong> 보호자에게 전할 글을 작성할 수 있어요.</p>
      <ul className="observation-choice-guide notice-guide"><li><strong>현재 아이의 관찰 재사용</strong><span>관찰과 입력한 해석·지원은 알림장으로 이어집니다. 사진은 필요한 경우 다시 등록해 주세요.</span></li><li><strong>일상·놀이·활동과 전체 공지</strong><span>추가 관찰은 세 영역에 자유롭게 적고, 공지와 서두·마무리 인사를 선택해요.</span></li></ul>
      <div className="notice-save-reminder"><p className="observation-choice-note">저장하지 않으면 앞서 작성된 내용은 초기화됩니다.</p><div ref={saveTargetRef} /></div>
      <p className="observation-choice-note">이미 저장한 기록은 유지되며, ‘내 기록’에서 확인할 수 있습니다.</p>
      <div className="observation-choice-actions"><button type="button" className="button primary" autoFocus disabled={saving} onClick={onWriteNotice}>관찰을 이어서 알림장 작성하기</button><button type="button" className="button secondary" disabled={saving} onClick={() => onChoose(true)}>지금은 하지 않기</button></div>
    </> : <>
    <h2 id="observation-choice-title">다음 아이의 기록을 작성할까요?</h2>
    <p id="observation-choice-description">현재 글을 계속 검토하거나, 작성 내용을 모두 비우고 새 기록을 시작할 수 있어요.</p>
    <ul className="observation-choice-guide"><li><strong>유지</strong><span>현재 아이의 글을 계속 검토해요.</span></li><li><strong>전체 초기화</strong><span>아이 이름·연령·기록 유형·생활·관찰·해석·지원·공지·공통 활동·사진과 동의 선택을 모두 비워요.</span></li></ul>
    <p className="observation-choice-note">이 화면의 작성 내용과 임시 저장을 비웁니다. 내 기록에 저장한 기록과 사진은 유지됩니다.</p>
    <div className="observation-choice-actions"><button type="button" className="button primary" autoFocus disabled={saving} onClick={() => onChoose(true)}>현재 글 계속 보기</button><button type="button" className="button secondary" disabled={saving} onClick={() => onChoose(false)}>전체 초기화 · 새 기록 작성</button></div>
    </>}
  </dialog>;
}
