
import { HomeHero } from "@/features/home/home-hero";
import { QuickActionGrid } from "@/features/home/quick-action-grid";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { readQuickMenu, EMPTY_QUICK_MENU } from "@/features/home/quick-menu";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: "기록 요정 | 교사 기록 자동화",
    description: "영유아 교사를 위한 사진 기반 기록 자동화 서비스",
    siteName: "기록 요정",
    locale: "ko_KR",
    type: "website",
  },
};

export default async function Home() {
  let userId = "";
  let quickMenu = [...EMPTY_QUICK_MENU];
  if (hasSupabaseConfig()) {
    const { data, error } = await (await createClient()).auth.getUser();
    if (!error && data.user) { userId = data.user.id; quickMenu = readQuickMenu(data.user.user_metadata?.girok_quick_menu); }
  }
  return (
    <main className="home-page task-home shell">
      <HomeHero />
      <QuickActionGrid key={userId || "guest"} userId={userId} initialSlots={quickMenu} />
    </main>
  );
}
