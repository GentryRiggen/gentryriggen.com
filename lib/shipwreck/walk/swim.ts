import type { ShipSpec } from "../ships/types";
import type { BodyPose, SimFrame } from "../sim/track";
import { deckSlope, earthToShip, shipToEarth, type V3 } from "./slope";
import { partFor, type WalkerState, type WalkInput } from "./step";
import {
  floorZ,
  WALK_SLIDE_FROM_DEG,
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

/** Paddling speed (m/s). */
export const SWIM_SPEED_MS = 0.5;
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

/**
 * How far an earth point on the sea is outside one piece's footprint, in
 * its ship frame's y (m; negative inside); Infinity where none of her is
 * at the surface (beyond her ends, or the piece held clear above or sunk
 * below the sea there).
 */
function pieceClearance(x: number, y: number, h: HullPiece): number {
  const s = earthToShip(h.pose, [x, y, 0], tmp);
  const st = h.spec.stations;
  const lo = Math.max(st[0].x, h.fromX ?? -Infinity);
  const hi = Math.min(st[st.length - 1].x, h.toX ?? Infinity);
  if (s[0] < lo || s[0] > hi) return Infinity;
  if (s[2] < 0 || s[2] > h.spec.sheerZ(s[0])) return Infinity;
  return Math.abs(s[1]) - footprintHalfBreadth(h.spec, s[0]);
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
      const py =
        side * (footprintHalfBreadth(piece.spec, p[0]) + HULL_MARGIN_M);
      [x, y] = onSea(piece.pose, p[0], py, p[2]);
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y, yaw };
}

/**
 * Where a walker who has just gone in floats: off the side they were
 * nearer (starboard on the centreline), level with where they went in,
 * 3 m clear of her footprint, facing the way they faced.
 */
export function swimmerFrom(
  w: WalkerState,
  pose: BodyPose,
  spec: ShipSpec,
  map: WalkMap
): SwimmerState {
  const side = w.y > 0 ? 1 : -1;
  const py = side * (footprintHalfBreadth(spec, w.x) + CLEAR_M);
  const [x, y] = onSea(pose, w.x, py, floorZ(map, w.area, w.x, spec));
  return { x, y, yaw: pose.yaw + w.yaw };
}

/**
 * Spawn on the boat deck for this frame, on the piece the spawn point is
 * on, or null when that piece is gone or the deck at the spawn is under
 * water (the sea at z = 0 over the feet).
 */
export function placeWalker(
  map: WalkMap,
  spec: ShipSpec,
  frame: SimFrame,
  breakX: number | null
): WalkerState | null {
  const broken = frame.bodies.some((b) => b.part !== "whole");
  const [x, y] = map.spawn.at;
  const part = partFor(x, breakX, broken);
  const pose = frame.bodies.find((b) => b.part === part);
  if (!pose) return null;
  const feet = shipToEarth(pose, [x, y, floorZ(map, map.spawn.area, x, spec)]);
  if (feet[2] <= 0) return null;
  return {
    part,
    area: map.spawn.area,
    x,
    y,
    vx: 0,
    vy: 0,
    yaw: map.spawn.yaw,
    sliding: deckSlope(pose).deg >= WALK_SLIDE_FROM_DEG,
  };
}

/** Whether Back on deck can put them on her now (placeWalker !== null). */
export const canReboard = (
  map: WalkMap,
  spec: ShipSpec,
  frame: SimFrame,
  breakX: number | null
): boolean => placeWalker(map, spec, frame, breakX) !== null;
