"use client";
import { usePathname } from "next/navigation";

export function SiteNavigation() {
  const pathname = usePathname();
  const links = [["/records/new", "새 기록 만들기"], ["/records", "내 기록"], ["/records/weekly", "우리반 주간 놀이 이야기"], ["/notices", "공지사항"]];
  return <nav aria-label="주 메뉴">{links.map(([href, label]) => {
    const active = href === "/records" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return <a key={href} href={href} aria-current={active ? "page" : undefined}>{label}</a>;
  })}</nav>;
}
