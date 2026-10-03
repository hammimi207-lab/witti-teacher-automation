"use client";

import { useState } from "react";

const emotional = [
  { label: "오늘의 한 줄 문장", options: ["오늘도 아이들 곁에서 충분히 애쓴 하루였습니다.", "조금 지쳤지만, 그래도 마음이 따뜻해지는 순간이 있었습니다.", "작은 웃음 하나가 긴 하루를 버티게 해주었습니다.", "바쁜 하루였지만 아이들의 반응 속에서 힘을 얻었습니다.", "완벽하지 않아도 괜찮았던 하루였습니다."] },
  { label: "가장 빛났던 순간", options: ["아이의 웃음이 가장 기억에 남았습니다.", "예상하지 못한 아이의 말 한마디가 마음에 남았습니다.", "함께 놀이하던 순간의 따뜻한 분위기가 좋았습니다.", "힘든 중에도 아이들이 즐겁게 참여하는 모습이 빛났습니다.", "동료와 주고받은 작은 응원이 기억에 남았습니다."] },
  { label: "오늘 내 마음을 표현하는 단어", options: ["따뜻한", "차분한", "벅찬", "지친", "뿌듯한", "복잡한", "고요한", "열정적인"] },
  { label: "나에게 한마디", options: ["오늘도 충분히 잘했어.", "완벽하지 않아도 괜찮아.", "내가 버틴 하루도 소중해.", "조금 쉬어가도 괜찮아.", "내일의 나는 오늘의 나에게 고마워할 거야."] },
];
const summary = [
  { label: "기억", options: ["아이의 웃음이 오래 기억에 남았습니다.", "예상하지 못한 아이의 표현이 마음에 남았습니다.", "함께 놀이하던 장면이 오늘의 가장 특별한 순간이었습니다.", "동료와 나눈 짧은 대화가 힘이 되었습니다.", "하루를 무사히 마무리한 것이 가장 큰 일이었습니다."] },
  { label: "감정", options: ["뿌듯함이 남았습니다.", "조금 지쳤지만 따뜻함도 있었습니다.", "마음이 복잡했지만 잘 버텼습니다.", "작은 장면 하나에 위로를 받았습니다.", "생각보다 괜찮은 하루였습니다."] },
  { label: "온도", options: ["따뜻한 36.5℃", "차분한 35℃", "열정적인 40℃", "조금 지친 32℃", "다시 회복 중인 34℃"] },
];
const scores = [[38, 37.5, 37, 36.5, 35.5], [38.5, 36.5, 34.5, 37, 36], [36.5, 35, 40, 32, 34]];

export function TemperatureDiary() {
  const [mode, setMode] = useState("감성 일기");
  const [choices, setChoices] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [result, setResult] = useState<{ text: string; average: number | null } | null>(null);
  const [status, setStatus] = useState("");
  const fields = mode === "감성 일기" ? emotional : summary;
  function change(index: number, value: string, direct = false) {
    (direct ? setCustom : setChoices)((current) => { const next = [...current]; next[index] = value; return next; });
    setResult(null); setStatus("");
  }
  return <><form className="panel" onSubmit={(event) => {
    event.preventDefault();
    const values = fields.map((_, i) => (choices[i] === "직접 입력" ? custom[i] : choices[i])?.trim());
    if (values.some((value) => !value)) { setStatus("모든 항목을 선택하거나 직접 입력해 주세요."); return; }
    let average: number | null = null;
    let text: string;
    if (mode === "감성 일기") text = `오늘 하루를 돌아보면, ${values[0]}\n\n그중 가장 마음에 남는 순간은 ${values[1]}\n\n오늘 내 마음은 ${values[2]} 쪽에 가까웠어요.\n\n그래도 나에게 이렇게 말해주고 싶어요.\n${values[3]}`;
    else {
      const temperatures = summary.map((field, i) => scores[i][field.options.indexOf(choices[i])] ?? 36.5);
      average = Math.round((temperatures[0] * .25 + temperatures[1] * .25 + temperatures[2] * .5) * 10) / 10;
      const message = average >= 38 ? "오늘은 마음의 에너지가 꽤 높았던 하루예요." : average >= 36 ? "따뜻함과 안정감이 남아 있는 하루예요." : average >= 34 ? "조금 지쳤지만 잘 버텨낸 하루예요." : "마음의 온도가 낮아진 날이에요. 오늘은 회복이 먼저예요.";
      text = `오늘 하루를 돌아보면, ${values[0]}\n그 순간의 내 마음에는 ${values[1]}\n그래서 오늘의 마음온도는 ${values[2]}에 가까웠어요.\n\n${message}\n오늘도 충분히 애쓴 하루였어요.`;
    }
    setResult({ text, average }); setStatus("");
  }}><div className="field"><label htmlFor="diary-mode">기록 양식 선택</label><select id="diary-mode" value={mode} onChange={(e) => { setMode(e.target.value); setChoices([]); setCustom([]); setResult(null); setStatus(""); }}><option>감성 일기</option><option>3줄 요약 다이어리</option></select></div><div className="detail-note-list">{fields.map((field, i) => <div className="field" key={`${mode}-${i}`}><label htmlFor={`temperature-${i}`}>{field.label}</label><select id={`temperature-${i}`} value={choices[i] || ""} onChange={(e) => change(i, e.target.value)} required><option value="">선택해 주세요</option>{field.options.map((value) => <option key={value}>{value}</option>)}<option>직접 입력</option></select>{choices[i] === "직접 입력" && <input aria-label={`${field.label} 직접 입력`} value={custom[i] || ""} onChange={(e) => change(i, e.target.value, true)} maxLength={1000} required />}</div>)}</div>{mode !== "감성 일기" && <p><small>마음온도는 기억 25%·감정 25%·온도 50%의 상징적 지표입니다. 직접 입력 항목은 기존 기준인 36.5℃로 계산하며 실제 체온이나 심리 진단이 아닙니다.</small></p>}<div className="submit-row"><button className="button primary">{mode} 생성</button></div></form>{result && <section className="panel result" aria-live="polite"><h2>오늘의 마음 기록</h2>{result.average !== null && <h3>나의 오늘 평균 마음온도 · {result.average}℃</h3>}<pre>{result.text}</pre><p>이 기록은 서버에 자동 저장되지 않습니다. 필요한 경우 아래에서 내려받으세요.</p><button className="button secondary" onClick={() => {
    const url = URL.createObjectURL(new Blob([result.text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "교사의-온도.txt"; link.click(); URL.revokeObjectURL(url);
  }}>기록 내려받기</button></section>}{status && <p role="alert" className="error">{status}</p>}</>;
}
