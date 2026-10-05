import { z } from "zod";

export const referenceSchema = z.object({ doi: z.string(), title: z.string(), originalTitle: z.string().optional(), titleSource: z.string().url().optional(), koreanTitleMissing: z.boolean().optional(), authors: z.string(), year: z.number().nullable(), publication: z.string(), type: z.string(), url: z.string().url(), abstract: z.string(), matched: z.array(z.string()) });
export type PlayReference = z.infer<typeof referenceSchema>;
const clean = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&?amp;/g, "&").replace(/&#(\d+);/g, (_, code: string) => Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : " ").replace(/&(?:lt|gt|quot|apos);/g, " ").replace(/\s+/g, " ").trim();
const workSchema = z.object({ DOI: z.string(), title: z.array(z.string()), "original-title": z.array(z.string()).optional(), "alternative-title": z.array(z.string()).optional(), language: z.string().optional(), author: z.array(z.object({ given: z.string().optional(), family: z.string().optional(), name: z.string().optional() })).optional(), published: z.object({ "date-parts": z.array(z.array(z.number())) }).optional(), "container-title": z.array(z.string()).optional(), abstract: z.string().optional(), type: z.string() });
// Official Korean title checked against KCI by DOI on 2026-10-05.
const verifiedKoreanTitles: Record<string, { title: string; source: string }> = {
  "10.16978/ecec.2010.5.1.006": { title: "주제 제시에 따른 3세 유아의 쌓기놀이", source: "https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART001442951" },
};
export function readReferences(items: unknown[], query: string): PlayReference[] {
  const words = query.toLowerCase().split(/[^a-zA-Z가-힣]+/).filter(word => word.length > 2 && !["children", "child", "early", "childhood", "preschool", "toddler", "play"].includes(word));
  const seen = new Set<string>();
  return items.flatMap(item => {
    const parsed = workSchema.safeParse(item); if (!parsed.success) return [];
    const work = parsed.data, abstract = clean(work.abstract || ""), doi = work.DOI.trim();
    const titles = [...work.title, ...(work["original-title"] || []), ...(work["alternative-title"] || [])].map(clean).filter(Boolean);
    const verified = verifiedKoreanTitles[doi.toLowerCase()];
    const koreanTitle = verified?.title || titles.find(value => /[가-힣]/.test(value));
    const title = koreanTitle || titles[0] || "";
    const originalTitle = koreanTitle ? titles.find(value => value !== title && /[a-zA-Z]/.test(value)) : undefined;
    const domesticHint = Boolean(koreanTitle || work.language === "ko" || /[가-힣]/.test(JSON.stringify(work.author || [])));
    const text = `${titles.join(" ")} ${title} ${abstract}`.toLowerCase();
    if (!title || !/^10\.\d{4,9}\/\S+$/i.test(doi) || seen.has(doi.toLowerCase()) || /^(correction|erratum|retraction)\b/i.test(title) || !["journal-article", "book-chapter", "book", "report", "proceedings-article"].includes(work.type)) return [];
    if (!/child|toddler|infant|preschool|kindergarten|유아|영아|어린이/.test(text)) return [];
    const matched = words.filter(word => text.includes(word));
    if (words.length && !matched.includes(words[0])) return [];
    seen.add(doi.toLowerCase());
    return [{ doi, title, originalTitle, titleSource: verified?.source, koreanTitleMissing: domesticHint && !koreanTitle, authors: (work.author || []).slice(0, 6).map(person => clean(person.name || [person.given, person.family].filter(Boolean).join(" "))).filter(Boolean).join(", ") || "저자 정보 미등록", year: work.published?.["date-parts"]?.[0]?.[0] || null, publication: clean(work["container-title"]?.[0] || ""), type: work.type, url: `https://doi.org/${encodeURI(doi).replace(/[?#]/g, encodeURIComponent)}`, abstract: abstract.slice(0, 1000), matched }];
  }).slice(0, 6);
}
export function playSearchQuery(observation: string) {
  const themes: [RegExp, string][] = [[/블록|기찻길|쌓|구성/, "block construction"], [/물놀이|물감|물의|물에/, "water sensory"], [/모래|흙/, "sand sensory"], [/소리|음악|악기|노래/, "music sound"], [/그림|색|그리|미술/, "art drawing"], [/역할|인형|소꿉/, "pretend symbolic"], [/잎|자연|꽃|곤충/, "nature outdoor"], [/공놀이|움직|달리|굴리/, "movement physical"]];
  return `${themes.find(([pattern]) => pattern.test(observation))?.[1] || "exploratory"} play early childhood`;
}
