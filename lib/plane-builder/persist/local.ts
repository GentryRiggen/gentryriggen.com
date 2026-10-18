import { newProgress, type Progress } from "../economy/progress";
import { RESET_BELOW, SAVE_VERSION, parseSave, type SaveV3 } from "./schema";

export const SAVE_KEY = "plane-builder:save";

export interface LoadResult {
  progress: Progress;
  /** A save was there but unreadable; it was backed up and replaced. */
  recovered: boolean;
  /** A save from before the last rebalance; it was backed up and started fresh. */
  reset: boolean;
}

const fresh = (flags: Partial<LoadResult> = {}): LoadResult => ({
  progress: newProgress(),
  recovered: false,
  reset: false,
  ...flags,
});

/** Whether `raw` is a save from a version that starts fresh. */
function isResetSave(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const version = (raw as { version?: unknown }).version;
  return Number.isInteger(version) && (version as number) < RESET_BELOW;
}

const BACKUP_PREFIX = `${SAVE_KEY}:backup:`;

/**
 * Best effort; skipped when a backup already holds this exact text. True when
 * the text is safely in a backup.
 */
function backUp(raw: string): boolean {
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(BACKUP_PREFIX) && storage.getItem(key) === raw)
        return true;
    }
    storage.setItem(`${BACKUP_PREFIX}${Date.now()}`, raw);
    return true;
  } catch {
    // A full disk or blocked storage shouldn't stop play.
    return false;
  }
}

export function loadProgress(): LoadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return fresh();
  }
  if (raw === null) return fresh();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    json = undefined;
  }
  if (isResetSave(json)) {
    const result = fresh({ reset: true });
    // Replace the old save so the note shows once, but only once it is backed
    // up, so a full disk never loses it.
    if (backUp(raw)) saveProgress(result.progress);
    return result;
  }
  const parsed = json === undefined ? null : parseSave(json);
  if (parsed) return fresh({ progress: parsed });
  backUp(raw);
  return fresh({ recovered: true });
}

export function saveProgress(progress: Progress): boolean {
  const save: SaveV3 = { version: SAVE_VERSION, progress };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
