import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONSENT_VERSION } from "./confidentiality-terms";
export const CONSENT_COOKIE = "girok-consent";
export const CONSENT_BUCKET = "girok-consents";
export type ConsentRecord = { id: string; name: string; email: string; institution?: string; phone?: string; acceptedAt: string; expiresAt: string; version: string; nda: string; privacy: string; ndaAccepted: true; privacyAccepted: true; identityVerified: false };
function mac(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role_key;
  if (!secret) throw new Error("Missing consent configuration");
  return createHmac("sha256", secret).update(`girok-consent|${payload}`).digest("hex");
}
export function consentToken(id: string) { return `${id}.${mac(id)}`; }
export function consentId(token: string) {
  try {
    const [id, signature, extra] = token.split(".");
    if (extra || !/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f]{64}$/.test(signature)) return null;
    return timingSafeEqual(Buffer.from(signature), Buffer.from(mac(id))) ? id : null;
  } catch { return null; }
}
export async function readConsent(id: string): Promise<ConsentRecord | null> {
  const { data, error } = await createAdminClient().storage.from(CONSENT_BUCKET).download(`${id}.json`);
  if (error || !data) return null;
  return JSON.parse(await data.text());
}
export async function validConsent(token: string) {
  try {
    const id = consentId(token);
    if (!id) return false;
    const row = await readConsent(id);
    return Boolean(row && row.id === id && row.version === CONSENT_VERSION && row.ndaAccepted === true && row.privacyAccepted === true && Date.parse(row.expiresAt) > Date.now());
  } catch { return false; }
}
