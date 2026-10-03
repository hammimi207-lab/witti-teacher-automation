import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileForm } from "@/features/auth/profile-form";
export const dynamic = "force-dynamic";
export default async function MyPage() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const result = await createAdminClient().from("subscribers").select("display_name,subscriber_name,username,institution_name,position,mailing_agree").eq("user_id", data.user.id).eq("deleted", false).maybeSingle();
  const profile = result.data;
  return <main className="shell page-shell"><header className="page-title"><h1>마이페이지</h1><p>가입할 때 입력한 내 정보를 확인하고 수정해요.</p></header>
    {result.error || !profile ? <p className="error" role="alert">가입 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p> : <ProfileForm profile={{ name: profile.display_name || profile.subscriber_name || "", username: profile.username || "", email: data.user.email || "", institution: profile.institution_name || "", position: profile.position || "", mailing: String(profile.mailing_agree).toLowerCase() === "true" }} />}
  </main>;
}
