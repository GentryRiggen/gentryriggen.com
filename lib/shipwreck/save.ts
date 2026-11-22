import type { ShipId } from "./ships/types";
import {
  CAMERA_IDS,
  OUTCOME_IDS,
  SPEEDS,
  type CameraId,
  type OutcomeId,
  type Speed,
} from "./types";

/**
 * The save is settings and a few flags, so there is no tab lock: with two
 * tabs open the last writer wins, which costs a sound toggle at worst.
 */
export interface ShipwreckSave {
  v: 1;
  settings: { sound: boolean; speed: Speed; camera: CameraId };
  seen: { realNight: boolean; endings: OutcomeId[] };
  /** Ids of the openings tried in the last Titanic What if? run (1.0). */
  lastWhatIf: string[];
  /** The ship chosen last on the title screen (missing: the Titanic). */
  ship?: ShipId;
  /**
   * The last What if? of every other ship (1.1). The Titanic's stays in
   * `lastWhatIf`, where 1.0 kept it.
   */
  whatIfByShip?: Partial<Record<ShipId, ShipWhatIf>>;
}

/**
 * A ship's last What if?: the spots chosen (any number, for every ship:
 * compartments, torpedo hits, or a storm ship's hatches, vents and shoal
 * strips), her portholes and her storm.
 */
export interface ShipWhatIf {
  ids: string[];
  /** Torpedo ships: whether the portholes were open (default true). */
  portholesOpen?: boolean;
  /** Storm ships: the storm as it was, calmer or worse (default "real"). */
  storm?: WhatIfStorm;
}

/** A storm ship's What-if storm. */
export type WhatIfStorm = "real" | "calmer" | "worse";
export const WHAT_IF_STORMS: readonly WhatIfStorm[] = [
  "real",
  "calmer",
  "worse",
];

/** The ships a save may name (kept here so the save needs no ship data). */
export const SAVE_SHIP_IDS: readonly ShipId[] = [
  "titanic",
  "lusitania",
  "fitzgerald",
];

export const SAVE_KEY = "shipwreck:v1";
/** Prefix of the backups of saves that could not be read in full. */
export const CORRUPT_PREFIX = "shipwreck:v1:corrupt";
const BACKUP_INDEX_KEY = `${CORRUPT_PREFIX}:index`;
export const BACKUPS_KEPT = 3;
const MAX_WHATIF = 64;
const MAX_ID_LENGTH = 48;

export function emptySave(): ShipwreckSave {
  return {
    v: 1,
    settings: { sound: true, speed: 30, camera: "orbit" },
    seen: { realNight: false, endings: [] },
    lastWhatIf: [],
  };
}

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function oneOf<T extends string | number>(
  v: unknown,
  list: readonly T[],
  fallback: T
): T {
  return (list as readonly unknown[]).includes(v) ? (v as T) : fallback;
}

export interface ParsedSave {
  save: ShipwreckSave;
  /** Written by a newer build than this one: read it, never write over it. */
  newer: boolean;
}

/**
 * Reads a save, salvaging what it can: an unknown camera, speed or ending
 * from another build falls back to its default and the rest is kept. Null
 * only when the save as a whole is unreadable.
 */
export function parseSaveSalvaging(raw: unknown): ParsedSave | null {
  if (!isObj(raw)) return null;
  if (typeof raw.v !== "number" || !Number.isFinite(raw.v) || raw.v < 1) {
    return null;
  }
  const settings = isObj(raw.settings) ? raw.settings : {};
  const seen = isObj(raw.seen) ? raw.seen : {};
  const endings: OutcomeId[] = [];
  for (const e of Array.isArray(seen.endings) ? seen.endings : []) {
    if (
      (OUTCOME_IDS as readonly unknown[]).includes(e) &&
      !endings.includes(e as OutcomeId)
    ) {
      endings.push(e as OutcomeId);
    }
  }
  const lastWhatIf = parseIds(raw.lastWhatIf);
  const save: ShipwreckSave = {
    v: 1,
    settings: {
      sound: typeof settings.sound === "boolean" ? settings.sound : true,
      speed: oneOf<Speed>(settings.speed, SPEEDS, 30),
      camera: oneOf<CameraId>(settings.camera, CAMERA_IDS, "orbit"),
    },
    seen: { realNight: seen.realNight === true, endings },
    lastWhatIf,
  };
  if (isShipId(raw.ship)) save.ship = raw.ship;
  if (isObj(raw.whatIfByShip)) {
    const byShip: Partial<Record<ShipId, ShipWhatIf>> = {};
    for (const [ship, value] of Object.entries(raw.whatIfByShip)) {
      // The Titanic's What if? lives in lastWhatIf; unknown ships are dropped.
      if (!isShipId(ship) || ship === "titanic" || !isObj(value)) continue;
      const entry: ShipWhatIf = { ids: parseIds(value.ids) };
      if (typeof value.portholesOpen === "boolean")
        entry.portholesOpen = value.portholesOpen;
      if ((WHAT_IF_STORMS as readonly unknown[]).includes(value.storm))
        entry.storm = value.storm as WhatIfStorm;
      byShip[ship] = entry;
    }
    if (Object.keys(byShip).length > 0) save.whatIfByShip = byShip;
  }
  return { save, newer: raw.v > 1 };
}

