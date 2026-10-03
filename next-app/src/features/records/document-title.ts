export function documentTitle(createdAt?: string | null, childAlias?: string | null, recordType = "놀이 이야기") {
  let date = "생성일 미상";
  // Older records store a Korean display date, including 오전/오후, instead of ISO.
  const displayDate = createdAt?.match(/^(\d{4})[./년]\s*(\d{1,2})[./월]\s*(\d{1,2})(?:[.일]|\s|$)/);
  if (displayDate) {
    date = `${displayDate[1]}/${displayDate[2].padStart(2, "0")}/${displayDate[3].padStart(2, "0")}`;
  } else if (createdAt && !Number.isNaN(Date.parse(createdAt))) {
    const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(createdAt));
    date = ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("/");
  }
  return `${date} "${childAlias?.trim() || "아이"}"의 ${recordType}`;
}
