import "server-only";
import nodemailer from "nodemailer";

export function verificationMailer() {
  const user = process.env.SMTP_EMAIL || process.env.SMTP_sender;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_password;
  if (user !== "witti7942@gmail.com" || !pass) throw new Error("기록요정 SMTP 설정을 확인해 주세요.");
  return nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000 });
}

export async function sendVerificationMail(email: string, code: string, purpose: "signup" | "password") {
  if (!/^\d{6}$/.test(code)) throw new Error("잘못된 인증번호 형식입니다.");
  const label = purpose === "signup" ? "회원가입" : "비밀번호 재설정";
  const delivery = await verificationMailer().sendMail({
    from: '"기록요정" <witti7942@gmail.com>', to: email,
    subject: `[기록요정] ${label} 이메일 인증번호 안내`,
    text: `기록요정 ${label} 인증번호는 ${code}입니다. 5분 이내에 입력해 주세요. 요청하지 않으셨다면 이 메일을 무시해 주세요.`,
    html: `<html><body style="font-family:'Malgun Gothic',sans-serif;background:#f7f8fc;padding:40px 20px;color:#222"><div style="max-width:520px;margin:auto;background:white;border-radius:20px;padding:40px 32px"><h1 style="color:#1f2c4f;font-size:28px">🌿 기록요정</h1><h2 style="font-size:20px">${label} 이메일 인증번호 안내</h2><p style="line-height:1.8">아래 인증번호를 입력해 인증을 완료해 주세요.</p><div style="background:#f2f5ff;border:2px dashed #8ea8ff;border-radius:16px;padding:24px;text-align:center"><span style="font-size:14px">인증번호</span><p style="font-size:38px;letter-spacing:8px;color:#304ffe;font-weight:800">${code}</p></div><p style="font-size:14px;line-height:1.7">인증번호는 5분 동안 유효합니다.<br>요청하지 않으셨다면 이 메일을 무시해 주세요.</p></div></body></html>`,
  });
  if (!delivery.accepted?.some(address => String(address).toLowerCase() === email.toLowerCase()) || delivery.rejected?.length) {
    throw new Error("메일 서버가 수신 주소를 수락하지 않았습니다.");
  }
}
