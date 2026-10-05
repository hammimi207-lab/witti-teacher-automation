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
      { id: "basic", label: "기본 인사", candidates: ["안녕하세요. 오늘 아이의 하루를 전해 드립니다. 😊", "안녕하세요. 아이와 함께한 오늘의 이야기를 나눕니다. 💛", "안녕하세요. 오늘의 작은 순간들을 알림장에 담았습니다. 🌱", "안녕하세요. 가정에 평안이 함께하시길 바랍니다. 🌷"] },
      { id: "season", label: "계절 인사", candidates: season === "봄" ? ["봄의 시작과 함께 인사드립니다. 🌷", "따뜻한 봄날, 오늘의 이야기를 전해 드립니다. 🌸", "새봄을 맞아 가정에 기쁨이 함께하시길 바랍니다. 🌱", "꽃이 피는 계절, 가족 모두 평안하시길 바랍니다. 🌼"] : season === "여름" ? ["여름을 맞아 오늘의 이야기를 전해 드립니다. ☀️", "더운 날씨에 가족 모두 건강하시길 바랍니다. 💧", "여름날에도 가정에 편안함이 함께하시길 바랍니다. 🌿", "밝은 여름의 하루, 아이의 이야기를 전합니다. 🌻"] : season === "가을" ? ["가을을 맞아 오늘의 이야기를 전해 드립니다. 🍁", "깊어가는 가을, 가정에 평안이 함께하시길 바랍니다. 🍂", "풍성한 가을처럼 마음에도 여유가 가득하시길 바랍니다. 🌾", "가을날의 작은 이야기를 알림장에 담았습니다. 🍎"] : ["겨울을 맞아 오늘의 이야기를 전해 드립니다. ❄️", "추운 계절에도 가족 모두 건강하시길 바랍니다. 🧣", "겨울날, 가정에 따뜻함이 함께하시길 바랍니다. 💛", "한 해의 끝자락에 평안이 가득하시길 바랍니다. ✨"] },
      { id: "weather", label: "날씨 인사 · 직접 확인", candidates: ["날씨가 변하는 시기, 가족 모두 건강하시길 바랍니다. 🌿", "오늘도 가정에 평안이 함께하시길 바랍니다. 💛", "맑은 날, 가족의 하루에도 밝은 기쁨이 함께하시길 바랍니다. ☀️", "비 오는 날에도 마음만은 따뜻하고 평안하시길 바랍니다. ☔", "쌀쌀한 날씨에 가족 모두 건강하시길 바랍니다. 🧣"] },
      { id: "seollal", label: "설날 인사", recommended: Boolean(festival && /설날/.test(festival.name)), candidates: ["설날을 맞아 가정에 건강과 평안이 가득하시길 바랍니다. 🧧", "새해에도 가족 모두 행복하시길 바랍니다. 🌅", "따뜻한 정을 나누는 설 명절 보내시길 바랍니다. 💛", "설날의 기쁨과 새해의 희망이 가정에 함께하시길 바랍니다. ✨"] },
      { id: "chuseok", label: "추석 인사", recommended: Boolean(festival && /추석/.test(festival.name)), candidates: ["추석을 맞아 풍성하고 따뜻한 인사를 전합니다. 🌕", "보름달처럼 가정에 행복이 가득하시길 바랍니다. 🌕", "한가위를 맞아 가족 모두 건강하고 평안하시길 바랍니다. 🌾", "넉넉한 마음을 나누는 추석 명절 보내시길 바랍니다. 🍁"] },
      { id: "custom", label: "직접 작성", candidates: [""] },
      { id: "none", label: "사용 안 함", candidates: [""] },
    ] as GreetingOption[],
    closing: [
      { id: "basic", label: "기본 마무리", candidates: ["오늘의 이야기를 함께 읽어 주셔서 감사합니다. 💛", "가정에서도 편안한 시간 보내시길 바랍니다. 🌷", "가족과 따뜻한 저녁 보내시길 바랍니다. 🌙", "오늘도 가정에 평안이 함께하시길 바랍니다. 🌿"] },
      { id: "weekend", label: "주말 인사", candidates: ["가족과 함께 편안한 주말 보내시길 바랍니다. 🌿", "다가오는 주말에도 따뜻한 이야기 나누시길 바랍니다. 💛", "주말 동안 충분히 쉬시고 건강한 시간 보내시길 바랍니다. ☕", "가족의 웃음이 함께하는 행복한 주말 보내시길 바랍니다. 😊"], recommended: weekend },
      { id: "holiday", label: "연휴 인사", candidates: ["가족과 함께 평안한 연휴 보내시길 바랍니다. 🌿", "쉬어가는 시간에 몸과 마음의 여유를 찾으시길 바랍니다. ☕", "연휴 동안 가족과 따뜻한 추억 나누시길 바랍니다. 💛", "건강하고 안전한 연휴 보내시길 바랍니다. 🌷"], recommended: upcoming.length > 0 },
      { id: "seollal", label: "설날 인사", recommended: Boolean(festival && /설날/.test(festival.name)), candidates: ["새해 복 많이 받으시길 바랍니다. 🧧", "가족과 함께 따뜻하고 평안한 설 명절 보내시길 바랍니다. 💛", "새해에도 가정에 건강과 행복이 가득하시길 바랍니다. 🌅", "설날의 따뜻한 정이 오래도록 함께하시길 바랍니다. ✨"] },
      { id: "chuseok", label: "추석 인사", recommended: Boolean(festival && /추석/.test(festival.name)), candidates: ["가족과 함께 풍성하고 평안한 한가위 보내시길 바랍니다. 🌕", "보름달처럼 넉넉한 마음을 나누는 추석 보내시길 바랍니다. 🌾", "추석 연휴 동안 가정에 건강과 행복이 함께하시길 바랍니다. 🍁", "가족과 따뜻한 추억을 나누는 한가위 보내시길 바랍니다. 💛"] },
      { id: "gratitude", label: "감사 인사", candidates: ["늘 함께해 주시는 보호자님께 감사드립니다. 🌷", "아이의 하루를 함께 살펴 주셔서 감사합니다. 💛", "따뜻한 관심과 신뢰에 감사드립니다. 🌿", "가정과 함께 아이의 성장을 나눌 수 있어 감사합니다. 🌱"] },
      { id: "health", label: "건강·안부 인사", candidates: ["가족 모두 건강하고 평안하시길 바랍니다. 🌿", "바쁜 일상 속에서도 편안한 시간 보내시길 바랍니다. ☕", "오늘도 몸과 마음이 건강하시길 바랍니다. 💛", "가정에 따뜻한 웃음과 평안이 함께하시길 바랍니다. 😊"] },
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
