import type { RunState, SaveData, UniverseSave } from "./types";

export const SAVE_KEY = "ever-onward:save";
/** The key from before the game was renamed from Little Machines. */
export const LEGACY_SAVE_KEY = "little-machines:save";
export const SAVE_VERSION = 1;

export interface LoadResult {
  save: SaveData;
  /** A save was there but unreadable; it was backed up and replaced. */
  recovered: boolean;
}

export const newSave = (): SaveData => ({
  version: SAVE_VERSION,
  universes: {},
  seenIntro: false,
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const isCount = (v: unknown): v is number => isNum(v) && v >= 0;

const isRecordOf = <T>(v: unknown, check: (x: unknown) => x is T): boolean =>
  isRecord(v) && Object.values(v).every(check);

const isString = (v: unknown): v is string => typeof v === "string";
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

function isTransition(v: unknown): boolean {
  return isRecord(v) && isString(v.from) && isString(v.to) && isCount(v.at);
}

/**
 * JSON turns NaN and Infinity into null, so a damaged number reads back as
 * null; accept it here and let `reconcileRun` replace it with a default.
 */
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);

function isRun(v: unknown): v is RunState {
  if (!isRecord(v)) return false;
  return (
    Number.isInteger(v.phase) &&
    (v.phase as number) >= 0 &&
    isCount(v.time) &&
    isCount(v.taps) &&
    isBool(v.complete) &&
    isRecordOf(v.resources, isNumOrNull) &&
    isRecordOf(v.owned, isCount) &&
    isRecordOf(v.mods, isNumOrNull) &&
    isRecordOf(v.flags, isBool) &&
    Array.isArray(v.revealed) &&
    v.revealed.every(isString) &&
    Array.isArray(v.story) &&
    v.story.every(isString) &&
    Array.isArray(v.transitions) &&
    v.transitions.every(isTransition) &&
    Number.isInteger(v.rng)
  );
}

function parseUniverse(v: unknown): UniverseSave | null {
  if (!isRecord(v) || !isRun(v.run)) return null;
  const { best, completions, embers, prestigeUpgrades } = v;
  if (best !== null && !(isNum(best) && best > 0)) return null;
  if (!isCount(completions) || !isCount(embers)) return null;
  if (!isRecordOf(prestigeUpgrades, isCount)) return null;
  return {
    run: v.run,
    best: best as number | null,
    completions,
    embers,
    prestigeUpgrades: prestigeUpgrades as Record<string, number>,
  };
}

/** Future versions add `migrations[n]` turning version n into n + 1. */
const migrations: Record<
  number,
  (raw: Record<string, unknown>) => Record<string, unknown>
> = {};

export interface ParseReport {
  save: SaveData;
  /** Universe ids whose entry was unreadable and so left out. */
  dropped: string[];
}

/** A checked save, or null if `raw` isn't one this build can read. */
export function parseSave(raw: unknown): SaveData | null {
  return parseSaveReport(raw)?.save ?? null;
}

/**
 * Like `parseSave`, but one unreadable universe entry is left out (and
 * listed) instead of discarding the whole save.
 */
export function parseSaveReport(raw: unknown): ParseReport | null {
  if (!isRecord(raw) || !Number.isInteger(raw.version)) return null;
  let save = raw;
  for (let v = save.version as number; v < SAVE_VERSION; v += 1) {
    const migrate = migrations[v];
    if (!migrate) return null;
    save = migrate(save);
  }
  if (save.version !== SAVE_VERSION) return null;
  if (!isRecord(save.universes) || !isBool(save.seenIntro)) return null;
  const universes: Record<string, UniverseSave> = {};
  const dropped: string[] = [];
  for (const [id, value] of Object.entries(save.universes)) {
    const universe = parseUniverse(value);
    if (universe) universes[id] = universe;
    else dropped.push(id);
  }
  return {
    save: { version: SAVE_VERSION, universes, seenIntro: save.seenIntro },
    dropped,
  };
}

const BACKUP_PREFIX = `${SAVE_KEY}:backup:`;
/** Older backups are deleted so recoveries can't fill the storage. */
export const MAX_BACKUPS = 3;

function pruneBackups(storage: Storage): void {
  const backups: { key: string; at: number }[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key?.startsWith(BACKUP_PREFIX)) continue;
    backups.push({ key, at: Number(key.slice(BACKUP_PREFIX.length)) || 0 });
  }
  backups.sort((a, b) => b.at - a.at);
  for (const { key } of backups.slice(MAX_BACKUPS)) storage.removeItem(key);
}

/** Best effort; skipped when a backup already holds this exact text. */
function backUp(raw: string): void {
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(BACKUP_PREFIX) && storage.getItem(key) === raw)
        return;
    }
    storage.setItem(`${BACKUP_PREFIX}${Date.now()}`, raw);
    pruneBackups(storage);
  } catch {
    // A full disk or blocked storage shouldn't stop play.
  }
}

/**
 * Moves a save written under the old name to the new key (copy, then remove
 * the old one). Does nothing when the new key already exists.
 */
function migrateLegacySave(storage: Storage): void {
  if (storage.getItem(SAVE_KEY) !== null) return;
  const legacy = storage.getItem(LEGACY_SAVE_KEY);
  if (legacy === null) return;
  storage.setItem(SAVE_KEY, legacy);
  storage.removeItem(LEGACY_SAVE_KEY);
}

export function loadSave(): LoadResult {
  let raw: string | null;
  try {
    migrateLegacySave(window.localStorage);
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return { save: newSave(), recovered: false };
  }
  if (raw === null) return { save: newSave(), recovered: false };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    json = undefined;
  }
  const parsed = json === undefined ? null : parseSaveReport(json);
  if (parsed && parsed.dropped.length === 0)
    return { save: parsed.save, recovered: false };
  if (parsed) {
    backUp(raw);
    return { save: parsed.save, recovered: true };
  }
  backUp(raw);
  return { save: newSave(), recovered: true };
}

/** True when the save was written. */
export function writeSave(save: SaveData): boolean {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
