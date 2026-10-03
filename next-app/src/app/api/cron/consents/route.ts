import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONSENT_BUCKET, readConsent } from "@/lib/confidentiality";
export async function GET(request:Request) {
  const secret=process.env.CRON_SECRET;
  const expected=Buffer.from(`Bearer ${secret||""}`); const actual=Buffer.from(request.headers.get("authorization")||"");
  if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected)) return Response.json({}, {status:401});
  try {
    const store=createAdminClient().storage.from(CONSENT_BUCKET); let offset=0; let removed=0;
    for(;;) {
      const {data,error}=await store.list("",{limit:100,offset,sortBy:{column:"name",order:"asc"}}); if(error) throw error;
      const names:string[]=[];
      for(const file of data||[]) { if(!/^[0-9a-f-]{36}\.json$/.test(file.name)) continue; const row=await readConsent(file.name.slice(0,-5)); if(!row) throw new Error("Receipt unavailable"); if(Date.parse(row.expiresAt)<=Date.now()) names.push(file.name); }
      if(names.length) { const result=await store.remove(names); if(result.error) throw result.error; removed+=names.length; }
      if(!data||data.length<100) break; offset+=data.length-names.length;
    }
    let recoveryOffset=0;
    for(;;){
      const batch=await store.list("recovery",{limit:100,offset:recoveryOffset,sortBy:{column:"name",order:"asc"}});
      if(batch.error) throw batch.error;
      const expired=(batch.data||[]).filter(file=>/^\d+-[a-f0-9]{64}\.json$/.test(file.name)&&Number(file.name.split("-")[0])+2<=Math.floor(Date.now()/3600000)).map(file=>`recovery/${file.name}`);
      if(expired.length){const result=await store.remove(expired);if(result.error)throw result.error;}
      if(!batch.data||batch.data.length<100)break;
      recoveryOffset+=batch.data.length-expired.length;
    }
    return Response.json({removed},{headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({error:"동의 기록 정기 파기에 실패했습니다."},{status:503}); }
}
