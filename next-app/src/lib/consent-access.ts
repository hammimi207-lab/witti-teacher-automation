import "server-only";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { REMEMBER_COOKIE, sessionCookieOptions } from "@/lib/supabase/session-policy";
import { CONSENT_COOKIE, consentId, consentToken, readConsent, validConsent } from "./confidentiality";

export async function restoreConsent(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(CONSENT_COOKIE)?.value || "";
  const cookieValid = await validConsent(token);
  const {url,key} = getSupabaseConfig();
  const client = createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:items=>items.forEach(({name,value,options})=>{request.cookies.set(name,value);response.cookies.set(name,value,sessionCookieOptions(options,request.cookies.get(REMEMBER_COOKIE)?.value));})}});
  const {data,error} = await client.auth.getUser();
  if(error || !data.user) return cookieValid;
  const user = data.user;
  const linked = user.app_metadata?.girok_consent_id;
  let id: string | null = null;
  if(cookieValid) {
    const candidate = consentId(token)!;
    const row = await readConsent(candidate);
    // An entered email alone never restores consent; require both its signed receipt and authenticated account.
    if(row?.email === user.email?.toLowerCase()) {
      id = candidate;
      if(linked !== id) {
        const result = await createAdminClient().auth.admin.updateUserById(user.id,{app_metadata:{girok_consent_id:id}});
        if(result.error) throw new Error("Consent account link failed");
      }
    }
  }
  if(!id && typeof linked === "string" && /^[0-9a-f-]{36}$/.test(linked) && await validConsent(consentToken(linked))) {
    const row = await readConsent(linked);
    if(row?.email === user.email?.toLowerCase()) id=linked;
  }
  if(!id) return false;
  const row = await readConsent(id);
  if(!row) return false;
  const restored = consentToken(id);
  request.cookies.set(CONSENT_COOKIE,restored);
  response.cookies.set(CONSENT_COOKIE,restored,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",expires:new Date(row.expiresAt)});
  return true;
}
