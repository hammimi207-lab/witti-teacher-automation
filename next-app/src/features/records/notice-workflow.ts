export function seoulToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}
export function validWritingDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export type Holiday = { date: string; name: string };
export type GreetingOption = { id: string; label: string; candidates: string[]; recommended?: boolean };
export function greetingOptions(date: string, holidays: Holiday[] = []) {
  if (!validWritingDate(date)) date = seoulToday();
  const month = Number(date.slice(5, 7));
  const season = month >= 3 && month <= 5 ? "봄" : month >= 6 && month <= 8 ? "여름" : month >= 9 && month <= 11 ? "가을" : "겨울";
  const upcoming = holidays.filter(day => day.date >= date && day.date <= addDays(date, 3));
  const festival = upcoming.find(day => /설날|추석/.test(day.name));
  const weekend = [5, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
  return {
    opening: [
      { id: "basic", label: "기본 인사", candidates: ["안녕하세요. 오늘 아이의 하루를 전해 드려요.", "안녕하세요. 오늘 함께한 이야기를 나눠요."] },
      { id: "season", label: "계절 인사", candidates: [`${season}을 맞아 인사드려요. 오늘의 이야기를 전해 드려요.`, `${season}의 하루, 안녕하세요. 아이의 하루를 함께 나눠요.`] },
      { id: "weather", label: "오늘의 날씨 인사", candidates: ["안녕하세요. 오늘 아이의 하루를 전해 드려요."] },
      { id: "custom", label: "직접 작성", candidates: [""] },
      { id: "none", label: "사용 안 함", candidates: [""] },
    ] as GreetingOption[],
    closing: [
      { id: "basic", label: "기본 마무리", candidates: ["오늘의 이야기를 함께 읽어 주셔서 감사해요.", "가정에서도 편안한 시간 보내세요."] },
      { id: "weekend", label: "주말 인사", candidates: ["가족과 함께 편안한 주말 보내세요.", "다가오는 주말에도 소소한 이야기 많이 나누세요."], recommended: weekend },
      { id: "holiday", label: "연휴·명절 인사", candidates: festival ? [`다가오는 ${festival.name.includes("추석") ? "추석" : "설날"}, 가족과 따뜻한 이야기 나누세요.`] : upcoming.length ? ["다가오는 공휴일에도 가족과 편안한 시간 보내세요."] : ["가족과 함께 편안한 시간 보내세요."], recommended: upcoming.length > 0 },
      { id: "custom", label: "직접 작성", candidates: [""] },
      { id: "none", label: "사용 안 함", candidates: [""] },
    ] as GreetingOption[],
  };
}
export function missingPlaceholders(text: string) {
  return [...new Set([...text.matchAll(/\{\{([^{}]+)\}\}/g)].map(match => match[1].trim()))];
}
// Source material is offered as a template, never as today's finished announcement.
export function reusableAnnouncement(content: string, childAlias = "") {
  let text = content;
  if (childAlias) text = text.split(childAlias).join("{{아동}} ");
  return text.replace(/\d{4}[./-]\s*\d{1,2}[./-]\s*\d{1,2}|(?:\d{4}년\s*)?\d{1,2}월\s*\d{1,2}일|\d{1,2}[./]\d{1,2}(?!\d)/g, "{{날짜}}")
    .replace(/\d{1,2}:\d{2}|(?:오전|오후)?\s*\d{1,2}시(?:\s*\d{1,2}분)?/g, "{{시간}}")
    .replace(/(?:오늘|내일|모레|이번 주|다음 주)(?:\s*[월화수목금토일]요일)?/g, "{{날짜}}")
    .replace(/[월화수목금토일]요일/g, "{{요일}}")
    .replace(/(?:아동|아이|이름)\s*[:：]\s*[가-힣A-Za-z]+/g, "아동: {{아동}}")
    .replace(/(?<![가-힣])[가-힣]{2,4}(?:어린이|친구|군|양)(?![가-힣])/g, "{{아동}}")
    .trim();
}
export function announcementTemplate(content: string) {
  return reusableAnnouncement(content)
    .replace(/(준비물\s*[:：]\s*)[^\n]+/g, "$1{{준비물}}")
    .replace(/(장소\s*[:：]\s*)[^\n]+/g, "$1{{장소}}")
    .replace(/(내용\s*[:：]\s*)[^\n]+/g, "$1{{내용}}");
}
// Called once immediately after generation. Saving/downloading never recomposes edited text.
export function assembleNotice(body: string, input: { openingGreeting?: string; closingGreeting?: string; classAnnouncement: string }) {
  return [input.openingGreeting?.trim(), body.trim(), input.classAnnouncement.trim() ? `【전체 공지】\n${input.classAnnouncement.trim()}` : "", input.closingGreeting?.trim()].filter(Boolean).join("\n\n");
}
