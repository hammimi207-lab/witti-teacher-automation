"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { safeLink } from "@/lib/platform-content";
type Popup = { id: number; url: string; link_url: string; image_alt_text: string; popup_position: string };
export function PublicAnnouncements() {
  const pathname = usePathname();
  const [data, setData] = useState<{ notices: { id: number; title: string }[]; popups: Popup[] }>({ notices: [], popups: [] });
  const [closed, setClosed] = useState<number[]>([]);
  useEffect(() => { if (pathname.startsWith("/admin")) return; let active = true; fetch("/api/platform/content", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(result => {
    if (!active || !result) return;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
    result.popups = result.popups.filter((popup: Popup) => { try { return localStorage.getItem(`witti.popup.${popup.id}`) !== today; } catch { return true; } }); setData(result);
  }).catch(() => {}); return () => { active = false; }; }, [pathname]);
  if (pathname.startsWith("/admin")) return null;
  const popups = data.popups.filter(popup => popup.url && !closed.includes(popup.id));
  return <>{pathname === "/" && !!data.notices.length && <aside className="shell public-notice-banner" aria-label="고정 공지">{data.notices.map(notice => <Link key={notice.id} href={`/notices#notice-${notice.id}`}>{notice.title}</Link>)}</aside>}{!!popups.length && <aside className={`public-popup-group position-${popups[0].popup_position || "center"}`} aria-label="방문 안내">{popups.map(popup => <section className="public-popup" key={popup.id}>{safeLink(popup.link_url) ? <a href={safeLink(popup.link_url)} target="_blank" rel="noopener noreferrer"><img src={popup.url} alt={popup.image_alt_text || "방문 안내 이미지"} /></a> : <img src={popup.url} alt={popup.image_alt_text || "방문 안내 이미지"} />}<div><button onClick={() => { try { localStorage.setItem(`witti.popup.${popup.id}`, new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date())); } catch {} setClosed([...closed, popup.id]); }}>오늘 하루 다시 열지 않기</button><button onClick={() => setClosed([...closed, popup.id])}>닫기</button></div></section>)}</aside>}</>;
}
