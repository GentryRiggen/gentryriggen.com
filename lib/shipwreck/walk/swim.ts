import type { ShipSpec } from "../ships/types";
import type { BodyPose, SimFrame } from "../sim/track";
import { earthToShip, shipToEarth, type V3 } from "./slope";
import { partFor, type WalkerState, type WalkInput } from "./step";
import {
  floorZ,
  WALK_KNEE_DEPTH_M,
  WALK_TURN_PER_PX,
  type WalkMap,
} from "./types";

/**
 * In the water: a swimmer floats at the surface in the earth frame (the
 * sim's x, y; z is the sea), paddles slowly and cannot swim into her. No
 * climbing back on; the Back on deck button respawns with placeWalker.
 */

export interface SwimmerState {
  /** Earth position (m) at the surface. */
  x: number;
  y: number;
  /** Heading in the earth frame (rad; + turns to port as the walker's). */
  yaw: number;
}

/** Paddling speed (m/s): quick, so a kid can keep up with her (was 0.5). */
export const SWIM_SPEED_MS = 2;
/** How far a swimmer is kept off her side (m). */
const HULL_MARGIN_M = 0.3;
/** Where a swimmer lands, clear of her side (m). */
const CLEAR_M = 3;
const MAX_DT = 0.25;

/** One piece of her the swimmer must keep out of. */
export interface HullPiece {
  pose: BodyPose;
  spec: ShipSpec;
  /** Her extent in ship x for a broken piece (default: the whole hull). */
  fromX?: number;
  toX?: number;
  /**
   * Her superstructure's boxes (`spec.superstructure`), kept clear of too
   * (a map with `swimAroundSuperstructure`: lying over, they are in the
   * sea). Each from its `baseZ` (else her deck edge) to its `topZ`, its
   * `halfBreadthM` (else her footprint) either side. Missing: the hull
   * alone, as every other ship.
   */
  superstructure?: readonly {
    fromX: number;
    toX: number;
    topZ: number;
    halfBreadthM?: number;
    baseZ?: number;
  }[];
}

/**
 * Her widest half-breadth at x at any height (the plan's footprint), by
 * straight lines between the stations; 0 beyond her ends.
 */
function footprintHalfBreadth(spec: ShipSpec, x: number): number {
  const st = spec.stations;
  if (x <= st[0].x || x >= st[st.length - 1].x) return 0;
  let i = 0;
  while (i < st.length - 2 && st[i + 1].x <= x) i += 1;
  const wide = (k: number) =>
    st[k].offsets.reduce((m, [, hb]) => Math.max(m, hb), 0);
  const u = (x - st[i].x) / (st[i + 1].x - st[i].x);
  return wide(i) + (wide(i + 1) - wide(i)) * u;
}

const tmp: V3 = [0, 0, 0];
/** No superstructure boxes (shared, so the check never allocates). */
const NO_BOXES: NonNullable<HullPiece["superstructure"]> = [];

/**
 * Her half-breadth at a ship-frame point (x, z) of one piece: her hull's
 * footprint below her deck edge, else the widest superstructure box there
 * (when the piece has them); -1 where none of her is at that x and height
 * (beyond her ends, below her keel, above her).
 */
function pieceHalfBreadth(h: HullPiece, x: number, z: number): number {
  const st = h.spec.stations;
  const lo = Math.max(st[0].x, h.fromX ?? -Infinity);
  const hi = Math.min(st[st.length - 1].x, h.toX ?? Infinity);
  if (x < lo || x > hi || z < 0) return -1;
  const sheer = h.spec.sheerZ(x);
  if (z <= sheer) return footprintHalfBreadth(h.spec, x);
  let best = -1;
  for (const b of h.superstructure ?? NO_BOXES) {
    if (x < b.fromX || x > b.toX || z < (b.baseZ ?? sheer) || z > b.topZ)
      continue;
    best = Math.max(best, b.halfBreadthM ?? footprintHalfBreadth(h.spec, x));
  }
  return best;
}

/**
 * How far an earth point on the sea is outside one piece's footprint, in
 * its ship frame's y (m; negative inside); Infinity where none of her is
 * at the surface (beyond her ends, or the piece held clear above or sunk
 * below the sea there). With `superstructure`, its boxes count too.
 */
function pieceClearance(x: number, y: number, h: HullPiece): number {
  const s = earthToShip(h.pose, [x, y, 0], tmp);
  const hb = pieceHalfBreadth(h, s[0], s[2]);
  if (hb < 0) return Infinity;
  return Math.abs(s[1]) - hb;
}

/** The least clearance from any piece (m; negative inside one). */
export function hullClearanceM(
  x: number,
  y: number,
  hull: readonly HullPiece[]
): number {
  let best = Infinity;
  for (const h of hull) best = Math.min(best, pieceClearance(x, y, h));
  return best;
}

/**
 * The ship-frame height where (x, y) of the ship frame meets the sea under
 * the pose, or null when her deck is nearly on its side there.
 */
