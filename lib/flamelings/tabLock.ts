/**
 * One tab plays at a time. The tab that is playing writes a heartbeat to
 * localStorage every couple of seconds; another tab that finds a fresh
 * heartbeat shows "open in another tab" instead of saving over it.
 */
export const LOCK_KEY = "flamelings:v1:lock";
export const HEARTBEAT_MS = 2000;
/** A heartbeat older than this means the other tab is gone. */
export const LOCK_STALE_MS = 6000;

interface LockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Lock {
  id: string;
  at: number;
}

export function readLock(storage: LockStorage): Lock | null {
  try {
    const parsed = JSON.parse(storage.getItem(LOCK_KEY) ?? "null");
    return parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.at === "number"
      ? { id: parsed.id, at: parsed.at }
      : null;
  } catch {
    return null;
  }
}

/** Another tab holds a fresh lock. */
export function heldByOther(
  storage: LockStorage,
  id: string,
  nowMs: number
): boolean {
  const lock = readLock(storage);
  return !!lock && lock.id !== id && nowMs - lock.at < LOCK_STALE_MS;
}

/**
 * Takes (or renews) the lock. Without `force` it fails while another tab
 * holds a fresh one; "Play here" passes `force`. Returns whether we hold it.
 */
export function acquire(
  storage: LockStorage,
  id: string,
  nowMs: number,
  force = false
): boolean {
  try {
    if (!force && heldByOther(storage, id, nowMs)) return false;
    storage.setItem(LOCK_KEY, JSON.stringify({ id, at: nowMs }));
    return true;
  } catch {
    // Storage is unavailable: nobody else can be sharing it either.
    return true;
  }
}

export function release(storage: LockStorage, id: string): void {
  try {
    if (readLock(storage)?.id === id) storage.removeItem(LOCK_KEY);
  } catch {
    // Nothing to release.
  }
}
