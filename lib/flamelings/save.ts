import {
  COLOURS,
  DECOR,
  EYES,
  FACES,
  HATS,
  MAX_NAME_LENGTH,
  NECKS,
  SHAPES,
  isUnlockKey,
  unlockKey,
  type DecorId,
  type UnlockKey,
} from "./catalog";
import { emptySave, MAX_PETS, MAX_SPARKS } from "./actions";
import { isHappeningKind, variantsOf, type Happening } from "./happenings";
import { SAVE_SCHEMA } from "./types";
import type { Look, Memorial, Pet, SaveData, Worn } from "./types";

export const SAVE_KEY = "flamelings:v1";
/** Prefix of the backups of saves that could not be read in full. */
export const CORRUPT_PREFIX = "flamelings:v1:corrupt";
const BACKUP_INDEX_KEY = `${CORRUPT_PREFIX}:index`;
export const BACKUPS_KEPT = 3;
const DEFAULT_NAME = "Flameling";

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function num(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, v))
    : fallback;
}

function oneOf<T extends string>(
  v: unknown,
  list: readonly T[],
  fallback: T
): T {
  return typeof v === "string" && (list as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

/** An item id this build does not know is dropped (null), not fatal. */
function slot<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

function parseLook(v: unknown): Look {
  const o = isObj(v) ? v : {};
  return {
    colour: oneOf(o.colour, COLOURS, "ember"),
    shape: oneOf(o.shape, SHAPES, "flame"),
    eyes: oneOf(o.eyes, EYES, "round"),
  };
}

function parseWorn(v: unknown): Worn {
  const o = isObj(v) ? v : {};
  return {
    hat: slot(o.hat, HATS),
    face: slot(o.face, FACES),
    neck: slot(o.neck, NECKS),
  };
}

function parseName(v: unknown): string {
  const name = typeof v === "string" ? v.trim().slice(0, MAX_NAME_LENGTH) : "";
  return name || DEFAULT_NAME;
}

/**
 * A stored happening, or null. A kind this build does not know is dropped;
 * a bad variant falls back to the kind's first.
 */
function parseHappening(v: unknown): Happening | null {
  if (!isObj(v) || !isHappeningKind(v.kind)) return null;
  if (typeof v.window !== "string" || v.window.length > 32) return null;
  return {
    window: v.window,
    kind: v.kind,
    variant: oneOf(
      v.variant,
      variantsOf(v.kind) as readonly string[],
      variantsOf(v.kind)[0]
    ),
    done: v.done === true,
    seen: v.seen === true,
  };
}

/** A pet with every bad field defaulted, or null if it has no usable id. */
function parsePet(v: unknown, fallbackTime: number): Pet | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== "string" || v.id.length === 0 || v.id.length > 64) {
    return null;
  }
  const bornAt = num(v.bornAt, 0, 1e15, fallbackTime);
  const tickedAt = num(v.tickedAt, 0, 1e15, bornAt);
  const emberRaw = typeof v.emberAt === "number" ? v.emberAt : null;
  const state = oneOf(v.state, ["alive", "ember"] as const, "alive");
  const emberAt =
    state === "ember"
      ? num(emberRaw, 0, 1e15, tickedAt)
      : emberRaw === null
        ? null
        : num(emberRaw, 0, 1e15, tickedAt);
  const unlocked = Array.isArray(v.unlocked)
    ? ([...new Set(v.unlocked.filter(isUnlockKey))] as UnlockKey[])
    : [];
  // Decor needs an owner's key, so a stray id cannot appear in the glade.
  const decor = Array.isArray(v.decor)
    ? ([
        ...new Set(
          v.decor.filter(
            (d): d is DecorId =>
              typeof d === "string" &&
              (DECOR as readonly string[]).includes(d) &&
              unlocked.includes(unlockKey("decor", d))
          )
        ),
      ] as DecorId[])
    : [];
  const taps = isObj(v.petTaps) ? v.petTaps : {};
  const rounds = isObj(v.sparkRounds) ? v.sparkRounds : {};
  return {
    id: v.id,
    name: parseName(v.name),
    look: parseLook(v.look),
    worn: parseWorn(v.worn),
    fuel: num(v.fuel, 0, 100, 100),
    joy: num(v.joy, 0, 100, 100),
    glow: num(v.glow, 0, 100, state === "ember" ? 0 : 100),
    ash: Math.floor(num(v.ash, 0, 4, 0)),
    ashHours: num(v.ashHours, 0, 4, 0),
    state,
    emberAt: state === "ember" ? emberAt : null,
    relightFeeds: Math.floor(num(v.relightFeeds, 0, 2, 0)),
    level: Math.floor(num(v.level, 1, 99, 1)),
    xp: num(v.xp, 0, 1e9, 0),
    unlocked,
    sparks: Math.floor(num(v.sparks, 0, MAX_SPARKS, 0)),
    decor,
    bornAt,
    tickedAt,
    giftWindow: typeof v.giftWindow === "string" ? v.giftWindow : null,
    petTaps: {
      day: typeof taps.day === "string" ? taps.day : "",
      count: Math.floor(num(taps.count, 0, 999, 0)),
    },
    happening: parseHappening(v.happening),
    wish: Math.floor(num(v.wish, 0, 100, 0)),
    sparkRounds: {
      window: typeof rounds.window === "string" ? rounds.window : "",
      count: Math.floor(num(rounds.count, 0, 99, 0)),
    },
  };
}

