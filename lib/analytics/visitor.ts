import type { KeyValueStorage } from "./storage";

const KEY = "analytics-vid";

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Fallback when storage is blocked: keeps one id per day for the whole page
// session, since the tracker asks for the id again on every route change.
let memoryId: { d: string; id: string } | null = null;

/** Test hook: forget the in-memory fallback id. */
export function resetVisitorMemory(): void {
  memoryId = null;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Anonymous visitor id that regenerates every UTC day, so a visitor can be
 * counted once per day but never followed across days.
 */
export function getVisitorId(
  storage: KeyValueStorage | null,
  now: Date = new Date()
): string {
  const day = utcDay(now);
  try {
    const raw = storage?.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { d?: unknown; id?: unknown };
      if (
        saved.d === day &&
        typeof saved.id === "string" &&
        saved.id.length >= 8
      ) {
        return saved.id;
      }
    }
  } catch {
    // Corrupt or unreadable value: fall through and mint a new id.
  }
  if (memoryId?.d === day) return memoryId.id;
  const id = newId();
  try {
    if (!storage) throw new Error("no storage");
    storage.setItem(KEY, JSON.stringify({ d: day, id }));
  } catch {
    // Storage blocked: remember the id in memory so it lasts until a reload.
    memoryId = { d: day, id };
  }
  return id;
}
