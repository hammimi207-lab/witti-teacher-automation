import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PhotoGallery } from "@/features/records/photo-gallery";
export const dynamic = "force-dynamic";
export default async function PhotosPage() {
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user) redirect("/login");
  return <main className="shell page-shell"><header className="page-title"><h1>내 사진 관리</h1><p>기록과 함께 보관한 사진을 확인하고 정리해요.</p><Link className="library-view-all" href="/records">내 기록으로 돌아가기</Link></header><section className="panel"><PhotoGallery /></section></main>;
}