function seaZInShip(pose: BodyPose, x: number, y: number): number | null {
  const cp = Math.cos(pose.pitch);
  const cr = Math.cos(pose.roll);
  if (Math.abs(cp * cr) < 0.05) return null;
  const sp = Math.sin(pose.pitch);
  const sr = Math.sin(pose.roll);
  return ((sp * x - pose.z) / cp - sr * y) / cr;
}

/** The earth (x, y) on the sea at ship-frame (x, y) of a piece. */
function onSea(pose: BodyPose, x: number, y: number, zFallback: number) {
  const z = seaZInShip(pose, x, y) ?? zFallback;
  const e = shipToEarth(pose, [x, y, z], tmp);
  return [e[0], e[1]] as const;
}

/** Paddles `dt` seconds, then is pushed back out of her footprint. */
export function stepSwimmer(
  s: SwimmerState,
  input: WalkInput,
  dt: number,
  hull: readonly HullPiece[]
): SwimmerState {
  const h = Math.max(0, Math.min(MAX_DT, Number.isFinite(dt) ? dt : 0));
  const yaw = s.yaw - input.lookDx * WALK_TURN_PER_PX;
  let f = Math.max(-1, Math.min(1, input.forward || 0));
  let r = Math.max(-1, Math.min(1, input.strafe || 0));
  const mag = Math.hypot(f, r);
  if (mag > 1) {
    f /= mag;
    r /= mag;
  }
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  let x = s.x + SWIM_SPEED_MS * (f * c + r * sn) * h;
  let y = s.y + SWIM_SPEED_MS * (f * sn - r * c) * h;
  for (let pass = 0; pass < 3; pass += 1) {
    let moved = false;
    for (const piece of hull) {
      if (pieceClearance(x, y, piece) >= HULL_MARGIN_M) continue;
      const p = earthToShip(piece.pose, [x, y, 0], tmp);
      const side = p[1] >= 0 ? 1 : -1;
      const py = side * (pieceHalfBreadth(piece, p[0], p[2]) + HULL_MARGIN_M);
      [x, y] = onSea(piece.pose, p[0], py, p[2]);
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y, yaw };
}

/**
 * Where a walker who has just gone in floats: off the side they were
 * nearer (starboard on the centreline), or `side` when given (+1 port,
 * −1 starboard: her low side when walking her ends), level with where
 * they went in, 3 m clear of her footprint, facing the way they faced
 * (with `side`, facing out to sea, away from her).
 */
export function swimmerFrom(
  w: WalkerState,
  pose: BodyPose,
  spec: ShipSpec,
  map: WalkMap,
  side?: 1 | -1
): SwimmerState {
  const s = side ?? (w.y > 0 ? 1 : -1);
  const py = s * (footprintHalfBreadth(spec, w.x) + CLEAR_M);
  const [x, y] = onSea(pose, w.x, py, floorZ(map, w.area, w.x, spec, w.y));
  // Slid off a given side: facing out to sea, away from her.
  const yaw =
    side !== undefined ? pose.yaw + (side * Math.PI) / 2 : pose.yaw + w.yaw;
  return { x, y, yaw };
}

/** The flat sea (earth z = 0), the default surface. */
const FLAT_SEA = () => 0;

/**
 * Spawn on the boat deck for this frame, on the piece the spawn point is
 * on, or null when that piece is gone or the deck at the spawn is not dry
 * by a knee's depth (the sea, `seaZ` as stepWalker's, within
 * WALK_KNEE_DEPTH_M of the feet): never placed straight into wading water.
 * Null too, on a map with `walkEndsAtHeelDeg`, once she lists that far
 * either way.
 */
export function placeWalker(
  map: WalkMap,
  spec: ShipSpec,
  frame: SimFrame,
  breakX: number | null,
  seaZ: (x: number, y: number) => number = FLAT_SEA
): WalkerState | null {
  if (
    map.walkEndsAtHeelDeg !== undefined &&
    Math.abs(frame.listDeg) >= map.walkEndsAtHeelDeg
  )
    return null;
  const broken = frame.bodies.some((b) => b.part !== "whole");
  const [x, y] = map.spawn.at;
  const part = partFor(x, breakX, broken);
  const pose = frame.bodies.find((b) => b.part === part);
  if (!pose) return null;
  const feet = shipToEarth(pose, [
    x,
    y,
    floorZ(map, map.spawn.area, x, spec, y),
  ]);
  if (seaZ(feet[0], feet[1]) - feet[2] >= -WALK_KNEE_DEPTH_M) return null;
  return {
    part,
    area: map.spawn.area,
    x,
    y,
    yaw: map.spawn.yaw,
  };
}

/** Whether Back on deck can put them on her now (placeWalker !== null). */
export const canReboard = (
  map: WalkMap,
  spec: ShipSpec,
  frame: SimFrame,
  breakX: number | null,
  seaZ: (x: number, y: number) => number = FLAT_SEA
): boolean => placeWalker(map, spec, frame, breakX, seaZ) !== null;
