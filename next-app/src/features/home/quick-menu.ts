export const QUICK_MENU_IDS = ["observation", "audio", "video", "photos", "new", "records", "steam"] as const;
export type QuickMenuId = typeof QUICK_MENU_IDS[number];
export type QuickMenuSlots = (QuickMenuId | null)[];
export const EMPTY_QUICK_MENU: QuickMenuSlots = [null, null, null, null];
export function readQuickMenu(value: unknown): QuickMenuSlots {
  if (!Array.isArray(value) || value.length !== 4) return [...EMPTY_QUICK_MENU];
  const used = new Set<string>();
  return value.map(id => {
    if (typeof id !== "string" || !(QUICK_MENU_IDS as readonly string[]).includes(id) || used.has(id)) return null;
    used.add(id); return id as QuickMenuId;
  });
}