function isShipId(v: unknown): v is ShipId {
  return (SAVE_SHIP_IDS as readonly unknown[]).includes(v);
}

function parseIds(raw: unknown): string[] {
  const ids: string[] = [];
  for (const id of Array.isArray(raw) ? raw : []) {
    if (
      typeof id === "string" &&
      id.length > 0 &&
      id.length <= MAX_ID_LENGTH &&
      !ids.includes(id) &&
      ids.length < MAX_WHATIF
    ) {
      ids.push(id);
    }
  }
  return ids;
}

/** The ship a save chose (the Titanic for a 1.0 save). */
export function shipOf(save: ShipwreckSave): ShipId {
  return save.ship ?? "titanic";
}

/** A ship's last What if? (the Titanic's from `lastWhatIf`). */
export function whatIfOf(save: ShipwreckSave, ship: ShipId): ShipWhatIf {
  if (ship === "titanic") return { ids: save.lastWhatIf };
  return save.whatIfByShip?.[ship] ?? { ids: [] };
}

/** The save with a ship's What if? remembered. */
export function withWhatIf(
  save: ShipwreckSave,
  ship: ShipId,
  whatIf: ShipWhatIf
): ShipwreckSave {
  if (ship === "titanic") return { ...save, lastWhatIf: [...whatIf.ids] };
  return {
    ...save,
    whatIfByShip: {
      ...save.whatIfByShip,
      [ship]: { ...whatIf, ids: [...whatIf.ids] },
    },
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Saves `text` in a new timestamped slot and keeps only the last three. */
function backUp(text: string, storage: StorageLike, nowMs: number): boolean {
  try {
    let index: string[] = [];
    try {
      const stored = JSON.parse(storage.getItem(BACKUP_INDEX_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        index = stored.filter((k): k is string => typeof k === "string");
      }
    } catch {
      index = [];
    }
    // The same text is already safe: do not rotate real backups out for it.
    if (index.some((k) => storage.getItem(k) === text)) return true;
    let key = `${CORRUPT_PREFIX}:${nowMs}`;
    for (let n = 1; index.includes(key); n++) {
      key = `${CORRUPT_PREFIX}:${nowMs}-${n}`;
    }
    storage.setItem(key, text);
    index.push(key);
    while (index.length > BACKUPS_KEPT) {
      const old = index.shift();
      if (old) storage.removeItem?.(old);
    }
    storage.setItem(BACKUP_INDEX_KEY, JSON.stringify(index));
    return true;
  } catch {
    return false;
  }
}

export interface LoadResult {
  save: ShipwreckSave;
  /**
   * False when the stored save could not be read, or could not be backed up
   * before being replaced, or is from a newer build: the game then plays on
   * but must not overwrite it.
   */
  writable: boolean;
  /** The stored save is from a newer build. */
  newer: boolean;
}

/**
 * Reads the save. A missing save starts fresh. An unreadable one is backed up
 * to a timestamped slot first; if that fails (or storage cannot be read at
 * all) the main key is left alone. Never throws.
 */
export function loadSaveResult(
  nowMs: number,
  storage: StorageLike | null = browserStorage()
): LoadResult {
  if (!storage) return { save: emptySave(), writable: false, newer: false };
  let text: string | null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { save: emptySave(), writable: false, newer: false };
  }
  if (text === null) return { save: emptySave(), writable: true, newer: false };
  let parsed: ParsedSave | null = null;
  try {
    parsed = parseSaveSalvaging(JSON.parse(text));
  } catch {
    parsed = null;
  }
  if (parsed) {
    // A newer build's save is played in memory and never overwritten.
    return { save: parsed.save, writable: !parsed.newer, newer: parsed.newer };
  }
  return {
    save: emptySave(),
    writable: backUp(text, storage, nowMs),
    newer: false,
  };
}

/** Like {@link loadSaveResult}, for callers that only need the save. */
export function loadSave(
  nowMs: number,
  storage: StorageLike | null = browserStorage()
): ShipwreckSave {
  return loadSaveResult(nowMs, storage).save;
}

/** Writes the save; returns false (never throws) if storage refuses. */
export function writeSave(
  save: ShipwreckSave,
  storage: StorageLike | null = browserStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
