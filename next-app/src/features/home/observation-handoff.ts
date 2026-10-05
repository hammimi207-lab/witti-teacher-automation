export const HANDOFF_PREFIX = "girok-observation-handoff:";
export type ObservationHandoff = { text: string; createdAt: number };
export function handoffKey(userId: string, token: string) { return `${HANDOFF_PREFIX}${userId}:${token}`; }
export function readHandoff(raw: string | null, now = Date.now()): ObservationHandoff | null {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || typeof value.text !== "string" || !value.text.trim() || value.text.length > 15000 ||
        typeof value.createdAt !== "number" || now - value.createdAt > 30 * 60 * 1000 || value.createdAt > now) return null;
    return value;
  } catch { return null; }
}
export function appendObservation(existing: string, incoming: string) {
  const next = incoming.trim();
  const merged = !next || existing.includes(next) ? existing : [existing.trim(), next].filter(Boolean).join("\n\n");
  if (merged.length > 15000) throw new Error("기존 관찰과 연결할 관찰을 합쳐 15,000자 이내로 줄여 주세요.");
  return merged;
}
export function openObservationRecord(userId: string, text: string) {
  if (!userId) throw new Error("로그인한 뒤 기록으로 연결해 주세요.");
  if (!text.trim() || text.length > 15000) throw new Error("관찰 내용을 15,000자 이내로 확인해 주세요.");
  const token = crypto.randomUUID();
  sessionStorage.setItem(handoffKey(userId, token), JSON.stringify({ text: text.trim(), createdAt: Date.now() }));
  // A full page transition flushes the writing draft's pagehide handler before recovery.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/records/new?observation=${token}`);
}
