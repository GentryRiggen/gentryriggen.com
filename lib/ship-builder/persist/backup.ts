import type { Ship } from "../model/types";
import { listShips, saveShip } from "./local";

export type BackupResult = "backed-up" | "not-needed" | "failed";

/**
 * Keeps a ship that is about to be replaced (by a friend's share link) safe in
 * My Ships. Nothing is saved for an empty hull, or for a ship that My Ships
 * already holds in the same state.
 */
export function backUpShip(ship: Ship): BackupResult {
  if (ship.parts.length === 0) return "not-needed";
  const json = JSON.stringify(ship);
  const isKept = listShips().some(
    (entry) => JSON.stringify(entry.ship) === json
  );
  if (isKept) return "not-needed";
  const name = ship.name.trim() || "My ship";
  return saveShip({ ...ship, name: `${name} (backup)` }, null)
    ? "backed-up"
    : "failed";
}
