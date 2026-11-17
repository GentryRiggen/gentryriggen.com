import {
  COLOURS,
  EYES,
  FACES,
  HATS,
  MAX_NAME_LENGTH,
  NECKS,
  SHAPES,
  isUnlockKey,
  type UnlockKey,
} from "./catalog";
import { emptySave, MAX_PETS } from "./actions";
import type { Look, Memorial, Pet, SaveData, Worn } from "./types";

export const SAVE_KEY = "flamelings:v1";
export const CORRUPT_KEY = "flamelings:v1:corrupt";

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function num(v: unknown, lo: number, hi: number): number | null {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, v))
    : null;
}

function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === "string" && (list as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

function parseLook(v: unknown): Look | null {
  if (!isObj(v)) return null;
  const colour = oneOf(v.colour, COLOURS);
  const shape = oneOf(v.shape, SHAPES);
  const eyes = oneOf(v.eyes, EYES);
  return colour && shape && eyes ? { colour, shape, eyes } : null;
}

function parseWorn(v: unknown): Worn | null {
  if (!isObj(v)) return null;
  const slot = <T extends string>(x: unknown, list: readonly T[]) =>
    x === null || x === undefined ? null : oneOf(x, list);
  const hat = slot(v.hat, HATS);
  const face = slot(v.face, FACES);
  const neck = slot(v.neck, NECKS);
  if (
    (v.hat != null && hat === null) ||
    (v.face != null && face === null) ||
    (v.neck != null && neck === null)
  ) {
    return null;
  }
  return { hat, face, neck };
}

function parseName(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0
    ? v.trim().slice(0, MAX_NAME_LENGTH)
    : null;
}

function parsePet(v: unknown): Pet | null {
  if (!isObj(v)) return null;
  const look = parseLook(v.look);
  const worn = parseWorn(v.worn);
  const name = parseName(v.name);
  const fuel = num(v.fuel, 0, 100);
  const joy = num(v.joy, 0, 100);
  const glow = num(v.glow, 0, 100);
  const ash = num(v.ash, 0, 4);
  const ashHours = num(v.ashHours, 0, 4);
  const level = num(v.level, 1, 99);
  const xp = num(v.xp, 0, 1e9);
  const bornAt = num(v.bornAt, 0, 1e15);
  const tickedAt = num(v.tickedAt, 0, 1e15);
  const state = oneOf(v.state, ["alive", "ember"] as const);
  if (
    typeof v.id !== "string" ||
    v.id.length === 0 ||
    v.id.length > 64 ||
    !look ||
    !worn ||
    !name ||
    state === null ||
    fuel === null ||
    joy === null ||
    glow === null ||
    ash === null ||
    ashHours === null ||
    level === null ||
    xp === null ||
    bornAt === null ||
    tickedAt === null ||
    !Array.isArray(v.unlocked)
  ) {
    return null;
  }
  const emberAt = v.emberAt === null ? null : num(v.emberAt, 0, 1e15);
  if (state === "ember" && emberAt === null) return null;
  const relightFeeds = num(v.relightFeeds ?? 0, 0, 2) ?? 0;
  const unlocked = [...new Set(v.unlocked.filter(isUnlockKey))] as UnlockKey[];
  const taps = isObj(v.petTaps) ? v.petTaps : {};
  return {
    id: v.id,
    name,
    look,
    worn,
    fuel,
    joy,
    glow,
    ash: Math.floor(ash),
    ashHours,
    state,
    emberAt,
    relightFeeds: Math.floor(relightFeeds),
    level: Math.floor(level),
    xp,
    unlocked,
    bornAt,
    tickedAt,
    giftWindow: typeof v.giftWindow === "string" ? v.giftWindow : null,
    petTaps: {
      day: typeof taps.day === "string" ? taps.day : "",
      count: Math.floor(num(taps.count, 0, 999) ?? 0),
    },
  };
}

function parseMemorial(v: unknown): Memorial | null {
  if (!isObj(v)) return null;
  const look = parseLook(v.look);
  const worn = parseWorn(v.worn);
  const name = parseName(v.name);
  const level = num(v.level, 1, 99);
  const daysLived = num(v.daysLived, 0, 1e6);
  const bornAt = num(v.bornAt, 0, 1e15);
  const outAt = num(v.outAt, 0, 1e15);
  if (
    typeof v.id !== "string" ||
    !look ||
    !worn ||
    !name ||
    level === null ||
    daysLived === null ||
    bornAt === null ||
    outAt === null
  ) {
    return null;
  }
  return {
    id: v.id,
    name,
    look,
    worn,
    level: Math.floor(level),
    daysLived: Math.floor(daysLived),
    bornAt,
    outAt,
  };
}

/** A save the game can trust, or null when anything is off. */
export function parseSave(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  if (!Array.isArray(raw.pets) || !Array.isArray(raw.memorial)) return null;
  if (raw.pets.length > MAX_PETS) return null;
  const pets = raw.pets.map(parsePet);
  const memorial = raw.memorial.map(parseMemorial);
  if (pets.includes(null) || memorial.includes(null)) return null;
  const ids = new Set((pets as Pet[]).map((p) => p.id));
  if (ids.size !== pets.length) return null;
  const collection = Array.isArray(raw.collection)
    ? [...new Set(raw.collection.filter(isUnlockKey))]
    : [];
  return {
    v: 1,
    pets: pets as Pet[],
    memorial: memorial as Memorial[],
    collection: collection as UnlockKey[],
    updatedAt: num(raw.updatedAt, 0, 1e15) ?? 0,
  };
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the save. A missing or unreadable save starts fresh; a corrupt one is
 * first copied to `flamelings:v1:corrupt` so nothing is lost. Never throws.
 */
export function loadSave(
  now: number,
  storage: StorageLike | null = browserStorage()
): SaveData {
  if (!storage) return emptySave(now);
  let text: string | null = null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return emptySave(now);
  }
  if (text === null) return emptySave(now);
  let parsed: SaveData | null = null;
  try {
    parsed = parseSave(JSON.parse(text));
  } catch {
    parsed = null;
  }
  if (parsed) return parsed;
  try {
    storage.setItem(CORRUPT_KEY, text);
  } catch {
    // Nothing more can be done.
  }
  return emptySave(now);
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
