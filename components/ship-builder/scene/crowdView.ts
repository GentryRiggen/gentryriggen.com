import {
  BOAT_SHOWN_MAX,
  LOWER_S,
  RAFT_DROP_S,
} from "@/lib/ship-builder/crowd/evacuation";
import { crowdSize, planCrowd } from "@/lib/ship-builder/crowd/plan";
import type { CrowdPlan, PersonPose } from "@/lib/ship-builder/crowd/types";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import type { Ship } from "@/lib/ship-builder/model/types";
import {
  walkGridOf,
  type StairLink,
  type WalkGrid,
} from "@/lib/ship-builder/walk";
import { DECK_Y, LEVEL_HEIGHT } from "./coords";
import { LIFEBOAT_HANG_OFFSET, type LifeboatHull } from "./lifeboatHulls";
import { halfOfX, type HalfSide } from "./partHalves";

export interface PersonTransform {
  x: number;
  y: number;
  z: number;
  /** Rotation about world Y for a figure drawn facing local +X. */
  rotationY: number;
}

/** Half the width of a figure (arms included), in world units. */
export const PERSON_HALF_WIDTH = 0.15;

const stairsUpByGrid = new WeakMap<WalkGrid, Map<string, StairLink>>();

/** The stairs climbing out of each cell, keyed "x,z,level" by their low end. */
function stairsUp(grid: WalkGrid): Map<string, StairLink> {
  let links = stairsUpByGrid.get(grid);
  if (!links) {
    links = new Map();
    for (const link of grid.stairs) {
      if (link.to.level <= link.from.level) continue;
      const { x, z, level } = link.from;
      links.set(`${x},${z},${level}`, link);
    }
    stairsUpByGrid.set(grid, links);
  }
  return links;
}

export function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * The height a person's feet are at, in levels. On a stair cell it climbs
 * from the stair's foot (its outer edge) to the roof it leads to (the edge it
 * shares with that block), so nobody pops up or down a level at a cell edge.
 * Stepping onto the stairs from the side eases in from the floor too.
 * Elsewhere it is the floor's height (a little low on bridge roofs).
 */
export function personHeight(
  grid: WalkGrid,
  x: number,
  z: number,
  level: number
): number {
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  const floor = grid.surfaceHeight(cx, cz, level);
  const link = stairsUp(grid).get(`${cx},${cz},${level}`);
  if (!link) return floor;
  const dx = link.to.x - cx;
  const dz = link.to.z - cz;
  const u = x - cx;
  const w = z - cz;
  const along = dx !== 0 ? (dx > 0 ? u : 1 - u) : dz > 0 ? w : 1 - w;
  const across = dx !== 0 ? w : u;
  const fromSide = smoothstep(Math.min(across, 1 - across) / 0.5);
  const top = grid.surfaceHeight(link.to.x, link.to.z, link.to.level);
  return floor + Math.min(1, Math.max(0, along)) * fromSide * (top - floor);
}

/**
 * Where a person stands in the ship's world frame (inside the bob group).
 * x and z follow `modelToWorld`; y is the floor height (`personHeight`).
 * Yaw is the walker's heading, facing `(cos yaw, sin yaw)` in (worldX,
 * worldZ); three.js turns local +X to `(cos r, -sin r)`, so the rotation is
 * `-yaw`.
 */
export function personWorldTransform(
  pose: PersonPose,
  grid: WalkGrid,
  length: number,
  beam: number,
  out: PersonTransform = { x: 0, y: 0, z: 0, rotationY: 0 }
): PersonTransform {
  const height = personHeight(grid, pose.x, pose.z, pose.level);
  out.x = length / 2 - pose.x;
  out.y = DECK_Y + height * LEVEL_HEIGHT;
  out.z = beam / 2 - pose.z;
  out.rotationY = -pose.yaw;
  return out;
}

/** What carries a person aboard: the whole ship, or one half once broken. */
export type Carrier = "whole" | HalfSide;

/**
 * The group an aboard person rides in, `cellsFromBow` along the ship: the
 * whole ship until she breaks (`atX` null), then the half they stand on.
 */
export function carrierOf(cellsFromBow: number, atX: number | null): Carrier {
  return atX === null ? "whole" : halfOfX(cellsFromBow, atX);
}

