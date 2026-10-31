import { resolveAttachPoint } from "../model/attach";
import { getPartDef } from "../model/catalog";
import { buildOccupancy } from "../model/grid";
import type { Stats as ShipStats } from "../model/stats";
import type { AttachPoint, GridAnchor, PlacedPart, Ship } from "../model/types";

/** A lifeboat the evacuation can lower: hung from a davit on a grid block. */
export interface HungLifeboat {
  part: PlacedPart;
  /** Catalog seats (real people). */
  seats: number;
  /** The grid block the davit stands on. */
  block: PlacedPart & { anchor: GridAnchor };
  /** Where the boat hangs. */
  hang: AttachPoint;
  /** Where the davit stands. */
  mount: AttachPoint;
}

/**
 * Every lifeboat that hangs from a davit (`davit` or `davit-side`) standing
 * on a grid block, with both points resolved. The evacuation lowers exactly
 * these boats and the seat count sums exactly these, so the two always agree.
 */
export function hungLifeboats(
  ship: Ship,
  occupancy = buildOccupancy(ship)
): HungLifeboat[] {
  const byId = new Map(ship.parts.map((part) => [part.id, part]));
  const boats: HungLifeboat[] = [];
  for (const part of ship.parts) {
    const seats = getPartDef(part.type).seats ?? 0;
    if (seats <= 0 || part.anchor.kind !== "attach") continue;
    const davit = byId.get(part.anchor.parentId);
    if (
      !davit ||
      (davit.type !== "davit" && davit.type !== "davit-side") ||
      davit.anchor.kind !== "attach"
    ) {
      continue;
    }
    const block = byId.get(davit.anchor.parentId);
    if (!block || block.anchor.kind !== "grid") continue;
    const hang = resolveAttachPoint(ship, part.anchor, occupancy);
    const mount = resolveAttachPoint(ship, davit.anchor, occupancy);
    if (!hang || !mount) continue;
    boats.push({
      part,
      seats,
      block: { ...block, anchor: block.anchor },
      hang,
      mount,
    });
  }
  return boats;
}

/**
 * The real lifeboat sum for "did we build enough lifeboats?": the catalog
 * `seats` of every boat the evacuation lowers (`hungLifeboats`), against
 * everyone aboard (passengers plus crew berths). Real counts, not crowd
 * figures.
 */
export function lifeboatCount(
  ship: Ship,
  stats: ShipStats
): { seats: number; people: number } {
  const seats = hungLifeboats(ship).reduce((n, boat) => n + boat.seats, 0);
  return { seats, people: peopleAboard(stats) };
}

/** Everyone aboard in real counts: passengers plus crew berths. */
export function peopleAboard(stats: ShipStats): number {
  return stats.passengers.total + stats.crewBerths;
}
