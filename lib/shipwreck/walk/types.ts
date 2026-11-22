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
  /** Closed polygon, counter-clockwise; edges are railings unless listed. */
  outline: readonly V2[];
  /**
   * Indices i of edges outline[i]→outline[i+1] that are not railings (a
   * ladder mouth): walking through one takes you off the deck.
   */
  openEdges?: readonly number[];
  /**
   * Indices of edges that always hold, even when sliding: a house side or
   * bulkhead, or a rail over a lower deck rather than the sea.
   */
  wallEdges?: readonly number[];
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
}

export interface WalkMap {
  ship: ShipId;
  areas: readonly WalkArea[];
  blockers: readonly Blocker[];
  stairs: readonly Stair[];
  spawn: { area: string; at: V2; yaw: number };
}

// --- Tuning (see README.md) -------------------------------------------------

/** Below this slope (degrees) the deck feels flat. */
export const WALK_PUSH_FROM_DEG = 10;
/** At and above this slope you slide and cannot climb. */
export const WALK_SLIDE_FROM_DEG = 20;
/** Eye height over the feet (m). */
export const WALK_EYE_M = 1.6;
/** Water this deep over the feet (waist) puts you in the sea (m). */
export const WALK_IN_WATER_DEPTH_M = 1.0;
/** Knee depth (m): half speed; a railing this deep under no longer holds. */
export const WALK_KNEE_DEPTH_M = 0.5;
/** Walking speed on a level, dry deck (m/s). */
export const WALK_SPEED_MS = 1.4;
/** Turn per pixel of look drag (rad). */
export const WALK_TURN_PER_PX = 0.005;
/** Friction under the push between the two thresholds (μ). */
export const WALK_FRICTION_MU = 0.35;
/** The walker's body radius for blockers and railings (m). */
export const WALK_RADIUS_M = 0.3;
/** Gravity (m/s²). */
export const WALK_G = 9.81;

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

/** Whether a body of radius `r` at p overlaps any blocker in that area. */
export function insideBlocker(
  map: WalkMap,
  areaId: string,
  p: V2,
  r: number
): boolean {
  for (const b of map.blockers) {
    if (b.area !== areaId) continue;
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

/** The floor's height (ship-frame z) of an area at x. */
export function floorZ(
  map: WalkMap,
  areaId: string,
  x: number,
  spec: ShipSpec
): number {
  const a = areaById(map, areaId);
  if (!a) throw new Error(`walk map ${map.ship} has no area ${areaId}`);
  return deckZAt(a.deck, x, spec) + (a.raiseM ?? 0);
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