/**
 * Where each rider sits in a boat, relative to its hang point, at the rim (a
 * sitter drops into the hull): up to BOAT_SHOWN_MAX in a row down the
 * middle, spread along its length. More (only when filling every seat) pack
 * in two rows side by side, closer together, so every rider shows.
 */
export function boatSeatOffsets(
  count: number,
  hull: LifeboatHull
): { x: number; y: number; z: number }[] {
  const n = Math.max(0, Math.floor(count));
  const room = hull.length - 2 * PERSON_HALF_WIDTH - 0.04;
  if (n <= BOAT_SHOWN_MAX) {
    const spacing = n > 1 ? Math.min(0.22, room / (n - 1)) : 0;
    return Array.from({ length: n }, (_, k) => ({
      x: (k - (n - 1) / 2) * spacing,
      y: -LIFEBOAT_HANG_OFFSET,
      z: 0,
    }));
  }
  const perRow = Math.ceil(n / 2);
  const spacing = Math.min(0.22, room / (perRow - 1));
  return Array.from({ length: n }, (_, k) => {
    const row = k % 2;
    const along = Math.floor(k / 2);
    return {
      x: (along - (perRow - 1) / 2) * spacing,
      y: -LIFEBOAT_HANG_OFFSET,
      z: (row === 0 ? -1 : 1) * (hull.width / 4),
    };
  });
}

/** How deep a boat afloat sits: this much of its hull is under the water. */
const AFLOAT_DRAFT = 0.55;

/**
 * How far a launched boat is lifted above `boatPoseAt`, `sinceLaunch`
 * seconds after it starts lowering. That pose brings the hang point down to
 * the water; afloat the hull should ride with most of its depth under, so
 * the lift grows with the lowering, from nothing on the davit.
 */
export function boatAfloatLift(
  hull: LifeboatHull,
  sinceLaunch: number
): number {
  return (
    smoothstep(sinceLaunch / LOWER_S) *
    (LIFEBOAT_HANG_OFFSET + AFLOAT_DRAFT * hull.depth)
  );
}

/** An open raft's floor sits this far above the water. */
const RAFT_FLOOR = 0.03;

/**
 * How far a raft is lifted above `boatPoseAt`, `sinceLaunch` seconds after it
 * is thrown: its origin is the deck edge it went from, so on the water the
 * lift puts its floor (where a sitter's seat, `LIFEBOAT_HANG_OFFSET` below
 * the origin, lands) just above the surface.
 */
export function raftAfloatLift(sinceLaunch: number): number {
  return (
    smoothstep(sinceLaunch / RAFT_DROP_S) * (LIFEBOAT_HANG_OFFSET + RAFT_FLOOR)
  );
}

export interface ShipCrowd {
  grid: WalkGrid;
  plan: CrowdPlan;
}

const crowdByShip = new WeakMap<Ship, ShipCrowd>();

const EMPTY_CROWD: CrowdPlan = {
  people: [],
  seats: [],
  poseAt(i) {
    throw new RangeError(`No person ${i}`);
  },
};

/**
 * The walk grid and crowd plan for a ship, made once per ship object: walk
 * mode, the sea trial and its evacuation all share the same people.
 */
export function crowdPlanFor(ship: Ship): ShipCrowd {
  let crowd = crowdByShip.get(ship);
  if (!crowd) {
    const grid = walkGridOf(ship);
    const { stats } = analyzeShip(ship);
    const size = crowdSize(stats);
    // No cabins, no people: skip building the walking graph for nobody.
    const plan =
      size.passengers + size.crew > 0
        ? planCrowd(ship, grid, stats)
        : EMPTY_CROWD;
    crowd = { grid, plan };
    crowdByShip.set(ship, crowd);
  }
  return crowd;
}

/**
 * The lifeboats that have left their davits by `time` (sim seconds), worked
 * out from the time alone, so scrubbing back hangs them up again.
 */
export function launchedIdsAt(
  launches: readonly { boatId: string; at: number }[],
  time: number
): Set<string> {
  const ids = new Set<string>();
  for (const launch of launches) if (launch.at <= time) ids.add(launch.boatId);
  return ids;
}
