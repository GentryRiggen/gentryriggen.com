import { newProgress, type Progress } from "../economy/progress";
import { SAVE_VERSION, parseSave, type SaveV1 } from "./schema";

export const SAVE_KEY = "plane-builder:save";

export interface LoadResult {
  progress: Progress;
  /** A save was there but unreadable; it was backed up and replaced. */
  recovered: boolean;
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
  try {
    window.localStorage.setItem(`${SAVE_KEY}:backup:${Date.now()}`, raw);
  } catch {
    // Backup is best effort; a full disk shouldn't block play.
  }
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
