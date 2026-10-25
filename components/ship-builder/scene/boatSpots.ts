import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { Ship } from "@/lib/ship-builder/model/types";
import { modelToWorld } from "./coords";
import { lifeboatHullOf, type LifeboatHull } from "./lifeboatHulls";

export interface BoatSpot {
  hull: LifeboatHull;
  /** Hang point in the ship's frame (world units, inside the bob group). */
  hang: { x: number; y: number; z: number };
}

/**
 * Every boat that can carry riders (any attached part with seats, the same
 * rule the evacuation planner uses), keyed by part id.
 */
export function boatSpotsOf(ship: Ship): Map<string, BoatSpot> {
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const spots = new Map<string, BoatSpot>();
  for (const part of ship.parts) {
    if (
      part.anchor.kind !== "attach" ||
      (getPartDef(part.type).seats ?? 0) <= 0
    ) {
      continue;
    }
    const point = resolveAttachPoint(ship, part.anchor);
    if (!point) continue;
    const [x, y, z] = modelToWorld(length, beam, point.position);
    spots.set(part.id, { hull: lifeboatHullOf(part.type), hang: { x, y, z } });
  }
  return spots;
}
