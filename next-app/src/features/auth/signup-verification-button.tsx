"use client";
import { useState } from "react";

export function SignupVerificationButton() {
  const [showNotice, setShowNotice] = useState(false);
  return <>
    <button type="button" className="button primary" onClick={() => setShowNotice(true)} aria-describedby={showNotice ? "signup-verification-notice" : undefined}>이메일 인증 후 회원가입 가능</button>
    {showNotice && <p id="signup-verification-notice" role="status">현재 회원가입 서버 연결이 완료되지 않아 인증을 시작할 수 없습니다. 관리자 설정이 필요합니다. 입력한 내용은 유지됩니다.</p>}
  </>;
}
