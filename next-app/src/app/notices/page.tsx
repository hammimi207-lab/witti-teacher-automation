import { createAdminClient } from "@/lib/supabase/admin";
import { visible, type ContentRecord } from "@/lib/platform-content";
import { signContent } from "@/lib/platform-content-server";
import { ContentPreview } from "@/features/admin/content-preview";
export const dynamic = "force-dynamic";
export default async function NoticesPage() {
  let notices: ContentRecord[] = []; let failed = false;
  try {
    const db = createAdminClient();
    for (let page = 0; ; page++) {
      const { data, error } = await db.from("platform_notices").select("*").eq("is_active", true).eq("deleted", false).order("is_pinned", { ascending: false }).order("id", { ascending: false }).range(page * 100, page * 100 + 99);
      if (error) throw error;
      notices.push(...(data as ContentRecord[]).filter(row => visible(row))); if (data.length < 100) break;
    }
    notices = await Promise.all(notices.map(signContent));
  } catch { failed = true; }
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">공지사항</span><h1>서비스 소식</h1><p>서비스 이용 안내와 운영 소식을 확인하세요.</p></header><section className="record-list">{notices.map(notice => <article className="panel" id={`notice-${notice.id}`} key={notice.id}><small>{notice.is_pinned ? "고정 공지 · " : ""}{notice.notice_level}</small><h2>{notice.title}</h2><ContentPreview record={notice} /></article>)}{!notices.length && <section className="panel"><p>{failed ? "공지를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." : "현재 게시 중인 공지가 없습니다."}</p></section>}</section></main>;
}
