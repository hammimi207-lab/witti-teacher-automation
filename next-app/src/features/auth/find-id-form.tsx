"use client";
import {useState,type FormEvent} from "react";
export function FindIdForm(){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");const fields=new FormData(event.currentTarget);try{const r=await fetch("/api/auth/find-id",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:fields.get("email")})});const d=await r.json();setMessage(d.message||d.error);}catch{setMessage("연결을 확인하고 다시 시도해 주세요.");}finally{setBusy(false);}}
 return <form className="panel recovery-form" onSubmit={submit}><label className="field">가입 이메일<input name="email" type="email" required autoComplete="email" /></label><p>가입하신 이메일로 아이디를 보내드립니다. 이메일 주소로 바로 로그인하셔도 됩니다.</p><button className="button primary" disabled={busy}>{busy?"확인 중…":"아이디 안내 메일 받기"}</button><p role="status">{message}</p><p>가입 이메일도 기억나지 않으면 <a href="mailto:hammimi207@gmail.com">운영자에게 문의해 주세요.</a></p></form>;
}
