import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificationMailer } from "@/lib/verification-mail";
import { CONSENT_BUCKET } from "@/lib/confidentiality";
import { getSiteUrl } from "@/lib/site-url";
export async function POST(request: Request) {
  if(request.headers.get("origin") !== new URL(request.url).origin) return Response.json({error:"잘못된 요청입니다."},{status:403});
  const raw=await request.text();
  if(raw.length>1024) return Response.json({error:"입력 내용을 확인해 주세요."},{status:400});
  let body;try{body=JSON.parse(raw);}catch{return Response.json({error:"입력을 확인해 주세요."},{status:400});}
  const parsed=z.object({email:z.string().trim().email().max(254).transform(v=>v.toLowerCase())}).safeParse(body);
  if(!parsed.success) return Response.json({error:"가입 이메일을 입력해 주세요."},{status:400});
  try {
    const db=createAdminClient(); const email=parsed.data.email;
    const key=createHash("sha256").update(email).digest("hex");
    const hour=Math.floor(Date.now()/3600000);
    // Atomic reservation prevents repeated mail across server instances; no email stored in throttle data.
    const reserved=await db.storage.from(CONSENT_BUCKET).upload(`recovery/${hour}-${key}.json`,JSON.stringify({expiresAt:new Date(Date.now()+3600000).toISOString()}),{contentType:"application/json",upsert:false});
    if(reserved.error) {
      if(String(reserved.error.message).toLowerCase().includes("already exists") || String((reserved.error as {statusCode?:string}).statusCode)==="409") return Response.json({error:"요청을 이미 접수했습니다. 받은편지함과 스팸함을 확인하거나 1시간 후 다시 시도해 주세요."},{status:429});
      throw reserved.error;
    }
    const found=await db.from("subscribers").select("username,platform_member_id").eq("email",email).eq("deleted",false).limit(10);
    if(found.error) throw found.error;
    const ids=[...new Set((found.data||[]).map(row=>row.username||row.platform_member_id).filter(Boolean))];
    if(ids.length) {
      const mail=await verificationMailer().sendMail({from:'"기록 요정" <witti7942@gmail.com>',to:email,subject:"[기록 요정] 가입 아이디 안내",text:`가입하신 아이디: ${ids.join(", ")}\n\n가입 이메일로도 로그인할 수 있습니다.\n${getSiteUrl()}/login\n\n요청하지 않으셨다면 이 메일을 무시해 주세요.`});
      if(!mail.accepted?.length) throw new Error("Mail not accepted");
    }
    return Response.json({message:"가입 정보가 있다면 해당 이메일로 아이디를 보내드립니다. 받은편지함과 스팸함을 확인해 주세요."},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"아이디 안내를 처리하지 못했습니다. 잠시 후 다시 시도하거나 운영자에게 문의해 주세요."},{status:503});}
}
