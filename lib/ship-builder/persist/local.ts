import { newId } from "../model/ids";
import { clampName } from "../model/placement";
import type { Ship } from "../model/types";
import { parseShip } from "./schema";

export const AUTOSAVE_KEY = "ship-builder:autosave";
export const SHIPS_KEY = "ship-builder:ships";
/**
 * Holds a non-array SHIPS_KEY value (e.g. a newer format) we overwrote.
 * Later, different values go to `<SHIPS_BACKUP_KEY>:<timestamp>` keys.
 */
export const SHIPS_BACKUP_KEY = "ship-builder:ships:backup";
/**
 * Holds an autosave this build couldn't read (e.g. one written by a newer
 * build), copied before the next autosave overwrites it. Later, different
 * values go to `<AUTOSAVE_BACKUP_KEY>:<timestamp>` keys.
 */
export const AUTOSAVE_BACKUP_KEY = "ship-builder:autosave:backup";

export interface SavedShip {
  id: string;
  name: string;
  savedAt: number;
  ship: Ship;
  /** Parts that no longer fit and were removed from `ship` on load. */
  dropped: number;
}

/** "invalid" means something is stored but this build can't read it. */
export type AutosaveResult =
  | { kind: "none" }
  | { kind: "ok"; ship: Ship; savedId: string | null; dropped: number }
  | { kind: "invalid" };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * `ok: false` only when storage itself throws on read, so callers can tell
 * "unreadable" (don't overwrite) apart from "absent or corrupt" (null value).
 */
function readStored(
  key: string
): { ok: true; value: unknown; text: string | null } | { ok: false } {
  let text: string | null;
  try {
    text = storage()?.getItem(key) ?? null;
  } catch {
    return { ok: false };
  }
  try {
    return { ok: true, value: text ? JSON.parse(text) : null, text };
  } catch {
    return { ok: true, value: null, text };
  }
}

function readJson(key: string): unknown {
  const stored = readStored(key);
  return stored.ok ? stored.value : null;
}

function writeJson(key: string, value: unknown): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadAutosave(): AutosaveResult {
  const stored = readStored(AUTOSAVE_KEY);
  // Unreadable storage is reported when saving fails, not here.
  if (!stored.ok || !stored.text) return { kind: "none" };
  const raw = stored.value;
  const parsed = isRecord(raw) ? parseShip(raw.ship) : null;
  if (!isRecord(raw) || !parsed?.ok) {
    // The next change overwrites the autosave, so keep a copy first.
    backupText(AUTOSAVE_BACKUP_KEY, stored.text);
    return { kind: "invalid" };
  }
  // A repaired ship is autosaved over the original on the next change, so
  // keep the full original in case the parts were dropped by a rules bug.
  if (parsed.dropped > 0) backupText(AUTOSAVE_BACKUP_KEY, stored.text);
  const savedId = typeof raw.savedId === "string" ? raw.savedId : null;
  return { kind: "ok", ship: parsed.ship, savedId, dropped: parsed.dropped };
}

export function saveAutosave(ship: Ship, savedId: string | null): boolean {
  return writeJson(AUTOSAVE_KEY, { ship, savedId });
}

export function listShips(): SavedShip[] {
  return parseShipList(readJson(SHIPS_KEY));
}

/**
 * Validation happens only here, on read. Writers work on the raw stored
 * entries so that anything this build can't parse (a newer deploy's format,
 * or data tripped by a rules bug) survives untouched.
 */
function parseShipList(raw: unknown): SavedShip[] {
  if (!Array.isArray(raw)) return [];
  const newestById = new Map<string, SavedShip>();
  for (const entry of raw) {
    const parsed = parseEntry(entry);
    if (!parsed) continue;
    const existing = newestById.get(parsed.id);
    if (existing && existing.savedAt >= parsed.savedAt) continue;
    newestById.set(parsed.id, parsed);
  }
  return [...newestById.values()].sort((a, b) => b.savedAt - a.savedAt);
}

function parseEntry(entry: unknown): SavedShip | null {
  if (!isRecord(entry) || typeof entry.id !== "string") return null;
  const parsed = parseShip(entry.ship);
  if (!parsed.ok) return null;
  return {
    id: entry.id,
    // The validated ship name is length-checked; entry.name is not.
    name: parsed.ship.name,
    savedAt: finiteSavedAt(entry.savedAt),
    ship: parsed.ship,
    dropped: parsed.dropped,
  };
}

/** A bad timestamp sorts the entry last rather than hiding a good ship. */
function finiteSavedAt(savedAt: unknown): number {
  return typeof savedAt === "number" && Number.isFinite(savedAt) ? savedAt : 0;
}

/**
 * JSON can't hold Infinity (a huge literal like 1e400 parses to it), so
 * write such timestamps back as 0 instead of letting them become null.
 */
function normaliseSavedAt(entry: unknown): unknown {
  return isRecord(entry) &&
    typeof entry.savedAt === "number" &&
    !Number.isFinite(entry.savedAt)
    ? { ...entry, savedAt: 0 }
    : entry;
}

/**
 * Valid JSON that is neither an array nor null, e.g. a newer deploy's
 * format. Corrupt text reads as null and is simply overwritten.
 */
function isUnknownFormat(value: unknown): boolean {
  return value !== null && !Array.isArray(value);
}

/**
 * Stored entries this build can't read; hidden from the list. A whole list
 * in an unknown format counts as one, so the player can still clear it when
 * it can't be backed up and is blocking every save.
 */
export function countUnreadableShips(): number {
  const raw = readJson(SHIPS_KEY);
  if (isUnknownFormat(raw)) return 1;
  if (!Array.isArray(raw)) return 0;
  return raw.filter((entry) => !parseEntry(entry)).length;
}

/**
 * Removes only the entries {@link countUnreadableShips} counts. The player
 * confirmed this, so an unknown-format list is replaced even when it can't
 * be backed up first.
 */
export function clearUnreadableShips(): boolean {
  const stored = readStored(SHIPS_KEY);
  if (!stored.ok) return false;
  if (isUnknownFormat(stored.value)) {
    backupShipsText(stored.text);
    return writeJson(SHIPS_KEY, []);
  }
  return updateShips((entries) =>
    entries.filter((entry) => parseEntry(entry) !== null)
  );
}

function entryId(entry: unknown): unknown {
  return isRecord(entry) ? entry.id : undefined;
}

export function saveShip(
  ship: Ship,
  id: string | null,
  now: number = Date.now()
): SavedShip | null {
  const entry: SavedShip = {
    id: id ?? newId("ship"),
    name: ship.name,
    savedAt: now,
    ship,
    dropped: 0,
  };
  const saved = updateShips((entries) => [
    entry,
    ...entries.filter((e) => entryId(e) !== entry.id),
  ]);
  return saved ? entry : null;
}

/**
 * Read-modify-write of the raw stored entries; entries the update doesn't
 * touch are written back exactly as stored. Refuses to write when the list
 * can't be read, since writing then would wipe every saved ship.
 */
function updateShips(update: (entries: unknown[]) => unknown[]): boolean {
  const stored = readStored(SHIPS_KEY);
  if (!stored.ok) return false;
  if (Array.isArray(stored.value)) {
    return writeJson(SHIPS_KEY, update(stored.value.map(normaliseSavedAt)));
  }
  // Keep a copy of an unknown format before replacing it. Corrupt text has
  // nothing worth keeping.
  if (isUnknownFormat(stored.value) && !backupShipsText(stored.text)) {
    return false;
  }
  return writeJson(SHIPS_KEY, update([]));
}

function backupShipsText(text: string | null): boolean {
  return backupText(SHIPS_BACKUP_KEY, text);
}

/**
 * Copies `text` to `backupKey`. If that key already holds something else (an
 * earlier backup, or garbage), the copy goes to a fresh
 * `<backupKey>:<timestamp>` key instead, so no backup is ever lost. Returns
 * false only when the copy couldn't be written.
 */
function backupText(backupKey: string, text: string | null): boolean {
  const store = storage();
  if (!store || text === null) return false;
  try {
    const existing = store.getItem(backupKey);
    if (existing === text) return true;
    if (existing === null) {
      store.setItem(backupKey, text);
      return true;
    }
    const base = `${backupKey}:${Date.now()}`;
    let key = base;
    for (let n = 1; ; n++) {
      const taken = store.getItem(key);
      if (taken === text) return true;
      if (taken === null) break;
      key = `${base}-${n}`;
    }
    store.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

export function deleteShip(id: string): boolean {
  return updateShips((entries) => entries.filter((e) => entryId(e) !== id));
}

export function renameShip(id: string, name: string): boolean {
  const clamped = clampName(name);
  return updateShips((entries) =>
    entries.map((e) =>
      // Only entries this build can read: a hidden twin with the same id
      // (say, from a newer deploy) must survive untouched.
      isRecord(e) && e.id === id && isRecord(e.ship) && parseShip(e.ship).ok
        ? { ...e, name: clamped, ship: { ...e.ship, name: clamped } }
        : e
    )
  );
}
