import { koreanHolidays } from "@/lib/korean-holidays";
import { greetingOptions, validWritingDate } from "@/features/records/notice-workflow";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") || "";
  if (!validWritingDate(date)) return Response.json({ error: "작성일을 확인해 주세요." }, { status: 400 });
  const calendar = await koreanHolidays(date);
  return Response.json({ date, ...greetingOptions(date, calendar.holidays), holidayAvailable: calendar.available, weatherAvailable: false }, { headers: { "Cache-Control": "no-store" } });
}
