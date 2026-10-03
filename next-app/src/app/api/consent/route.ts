import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONSENT_BUCKET, CONSENT_COOKIE, consentToken, type ConsentRecord } from "@/lib/confidentiality";
import { CONSENT_VERSION, NDA_TEXT, PRIVACY_TEXT } from "@/lib/confidentiality-terms";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({error:"잘못된 요청입니다."},{status:403});
  const raw = await request.text();
  if (raw.length > 4096) return NextResponse.json({error:"입력 내용이 너무 깁니다."},{status:413});
  let body; try { body = JSON.parse(raw); } catch { return NextResponse.json({error:"입력을 확인해 주세요."},{status:400}); }
  const parsed = z.object({name:z.string().trim().min(1).max(100),email:z.string().trim().email().max(254),phone:z.string().trim().max(20).transform(value=>value.replace(/[\s-]/g,"")).pipe(z.string().regex(/^(?:010\d{8}|01[16789]\d{7,8})$/)),version:z.literal(CONSENT_VERSION),ndaAccepted:z.literal(true),privacyAccepted:z.literal(true)}).safeParse(body);
  if (!parsed.success) return NextResponse.json({error:"이름, 이메일, 개인 휴대폰 번호(예: 010-1234-5678)와 두 가지 필수 동의를 확인해 주세요."},{status:400});
  try {
    const now = new Date(); const expiry = new Date(now); expiry.setUTCFullYear(expiry.getUTCFullYear()+1);
    const record: ConsentRecord = {...parsed.data,email:parsed.data.email.toLowerCase(),id:randomUUID(),acceptedAt:now.toISOString(),expiresAt:expiry.toISOString(),nda:NDA_TEXT,privacy:PRIVACY_TEXT,identityVerified:false};
    const {error} = await createAdminClient().storage.from(CONSENT_BUCKET).upload(`${record.id}.json`,JSON.stringify(record),{contentType:"application/json",upsert:false});
    if (error) throw error;
    const response = NextResponse.json({ok:true,receipt:record.id});
    response.headers.set("Cache-Control","no-store");
    response.cookies.set(CONSENT_COOKIE,consentToken(record.id),{httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"lax",path:"/",expires:expiry});
    return response;
  } catch { return NextResponse.json({error:"동의 기록 저장에 실패했습니다. 저장이 완료될 때까지 이용할 수 없습니다."},{status:503}); }
}