function parseMemorial(v: unknown, fallbackTime: number): Memorial | null {
  if (!isObj(v) || typeof v.id !== "string" || v.id.length === 0) return null;
  const bornAt = num(v.bornAt, 0, 1e15, fallbackTime);
  return {
    id: v.id,
    name: parseName(v.name),
    look: parseLook(v.look),
    worn: parseWorn(v.worn),
    level: Math.floor(num(v.level, 1, 99, 1)),
    daysLived: Math.floor(num(v.daysLived, 0, 1e6, 0)),
    bornAt,
    outAt: num(v.outAt, 0, 1e15, bornAt),
  };
}

export interface ParsedSave {
  save: SaveData;
  /** Entries that could not be salvaged (so the original should be backed up). */
  skipped: number;
  /** Written by a newer build than this one: read it, never write over it. */
  newer: boolean;
}

/**
 * Reads a save, salvaging what it can: an unknown hat, colour, emote or food
 * is dropped or defaulted and the pet is kept; only a pet with no usable id
 * is skipped. Null only when the save as a whole is unreadable.
 */
export function parseSaveSalvaging(raw: unknown): ParsedSave | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  if (!Array.isArray(raw.pets)) return null;
  const updatedAt = num(raw.updatedAt, 0, 1e15, 0);
  const schema = Math.floor(num(raw.schema, 1, 1e6, 1));
  let skipped = 0;
  const seen = new Set<string>();
  const pets: Pet[] = [];
  for (const entry of raw.pets) {
    const pet = parsePet(entry, updatedAt);
    if (!pet || seen.has(pet.id) || pets.length >= MAX_PETS) {
      skipped += 1;
      continue;
    }
    seen.add(pet.id);
    pets.push(pet);
  }
  const memorial: Memorial[] = [];
  for (const entry of Array.isArray(raw.memorial) ? raw.memorial : []) {
    const m = parseMemorial(entry, updatedAt);
    if (m) memorial.push(m);
    else skipped += 1;
  }
  const collection = Array.isArray(raw.collection)
    ? [...new Set(raw.collection.filter(isUnlockKey))]
    : [];
  return {
    save: {
      v: 1,
      schema: Math.max(schema, SAVE_SCHEMA),
      pets,
      memorial,
      collection: collection as UnlockKey[],
      updatedAt,
    },
    skipped,
    newer: schema > SAVE_SCHEMA,
  };
}

/** A save the game can trust as-is, or null when anything had to be dropped. */
export function parseSave(raw: unknown): SaveData | null {
  const parsed = parseSaveSalvaging(raw);
  return parsed && parsed.skipped === 0 ? parsed.save : null;
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
  save: SaveData;
  /**
   * False when the stored save could not be read, or could not be backed up
   * before being replaced: the game then plays on but must not overwrite it.
   */
  writable: boolean;
  /** The stored save is from a newer build: the page should offer the update. */
  newer: boolean;
}

/**
 * Reads the save. A missing save starts fresh. A damaged one is salvaged pet
 * by pet; the original is first backed up to a timestamped slot, and if that
 * fails (or storage cannot be read at all) the main key is left alone.
 * Never throws.
 */
export function loadSaveResult(
  now: number,
  storage: StorageLike | null = browserStorage()
): LoadResult {
  if (!storage) return { save: emptySave(now), writable: false, newer: false };
  let text: string | null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { save: emptySave(now), writable: false, newer: false };
  }
  if (text === null)
    return { save: emptySave(now), writable: true, newer: false };
  let parsed: ParsedSave | null = null;
  try {
    parsed = parseSaveSalvaging(JSON.parse(text));
  } catch {
    parsed = null;
  }
  const newer = parsed?.newer ?? false;
  if (parsed && parsed.skipped === 0) {
    // A newer build's save is played in memory and never overwritten.
    return { save: parsed.save, writable: !newer, newer };
  }
  // A newer build's save is never written over, so it needs no backup (and
  // must not push real backups out on every load).
  const saved = newer || backUp(text, storage, now);
  return {
    save: parsed?.save ?? emptySave(now),
    writable: saved && !newer,
    newer,
  };
}

/** Like {@link loadSaveResult}, for callers that only need the save. */
export function loadSave(
  now: number,
  storage: StorageLike | null = browserStorage()
): SaveData {
  return loadSaveResult(now, storage).save;
}

/** The raw stored text (null when absent or unreadable). */
export function readRaw(
  storage: StorageLike | null = browserStorage()
): string | null {
  try {
    return storage ? storage.getItem(SAVE_KEY) : null;
  } catch {
    return null;
  }
}

/** Writes the save; returns false (never throws) if storage refuses. */
export function writeSave(
  save: SaveData,
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
