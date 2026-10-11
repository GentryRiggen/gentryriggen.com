import { newProgress, type Progress } from "../economy/progress";
import { SAVE_VERSION, parseSave, type SaveV1 } from "./schema";

export const SAVE_KEY = "plane-builder:save";

export interface LoadResult {
  progress: Progress;
  /** A save was there but unreadable; it was backed up and replaced. */
  recovered: boolean;
}

const BACKUP_PREFIX = `${SAVE_KEY}:backup:`;

/** Best effort; skipped when a backup already holds this exact text. */
function backUp(raw: string) {
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(BACKUP_PREFIX) && storage.getItem(key) === raw)
        return;
    }
    storage.setItem(`${BACKUP_PREFIX}${Date.now()}`, raw);
  } catch {
    // A full disk or blocked storage shouldn't stop play.
  }
}

export function loadProgress(): LoadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return { progress: newProgress(), recovered: false };
  }
  if (raw === null) return { progress: newProgress(), recovered: false };
  let parsed: Progress | null = null;
  try {
    parsed = parseSave(JSON.parse(raw));
  } catch {
    parsed = null;
  }
  if (parsed) return { progress: parsed, recovered: false };
  backUp(raw);
  return { progress: newProgress(), recovered: true };
}

export function saveProgress(progress: Progress): boolean {
  const save: SaveV1 = { version: SAVE_VERSION, progress };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
