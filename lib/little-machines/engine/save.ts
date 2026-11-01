import type { RunState, SaveData, UniverseSave } from "./types";

export const SAVE_KEY = "little-machines:save";
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

function isRun(v: unknown): v is RunState {
  if (!isRecord(v)) return false;
  return (
    Number.isInteger(v.phase) &&
    (v.phase as number) >= 0 &&
    isCount(v.time) &&
    isCount(v.taps) &&
    isBool(v.complete) &&
    isRecordOf(v.resources, isNum) &&
    isRecordOf(v.owned, isCount) &&
    isRecordOf(v.mods, isNum) &&
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

/** A checked save, or null if `raw` isn't one this build can read. */
export function parseSave(raw: unknown): SaveData | null {
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
  for (const [id, value] of Object.entries(save.universes)) {
    const universe = parseUniverse(value);
    if (!universe) return null;
    universes[id] = universe;
  }
  return { version: SAVE_VERSION, universes, seenIntro: save.seenIntro };
}

const BACKUP_PREFIX = `${SAVE_KEY}:backup:`;

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
  } catch {
    // A full disk or blocked storage shouldn't stop play.
  }
}

export function loadSave(): LoadResult {
  let raw: string | null;
  try {
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
  const parsed = json === undefined ? null : parseSave(json);
  if (parsed) return { save: parsed, recovered: false };
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
