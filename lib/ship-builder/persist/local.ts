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

function parseShipList(raw: unknown): SavedShip[] {
  if (!Array.isArray(raw)) return [];
  const ships: SavedShip[] = [];
  for (const entry of raw) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.name !== "string" ||
      typeof entry.savedAt !== "number"
    ) {
      continue;
    }
    const parsed = parseShip(entry.ship);
    if (!parsed.ok) continue;
    ships.push({
      id: entry.id,
      name: entry.name,
      savedAt: entry.savedAt,
      ship: parsed.ship,
    });
  }
  return ships.sort((a, b) => b.savedAt - a.savedAt);
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
  const saved = updateShips((ships) => [
    entry,
    ...ships.filter((s) => s.id !== entry.id),
  ]);
  return saved ? entry : null;
}

/**
 * Read-modify-write of the ship list. Refuses to write when the current list
 * can't be read, since writing then would wipe every saved ship.
 */
function updateShips(update: (ships: SavedShip[]) => SavedShip[]): boolean {
  const stored = readStored(SHIPS_KEY);
  if (!stored.ok) return false;
  return writeJson(SHIPS_KEY, update(parseShipList(stored.value)));
}

export function deleteShip(id: string): boolean {
  return updateShips((ships) => ships.filter((s) => s.id !== id));
}

export function renameShip(id: string, name: string): boolean {
  const clamped = name.slice(0, MAX_NAME_LENGTH);
  return updateShips((ships) =>
    ships.map((s) =>
      s.id === id
        ? { ...s, name: clamped, ship: { ...s.ship, name: clamped } }
        : s
    )
  );
}
