"use client";
import { useState } from "react";

export function GuestEntry() {
  const [opened, setOpened] = useState(false);
  return <section className="panel" style={{ maxWidth: 520, margin: "24px auto" }} aria-label="비회원 이용">
    <button type="button" className="button secondary" aria-expanded={opened} onClick={() => setOpened(true)}>비회원으로 이용하기</button>
    {opened && <div role="status" style={{ marginTop: 16 }}>
      <p><strong>기록은 작성할 수 있지만, 작성한 내용은 저장되지 않아요.</strong></p>
      <p>새로고침하거나 화면을 떠나면 내용이 사라집니다. 필요한 글은 미리 복사해 주세요.</p>
      <p>처음 이용하신다면 비밀유지 동의를 먼저 진행해 주세요.</p>
      <a className="button primary" href="/records/new?guest=1">확인하고 기록하기</a>
    </div>}
  </section>;
}
