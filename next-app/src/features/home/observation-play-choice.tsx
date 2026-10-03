"use client";

import { useState } from "react";

export type Play = { cluster_id: string; title: string };
type Suggestion = { title: string; reason: string };

export function ObservationPlayChoice({ fragmentId, linkedId, plays, hasTranscript, disabled, onLink, onCreateAndLink }: {
  fragmentId: string;
  linkedId: string;
  plays: Play[];
  hasTranscript: boolean;
  disabled: boolean;
  onLink: (fragmentId: string, clusterId: string) => Promise<boolean>;
  onCreateAndLink: (fragmentId: string, title: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");

  async function suggest() {
    setSuggesting(true); setSuggestionError("");
    try {
      const response = await fetch("/api/observations/play-suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fragmentId, note }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "놀이 후보를 가져오지 못했어요.");
      setSuggestions(data.suggestions || []);
    } catch (cause) { setSuggestionError(cause instanceof Error ? cause.message : "놀이 후보를 가져오지 못했어요."); }
    finally { setSuggesting(false); }
  }

  return <fieldset className="observation-play-choice"><legend>이 녹음을 어떤 놀이와 연결할까요?</legend>
    <label><input type="radio" name={`play-${fragmentId}`} checked={!linkedId} disabled={disabled} onChange={() => void onLink(fragmentId, "")} /> 아직 연결하지 않기</label>
    {plays.map(play => <label key={play.cluster_id}><input type="radio" name={`play-${fragmentId}`} checked={linkedId === play.cluster_id} disabled={disabled} onChange={() => void onLink(fragmentId, play.cluster_id)} /> {play.title}</label>)}
    <button className="button secondary" type="button" disabled={disabled} onClick={() => setCreating(value => !value)}>새로운 놀이로 만들기</button>
    {creating && <div className="observation-new-play"><label>새 놀이명<input value={title} maxLength={100} onChange={event => setTitle(event.target.value)} /></label><button className="button secondary" type="button" disabled={disabled || !title.trim()} onClick={() => { void onCreateAndLink(fragmentId, title.trim()).then(saved => { if (saved) { setTitle(""); setCreating(false); } }); }}>추가하고 연결</button></div>}
    {hasTranscript && !linkedId && <section className="observation-play-suggestions" aria-label="AI 놀이 후보">
      <label>후보 제안에 참고할 교사 메모<textarea rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="선택 사항" /></label>
      <button className="button secondary" type="button" disabled={disabled || suggesting} onClick={() => void suggest()}>{suggesting ? "후보를 찾고 있어요…" : "AI 놀이 후보 보기"}</button>
      {suggestionError && <p role="alert" className="error">{suggestionError}</p>}
      {suggestions.length === 0 && !suggesting && !suggestionError && <p className="capture-note">AI는 놀이명을 확정하지 않아요. 후보를 보고 교사가 선택해 주세요.</p>}
      {suggestions.map(item => <div className="observation-play-suggestion" key={item.title}><strong>{item.title}</strong><p>{item.reason}</p><button className="button secondary" type="button" disabled={disabled} onClick={() => { const existing = plays.find(play => play.title === item.title); if (existing) void onLink(fragmentId, existing.cluster_id); else void onCreateAndLink(fragmentId, item.title); }}>이 놀이 선택</button></div>)}
    </section>}
  </fieldset>;
}
