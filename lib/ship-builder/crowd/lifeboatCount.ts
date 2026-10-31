import { getPartDef } from "../model/catalog";
import type { Stats as ShipStats } from "../model/stats";
import type { Ship } from "../model/types";

/**
 * The real lifeboat sum for "did we build enough lifeboats?": the catalog
 * `seats` of every boat that hangs from a davit (`davit` or `davit-side`),
 * the boats the evacuation lowers, against everyone aboard (passengers plus
 * crew berths). Real counts, not crowd figures.
 */
export function lifeboatCount(
  ship: Ship,
  stats: ShipStats
): { seats: number; people: number } {
  const byId = new Map(ship.parts.map((part) => [part.id, part]));
  let seats = 0;
  for (const part of ship.parts) {
    const partSeats = getPartDef(part.type).seats ?? 0;
    if (partSeats <= 0 || part.anchor.kind !== "attach") continue;
    const davit = byId.get(part.anchor.parentId);
    if (davit?.type !== "davit" && davit?.type !== "davit-side") continue;
    seats += partSeats;
  }
  return { seats, people: stats.passengers.total + stats.crewBerths };
}
