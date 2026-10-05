import { addDays, validWritingDate, type Holiday } from "../features/records/notice-workflow";

const months = new Map<string, { expires: number; days: Holiday[] }>();
export async function koreanHolidays(date: string, key = process.env.KOREAN_HOLIDAY_API_KEY, fetcher = fetch): Promise<{ holidays: Holiday[]; available: boolean }> {
  if (!key || !validWritingDate(date)) return { holidays: [], available: false };
  try {
    const range = [...new Set([date.slice(0, 7), addDays(date, 3).slice(0, 7)])];
    const days = await Promise.all(range.map(async month => {
      const cached = months.get(month);
      if (cached && cached.expires > Date.now()) return cached.days;
      const url = new URL("https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo");
      // Use the decoded service key in configuration; URLSearchParams encodes it once.
      url.search = new URLSearchParams({ serviceKey: key, solYear: month.slice(0, 4), solMonth: month.slice(5), numOfRows: "100", pageNo: "1", _type: "json" }).toString();
      const response = await fetcher(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
      if (!response.ok) throw new Error("Holiday lookup failed");
      const raw = await response.text();
      let result: Holiday[];
      if (raw.trim().startsWith("{")) {
        const payload = JSON.parse(raw).response;
        if (String(payload?.header?.resultCode) !== "00") throw new Error("Invalid holiday response");
        const items = payload.body?.items?.item || [];
        result = (Array.isArray(items) ? items : [items]).filter(item => item.isHoliday === "Y").map(item => ({ date: String(item.locdate).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"), name: String(item.dateName) }));
      } else {
        if (!/<resultCode>00<\/resultCode>/.test(raw)) throw new Error("Invalid holiday response");
        result = [...raw.matchAll(/<item>([\s\S]*?)<\/item>/g)].filter(match => /<isHoliday>Y<\/isHoliday>/.test(match[1])).map(match => ({
          date: (match[1].match(/<locdate>(\d{8})<\/locdate>/)?.[1] || "").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
          name: match[1].match(/<dateName>([^<]*)<\/dateName>/)?.[1] || "공휴일",
        }));
      }
      if (result.some(day => !validWritingDate(day.date))) throw new Error("Invalid holiday date");
      if (months.size > 48) months.clear();
      months.set(month, { expires: Date.now() + 6 * 60 * 60 * 1000, days: result });
      return result;
    }));
    return { holidays: days.flat(), available: true };
  } catch { return { holidays: [], available: false }; }
}
