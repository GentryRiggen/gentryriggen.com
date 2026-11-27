import { deckZAt } from "../places";
import type { ShipId, ShipSpec } from "../ships/types";

/**
 * Walk the decks: the shapes a walker can stand on, as ship data.
 *
 * Ship frame, as the rest of the game: metres, origin on the keel at
 * midships, x forward, y to port, z up from the keel. A walker's feet are
 * always on an area's floor, `floorZ` (the deck's height plus its sheer),
 * so they cannot fall through; the sim's pose turns that into the world.
 */

export type V2 = readonly [x: number, y: number];

export interface WalkArea {
  /** "boat-deck", "forward-well", "forecastle", "aft-well", "poop", ... */
  id: string;
  /** A name in spec.decks; the floor is deckZAt(deck, x, spec). */
  deck: string;
  /** Extra height above that deck (e.g. a house roof); default 0. */
  raiseM?: number;
  /**
   * Closed polygon, counter-clockwise. Every edge holds you in: edges are
   * railings unless listed in wallEdges.
   */
  outline: readonly V2[];
  /**
   * Indices i of edges outline[i]→outline[i+1] that are a house side or
   * bulkhead, or a rail over a lower deck rather than the sea.
   */
  wallEdges?: readonly number[];
  /**
   * A room inside her (see README "Inside"): no jumping, the inside speed,
   * every edge a wall unless it is a seam, never a sea railing.
   */
  interior?: true;
  /** A flight of stairs as a ramp: the floor falls dropM from `from` to `to`. */
  ramp?: { from: V2; to: V2; dropM: number };
  /** A corridor's centre line (hall assist). */
  axis?: readonly [V2, V2];
  /** What the room is ("foyer", "corridor", "cabin", ...), for the scene. */
  kind?: string;
  /** Drawn but not walkable (no link or seam leads into it). */
  noWalk?: true;
}

/**
 * An open edge between two areas at equal floor height (a doorway): the
 * walker crosses it instead of stopping. `at` matches an edge of each
 * area's outline (either way round, within 1 mm).
 */
export interface Seam {
  a: string;
  b: string;
  at: readonly [V2, V2];
}

export type Blocker =
  /** Funnel bases, masts, ventilators. */
  | { kind: "circle"; area: string; at: V2; r: number }
  /** Deckhouses, skylights, hatches, davits. */
  | { kind: "box"; area: string; min: V2; max: V2 };

export interface Stair {
  id: string;
  from: { area: string; at: V2 };
  to: { area: string; at: V2 };
  widthM: number;
  /**
   * "door" (a deck door: shut while interiors are closed), "lift" (stays
   * put while its arrival is flooded) or "stair" (the default).
   */
  kind?: "stair" | "door" | "lift";
}

export interface WalkMap {
  ship: ShipId;
  areas: readonly WalkArea[];
  blockers: readonly Blocker[];
  stairs: readonly Stair[];
  /** Open edges between areas (interiors). */
  seams?: readonly Seam[];
  spawn: { area: string; at: V2; yaw: number };
}

// --- Tuning (see README.md) -------------------------------------------------

/** A jump: how long the walker is in the air (s) and how high (m). */
export const JUMP_S = 0.6;
export const JUMP_HEIGHT_M = 0.8;

/** Height over the floor `jumpS` seconds into a jump (null: on the floor). */
export function jumpHeight(jumpS: number | null | undefined): number {
  if (jumpS === null || jumpS === undefined) return 0;
  const u = Math.max(0, Math.min(1, jumpS / JUMP_S));
  return 4 * JUMP_HEIGHT_M * u * (1 - u);
}

/** Eye height over the feet (m). */
export const WALK_EYE_M = 1.6;
/** Water this deep over the feet (waist) puts you in the sea (m). */
export const WALK_IN_WATER_DEPTH_M = 1.0;
/** Knee depth (m): Back on deck never lands you deeper than this. */
export const WALK_KNEE_DEPTH_M = 0.5;
/** Walking speed on a dry deck (m/s): a brisk run, for fun (was 1.4). */
export const WALK_SPEED_MS = 4;
/** Turn per pixel of look drag (rad). */
export const WALK_TURN_PER_PX = 0.005;
/** The walker's body radius for blockers and railings (m). */
export const WALK_RADIUS_M = 0.3;
/** Walking speed in an interior area (m/s): calmer for narrow halls. */
export const WALK_INSIDE_SPEED_MS = 3;
/** A lift does not go while its arrival is deeper than this (m). */
export const WALK_LIFT_MAX_DEPTH_M = WALK_KNEE_DEPTH_M;

// --- Plan geometry ----------------------------------------------------------

