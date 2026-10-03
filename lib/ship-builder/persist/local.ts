import { newId } from "../model/ids";
import { MAX_NAME_LENGTH } from "../model/placement";
import type { Ship } from "../model/types";
import { parseShip } from "./schema";

export const AUTOSAVE_KEY = "ship-builder:autosave";
export const SHIPS_KEY = "ship-builder:ships";

export interface SavedShip {
  id: string;
  name: string;
  savedAt: number;
  ship: Ship;
}

export interface Autosave {
  ship: Ship;
  savedId: string | null;
}

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
function readStored(key: string): { ok: true; value: unknown } | { ok: false } {
  let text: string | null | undefined;
  try {
    text = storage()?.getItem(key);
  } catch {
    return { ok: false };
  }
  try {
    return { ok: true, value: text ? JSON.parse(text) : null };
  } catch {
    return { ok: true, value: null };
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

export function loadAutosave(): Autosave | null {
  const raw = readJson(AUTOSAVE_KEY);
  if (!isRecord(raw)) return null;
  const parsed = parseShip(raw.ship);
  if (!parsed.ok) return null;
  const savedId = typeof raw.savedId === "string" ? raw.savedId : null;
  return { ship: parsed.ship, savedId };
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
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.savedAt !== "number" ||
      !Number.isFinite(entry.savedAt)
    ) {
      continue;
    }
    const parsed = parseShip(entry.ship);
    if (!parsed.ok) continue;
    const existing = newestById.get(entry.id);
    if (existing && existing.savedAt >= entry.savedAt) continue;
    newestById.set(entry.id, {
      id: entry.id,
      // The validated ship name is length-checked; entry.name is not.
      name: parsed.ship.name,
      savedAt: entry.savedAt,
      ship: parsed.ship,
    });
  }
  return [...newestById.values()].sort((a, b) => b.savedAt - a.savedAt);
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
  const entries = Array.isArray(stored.value) ? stored.value : [];
  return writeJson(SHIPS_KEY, update(entries));
}

export function deleteShip(id: string): boolean {
  return updateShips((entries) => entries.filter((e) => entryId(e) !== id));
}

export function renameShip(id: string, name: string): boolean {
  const clamped = name.slice(0, MAX_NAME_LENGTH);
  return updateShips((entries) =>
    entries.map((e) =>
      isRecord(e) && e.id === id && isRecord(e.ship)
        ? { ...e, name: clamped, ship: { ...e.ship, name: clamped } }
        : e
    )
  );
}
