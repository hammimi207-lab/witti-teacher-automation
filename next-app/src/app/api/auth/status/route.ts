import {createClient} from "@/lib/supabase/server";
export async function GET(){
 try { const {data,error}=await (await createClient()).auth.getUser();return Response.json({signedIn:!error&&!!data.user,email:!error?data.user?.email:null},{headers:{"Cache-Control":"private, no-store"}}); }
 catch{return Response.json({error:"로그인 상태 확인에 실패했습니다."},{status:503});}
}
