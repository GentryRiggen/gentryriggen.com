import {
  beamOf,
  buildOccupancy,
  cellKey,
  gridLength,
  isInsideHull,
  MAX_LEVEL,
  topLevel,
  WING_REACH,
} from "@/lib/ship-builder/model/grid";
import type { GridAnchor, Ship } from "@/lib/ship-builder/model/types";

export interface GridTarget extends GridAnchor {
  /** Outside the hull's columns: drawn in a different colour. */
  isWing: boolean;
}

const NEIGHBOUR_STEPS = [
  { dx: -1, dz: 0 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: -1 },
  { dx: 0, dz: 1 },
] as const;

/**
 * The cells a grid part could be dropped on: the next free level of every hull
 * column, plus wing columns next to an occupied cell at the same level, so the
 * water isn't covered in targets that could never be placed.
 */
export function gridTargetAnchors(ship: Ship): GridTarget[] {
  const occupancy = buildOccupancy(ship);
  const targets: GridTarget[] = [];
  for (let x = 0; x < gridLength(ship); x++) {
    for (let z = -WING_REACH; z <= beamOf(ship) - 1 + WING_REACH; z++) {
      const level = topLevel(occupancy, x, z) + 1;
      if (level > MAX_LEVEL) continue;
      const isWing = !isInsideHull(ship, { level, x, z });
      const hasNeighbour = NEIGHBOUR_STEPS.some(({ dx, dz }) =>
        occupancy.has(cellKey({ level, x: x + dx, z: z + dz }))
      );
      if (isWing && !hasNeighbour) continue;
      targets.push({ kind: "grid", level, x, z, isWing });
    }
  }
  return targets;
}
