"use client";
import { useState } from "react";
import { z } from "zod";
import { playSearchQuery, referenceSchema, type PlayReference } from "./references";
import styles from "./workflow.module.css";
import { RecordAssembly } from "../records/record-assembly";

export function PlayReferences({ observation, age }: { observation: string; age: string }) {
  const [customQuery, setCustomQuery] = useState<string | null>(null);
  const query = customQuery ?? playSearchQuery(observation);
  const [result, setResult] = useState<{ references: PlayReference[]; query: string; checkedAt: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function search() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/steam/references", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setResult(z.object({ references: z.array(referenceSchema), query: z.string(), checkedAt: z.string() }).parse(body));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "참고문헌 검색에 실패했습니다."); } finally { setBusy(false); }
  }
  return <div>
    <p>현재 놀이와 관련된 실제 논문·책·보고서를 찾아봅니다. 사진이나 관찰 원문은 학술 검색 서비스에 보내지 않습니다.</p>
    <label className={styles.field}>놀이 참고문헌 검색어<input value={query} maxLength={150} onChange={event => setCustomQuery(event.target.value)} /></label>
    <p>놀이 주제만 입력하세요. 아이 이름이나 관찰 문장은 넣지 마세요. 공개 국제 학술 자료는 영어 놀이 검색어로 찾는 것이 좋습니다.</p>
    <button type="button" className="button primary" disabled={busy || query.trim().length < 3} onClick={() => void search()}>{busy ? "참고문헌 찾는 중…" : "이 놀이의 참고문헌 찾기"}</button>
    {busy && <RecordAssembly mode="daily" task="놀이 참고문헌 검색" fragments={[{ label: "놀이 검색어", text: query }, { label: "확인할 자료", text: "실제 학술 자료의 제목과 등록 초록을 찾아요." }]} onComplete={() => {}} />}{error && <p role="alert" className="error">{error}</p>}
    {result && <><p>Crossref 서지·초록 정보 확인 · {new Date(result.checkedAt).toLocaleString("ko-KR")} · 검색어: {result.query}</p>
      {result.query !== query && <p role="status">놀이 검색어가 달라졌습니다. 아래는 이전 검색 결과입니다. 다시 검색해 주세요.</p>}
      {!result.references.length && <p role="status">놀이와 연관된 참고문헌을 찾지 못했습니다. 검색어를 바꿔 다시 찾아보세요.</p>}
      {result.references.map(item => <article className={styles.card} key={item.doi}><h3>{item.title}</h3><p>{item.authors} · {item.year || "연도 미등록"}</p><p>{item.publication} · {item.type === "journal-article" ? "연구논문" : item.type === "report" ? "보고서" : "학술 참고자료"}</p>
        <p><strong>확인 범위:</strong> {item.abstract ? "서지 정보와 등록 초록 일부 확인 · 원문 미열람" : "서지 정보만 확인 · 초록·원문 미열람"}</p>
        {item.abstract && <details><summary>핵심 내용 확인을 위한 초록 발췌 · 원문 언어</summary><p>{item.abstract}{item.abstract.length >= 1000 ? "…" : ""}</p></details>}
        <p><strong>연구 대상 연령:</strong> 별도 확인 필요. 만 {age} 직접 근거로 확인하지 않았습니다.</p>
        <p><strong>현재 놀이와 연결:</strong> {item.matched.length ? `${item.matched.join(", ")} 검색어가 제목·초록에 포함된 참고 후보입니다.` : "영유아 놀이 관련 참고 후보입니다."} 검색 일치만으로 현재 놀이의 효과를 입증하지는 않습니다.</p>
        <p><strong>핵심 결과·연구 한계:</strong> 원문에서 연구 방법·대상·결과·제한점을 확인해야 합니다. 다른 연령 연구의 적용 가능성도 확인 후 판단하세요.</p>
        <a href={item.url} target="_blank" rel="noopener noreferrer">원문·출판사 페이지 보기</a><p>DOI: {item.doi}</p>
      </article>)}
    </>}
  </div>;
}
