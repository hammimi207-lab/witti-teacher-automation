import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { savedEnvelopeSchema } from "@/features/records/save-contract";
import { SteamWorkflow } from "@/features/steam/workflow";

export const dynamic = "force-dynamic";
export default async function SteamPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login?next=/records/steam");
  const { session } = await searchParams;
  let initial = null;
  if (session) {
    if (!/^[0-9a-f-]{36}$/i.test(session)) return <main className="shell page-shell"><p role="alert">기록 주소를 확인해 주세요.</p></main>;
    const record = await client.from("generated_texts").select("result_text").eq("user_id", data.user.id).eq("session_id", session).eq("deleted", false).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
    try { const envelope = savedEnvelopeSchema.parse(JSON.parse(record.data?.result_text || "null")); if (envelope.steam) initial = envelope; } catch { /* Display a safe unavailable state. */ }
    if (!initial) return <main className="shell page-shell"><p role="alert">기록이 만료·삭제되었거나 불러올 수 없습니다.</p></main>;
  }
  return <main className="shell page-shell"><header className="page-title"><span className="section-kicker">기록 요정</span><h1>STEAM 적용하기</h1><p>놀이 사진에서 배움의 가능성을 살펴보고, 다음 놀이와 관찰기록으로 이어가요.</p></header><SteamWorkflow key={session || data.user.id} userId={data.user.id} initial={initial} /></main>;
}
