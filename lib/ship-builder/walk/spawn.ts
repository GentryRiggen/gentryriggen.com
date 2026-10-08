import { getPartDef } from "../model/catalog";
import { MAX_LEVEL, rotatedFootprint, WING_REACH } from "../model/grid";
import type { Ship } from "../model/types";
import { SIM_STEP_S } from "../sim/types";
import { stepWalker } from "./step";
import {
  WALK_SPEED,
  WALKER_RADIUS,
  type WalkGrid,
  type WalkState,
} from "./types";
import { walkGridOf } from "./walkGrid";

const SURFACE_LEVELS = MAX_LEVEL + 2;
/** A spawn spot must lead somewhere: at least this many connected cells. */
const MIN_REGION_CELLS = 4;
/** Yaw 0 looks at the bow; yaw PI looks at the stern. */
const STERN_YAW = Math.PI;
/** The headings tried at the start, in order of preference (bow first). */
const SPAWN_HEADINGS = [0, 1, -1, 2, -2, 3, -3, -4].map(
  (step) => (step * Math.PI) / 4
);
/** The same headings turned to face aft first, for a start at the bow. */
const BOW_START_HEADINGS = SPAWN_HEADINGS.map((yaw) =>
  yaw + STERN_YAW > Math.PI ? yaw - STERN_YAW : yaw + STERN_YAW
);

/** Where the walk begins: the front, the bridge or middle, or the back. */
export type WalkStart = "bow" | "middle" | "stern";
/** How long a look-ahead walk lasts, in seconds. */
const LOOK_AHEAD_S = 1.5;
/** Facing this far of open walking is far enough to stop looking. */
const OPEN_AHEAD_CELLS = WALK_SPEED * LOOK_AHEAD_S * 0.9;

interface Spot {
  x: number;
  z: number;
  level: number;
}

const spotKey = (spot: Spot): string => `${spot.level}:${spot.x}:${spot.z}`;

/**
 * Where the player would like to start: the bow tip or stern end on the
 * centreline, or for the middle the bridge, else mid-ship.
 */
function preferredPoint(
  ship: Ship,
  grid: WalkGrid,
  start: WalkStart
): { x: number; z: number } {
  if (start === "bow") return { x: 0, z: grid.beam / 2 };
  if (start === "stern") return { x: grid.length, z: grid.beam / 2 };
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

/** How far a walker standing here can walk straight ahead of `yaw`. */
function openAhead(grid: WalkGrid, start: WalkState): number {
  let state = start;
  const forward = { forward: 1, strafe: 0, turn: 0 };
  for (let t = 0; t < LOOK_AHEAD_S; t += SIM_STEP_S) {
    state = stepWalker(state, forward, grid);
  }
  return Math.hypot(state.x - start.x, state.z - start.z);
}

/**
 * The heading to start with: the bow when there is open deck that way, else
 * the heading with the most room (tried right then left of the bow, in 45
 * degree steps), so nobody starts with their nose against a wall. A start at
 * the bow looks aft first instead, back along the ship.
 */
function spawnYaw(
  grid: WalkGrid,
  spot: WalkState,
  headings: readonly number[]
): number {
  let best = headings[0];
  let bestOpen = -1;
  for (const yaw of headings) {
    const open = openAhead(grid, { ...spot, yaw });
    if (open >= OPEN_AHEAD_CELLS) return yaw;
    if (open > bestOpen + 1e-6) {
      best = yaw;
      bestOpen = open;
    }
  }
  return best;
}

/**
 * A clear place to start walking, as a standing state facing open deck (the
 * bow when it can), or null when there is nowhere to stand. It prefers the main deck (level 0) and goes
 * to the lowest roof only when the main deck is built over completely; it
 * skips cells too close to a funnel or mast and pockets cut off from the rest
 * of the deck; and among those it takes the cell nearest the bridge, or the
 * middle of the ship when there is no bridge. A `bow` or `stern` start takes
 * the cell nearest that end of the centreline instead.
 */
export function spawnOf(
  ship: Ship,
  grid: WalkGrid = walkGridOf(ship),
  start: WalkStart = "middle"
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
  const target = preferredPoint(ship, grid, start);

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
  const headings = start === "bow" ? BOW_START_HEADINGS : SPAWN_HEADINGS;
  const standing: WalkState = {
    x: best.x + 0.5,
    z: best.z + 0.5,
    yaw: headings[0],
    level: best.level,
    time: 0,
  };
  return { ...standing, yaw: spawnYaw(grid, standing, headings) };
}
