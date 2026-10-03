import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import Link from "next/link";
import { Leaf, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import "./globals.css";
import { SiteNavigation } from "@/features/records/site-navigation";
import { LogoutButton } from "@/features/records/logout-button";
import { PublicAnnouncements } from "@/features/admin/public-announcements";
import { cookies } from "next/headers";
import { CONSENT_COOKIE, validConsent } from "@/lib/confidentiality";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "기록 요정 | 교사 기록 자동화",
  description: "영유아 교사를 위한 사진 기반 기록 자동화 서비스",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let loggedIn = false;
  const consented = await validConsent((await cookies()).get(CONSENT_COOKIE)?.value || "");
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      loggedIn = !error && Boolean(data.user);
    } catch {
      // 인증 확인 실패 시 로그인된 것으로 표시하지 않습니다.
    }
  }
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>
        <header className="site-header">
          <div className="shell nav-wrap">
            <Link href="/" className="brand"><span><Leaf size={19} /></span>기록 요정</Link>
            {consented && <SiteNavigation />}
            <div className="account-actions">
              {loggedIn ? <>
                <Link className="account-link is-signed-in" href="/mypage" aria-label="로그인됨 · 마이페이지로 이동"><UserRound size={17} /> 마이페이지</Link>
                <LogoutButton />
              </> : <>
                <Link className="account-link" href="/login"><UserRound size={17} /> 로그인</Link>
                <Link className="account-link" href="/signup">회원가입</Link>
              </>}
              {/* 인증 진입은 이전 화면의 클라이언트 라우터 캐시를 재사용하지 않습니다. */}
              <a className="admin-text-link" href="/admin/login">관리자</a>
            </div>
          </div>
        </header>
        {consented && <PublicAnnouncements />}
        {children}
        <footer><div className="shell"><b>기록 요정</b><div className="footer-info"><span>관찰과 해석을 다음 지원으로 잇는 교사 기록 도구입니다.</span><span>앱 구동 관련 문의: <a href="mailto:hammimi207@gmail.com">hammimi207@gmail.com</a></span></div></div></footer>
      </body>
    </html>
  );
}
