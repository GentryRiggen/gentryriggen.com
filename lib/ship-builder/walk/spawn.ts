import { getPartDef } from "../model/catalog";
import { MAX_LEVEL, rotatedFootprint, WING_REACH } from "../model/grid";
import type { Ship } from "../model/types";
import { WALKER_RADIUS, type WalkGrid, type WalkState } from "./types";
import { walkGridOf } from "./walkGrid";

const SURFACE_LEVELS = MAX_LEVEL + 2;
/** A spawn spot must lead somewhere: at least this many connected cells. */
const MIN_REGION_CELLS = 4;
/** Yaw 0 looks at the bow. */
const SPAWN_YAW = 0;

interface Spot {
  x: number;
  z: number;
  level: number;
}

const spotKey = (spot: Spot): string => `${spot.level}:${spot.x}:${spot.z}`;

/** Where the player would like to start: the bridge, else mid-ship. */
function preferredPoint(ship: Ship, grid: WalkGrid): { x: number; z: number } {
  for (const part of ship.parts) {
    const def = getPartDef(part.type);
    if (def.placement !== "grid" || def.role !== "bridge") continue;
    if (part.anchor.kind !== "grid") continue;
    const size = rotatedFootprint(def.footprint, part.rotation);
    return {
      x: part.anchor.x + size.x / 2,
      z: part.anchor.z + size.z / 2,
    };
  }
  return { x: grid.length / 2, z: grid.beam / 2 };
}

/** Whether a cell's centre is clear of every blocker circle on its level. */
function isClear(grid: WalkGrid, spot: Spot): boolean {
  return grid
    .blockersAt(spot.level)
    .every(
      (circle) =>
        Math.hypot(spot.x + 0.5 - circle.x, spot.z + 0.5 - circle.z) >=
        circle.radius + WALKER_RADIUS
    );
}

/** How many cells each connected walkable region holds, keyed by cell. */
function regionSizes(grid: WalkGrid, spots: Spot[]): Map<string, number> {
  const sizes = new Map<string, number>();
  const seen = new Set<string>();
  const neighbours = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (const first of spots) {
    if (seen.has(spotKey(first))) continue;
    const region: Spot[] = [first];
    seen.add(spotKey(first));
    for (let head = 0; head < region.length; head++) {
      const spot = region[head];
      for (const [dx, dz] of neighbours) {
        const level = grid.stepLevel(
          spot.x,
          spot.z,
          spot.level,
          spot.x + dx,
          spot.z + dz
        );
        if (level === null) continue;
        const next = { x: spot.x + dx, z: spot.z + dz, level };
        if (seen.has(spotKey(next))) continue;
        seen.add(spotKey(next));
        region.push(next);
      }
    }
    for (const spot of region) sizes.set(spotKey(spot), region.length);
  }
  return sizes;
}

/**
 * A clear place to start walking, as a standing state facing the bow, or null
 * when there is nowhere to stand. It prefers the main deck (level 0) and goes
 * to the lowest roof only when the main deck is built over completely; it
 * skips cells too close to a funnel or mast and pockets cut off from the rest
 * of the deck; and among those it takes the cell nearest the bridge, or the
 * middle of the ship when there is no bridge.
 */
export function spawnOf(
  ship: Ship,
  grid: WalkGrid = walkGridOf(ship)
): WalkState | null {
  const spots: Spot[] = [];
  for (let level = 0; level < SURFACE_LEVELS; level++) {
    for (let z = -WING_REACH; z < grid.beam + WING_REACH; z++) {
      for (let x = 0; x < grid.length; x++) {
        const spot = { x, z, level };
        if (grid.isWalkable(x, z, level) && isClear(grid, spot)) {
          spots.push(spot);
        }
      }
    }
  }
  if (spots.length === 0) return null;

  const sizes = regionSizes(grid, spots);
  const isUseful = (spot: Spot) =>
    (sizes.get(spotKey(spot)) ?? 0) >= MIN_REGION_CELLS;
  const pool = spots.some(isUseful) ? spots.filter(isUseful) : spots;
  const lowest = Math.min(...pool.map((spot) => spot.level));
  const target = preferredPoint(ship, grid);

  let best: Spot | undefined;
  let bestDistance = Infinity;
  for (const spot of pool) {
    if (spot.level !== lowest) continue;
    const distance = Math.hypot(
      spot.x + 0.5 - target.x,
      spot.z + 0.5 - target.z
    );
    if (distance < bestDistance) {
      best = spot;
      bestDistance = distance;
    }
  }
  if (!best) return null;
  return {
    x: best.x + 0.5,
    z: best.z + 0.5,
    yaw: SPAWN_YAW,
    level: best.level,
    time: 0,
  };
}
