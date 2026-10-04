import { buildOccupancy, type Occupancy } from "./grid";
import type { PlacedPart, Ship } from "./types";

interface Entry {
  occupancy: Occupancy;
  parts: readonly PlacedPart[];
  count: number;
}

const entries = new WeakMap<Ship, Entry>();

/** Makes a shared occupancy throw on writes outside production. */
function guardReadOnly(occupancy: Occupancy): void {
  if (process.env.NODE_ENV === "production") return;
  const refuse = (): never => {
    throw new Error("A ship's cached occupancy is read-only");
  };
  occupancy.set = refuse;
  occupancy.delete = refuse;
  occupancy.clear = refuse;
}

/**
 * The ship's cell occupancy, built once per ship object. Ships are replaced
 * on every edit, so identity is the cache key; the parts array and its length
 * are checked too, because a rebuild in progress appends to its ship in place.
 * Treat the result as read-only.
 */
export function occupancyOf(ship: Ship): Occupancy {
  const cached = entries.get(ship);
  if (
    cached &&
    cached.parts === ship.parts &&
    cached.count === ship.parts.length
  ) {
    return cached.occupancy;
  }
  const occupancy = buildOccupancy(ship);
  guardReadOnly(occupancy);
  entries.set(ship, {
    occupancy,
    parts: ship.parts,
    count: ship.parts.length,
  });
  return occupancy;
}
