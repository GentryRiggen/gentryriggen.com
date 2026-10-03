import { newId } from "../model/ids";
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

function readJson(key: string): unknown {
  try {
    const text = storage()?.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
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
  const raw = readJson(SHIPS_KEY);
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
  const others = listShips().filter((s) => s.id !== entry.id);
  return writeJson(SHIPS_KEY, [entry, ...others]) ? entry : null;
}

export function deleteShip(id: string): boolean {
  return writeJson(
    SHIPS_KEY,
    listShips().filter((s) => s.id !== id)
  );
}

export function renameShip(id: string, name: string): boolean {
  return writeJson(
    SHIPS_KEY,
    listShips().map((s) =>
      s.id === id ? { ...s, name, ship: { ...s.ship, name } } : s
    )
  );
}