/** Whether p is inside a closed polygon (even-odd rule). */
export function pointInPolygon(p: V2, poly: readonly V2[]): boolean {
  const [px, py] = p;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// --- Per-map lookups, built once per map on first use ----------------------

interface MapIndex {
  blockers: Map<string, Blocker[]>;
  /** Per area, per outline edge: the area across that seam, or null. */
  seams: Map<string, (string | null)[]>;
}

const INDEX = new WeakMap<WalkMap, MapIndex>();
const NO_BLOCKERS: readonly Blocker[] = [];
const SEAM_TOL_M = 1e-3;

function near(p: V2, q: V2): boolean {
  return (
    Math.abs(p[0] - q[0]) <= SEAM_TOL_M && Math.abs(p[1] - q[1]) <= SEAM_TOL_M
  );
}

function mapIndex(map: WalkMap): MapIndex {
  let ix = INDEX.get(map);
  if (ix) return ix;
  const blockers = new Map<string, Blocker[]>();
  for (const b of map.blockers) {
    const list = blockers.get(b.area);
    if (list) list.push(b);
    else blockers.set(b.area, [b]);
  }
  const seams = new Map<string, (string | null)[]>();
  for (const seam of map.seams ?? []) {
    for (const [self, other] of [
      [seam.a, seam.b],
      [seam.b, seam.a],
    ] as const) {
      const area = map.areas.find((x) => x.id === self);
      if (!area) continue;
      const poly = area.outline;
      let edges = seams.get(self);
      if (!edges) {
        edges = poly.map(() => null);
        seams.set(self, edges);
      }
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const [p, q] = seam.at;
        if ((near(a, p) && near(b, q)) || (near(a, q) && near(b, p)))
          edges[i] = other;
      }
    }
  }
  ix = { blockers, seams };
  INDEX.set(map, ix);
  return ix;
}

/** The blockers in one area (precomputed per map). */
export function blockersIn(map: WalkMap, areaId: string): readonly Blocker[] {
  return mapIndex(map).blockers.get(areaId) ?? NO_BLOCKERS;
}

/**
 * Per outline edge of an area, the area across it when it is a seam (null
 * for a wall or railing), or null when the area has no seams.
 */
export function seamEdges(
  map: WalkMap,
  areaId: string
): readonly (string | null)[] | null {
  return mapIndex(map).seams.get(areaId) ?? null;
}

/** Whether a body of radius `r` at p overlaps any blocker in that area. */
export function insideBlocker(
  map: WalkMap,
  areaId: string,
  p: V2,
  r: number
): boolean {
  for (const b of blockersIn(map, areaId)) {
    if (b.kind === "circle") {
      if (Math.hypot(p[0] - b.at[0], p[1] - b.at[1]) < b.r + r) return true;
    } else {
      const cx = Math.max(b.min[0], Math.min(b.max[0], p[0]));
      const cy = Math.max(b.min[1], Math.min(b.max[1], p[1]));
      if (Math.hypot(p[0] - cx, p[1] - cy) < r) return true;
      if (
        r === 0 &&
        p[0] >= b.min[0] &&
        p[0] <= b.max[0] &&
        p[1] >= b.min[1] &&
        p[1] <= b.max[1]
      )
        return true;
    }
  }
  return false;
}

/** An area by id, or undefined. */
export function areaById(map: WalkMap, id: string): WalkArea | undefined {
  return map.areas.find((a) => a.id === id);
}

/**
 * The floor's height (ship-frame z) of an area at (x, y). A ramp falls
 * `dropM` linearly along `from → to` (the projection clamped to its ends);
 * every other floor ignores y.
 */
export function floorZ(
  map: WalkMap,
  areaId: string,
  x: number,
  spec: ShipSpec,
  y = 0
): number {
  const a = areaById(map, areaId);
  if (!a) throw new Error(`walk map ${map.ship} has no area ${areaId}`);
  const z = deckZAt(a.deck, x, spec) + (a.raiseM ?? 0);
  const ramp = a.ramp;
  if (!ramp) return z;
  const dx = ramp.to[0] - ramp.from[0];
  const dy = ramp.to[1] - ramp.from[1];
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return z;
  const u = ((x - ramp.from[0]) * dx + (y - ramp.from[1]) * dy) / len2;
  return z - ramp.dropM * Math.max(0, Math.min(1, u));
}

/**
 * The rail's y at x on one side of an outline (the outermost edge crossing
 * x), for placing davits and the like against the side.
 */
export function railYAt(
  outline: readonly V2[],
  x: number,
  side: "port" | "starboard"
): number {
  let best: number | null = null;
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (a[0] === b[0]) continue;
    const lo = Math.min(a[0], b[0]);
    const hi = Math.max(a[0], b[0]);
    if (x < lo || x > hi) continue;
    const y = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    if (best === null || (side === "port" ? y > best : y < best)) best = y;
  }
  if (best === null) throw new Error(`no rail at x ${x}`);
  return best;
}
