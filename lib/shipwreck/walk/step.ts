import type { ShipSpec } from "../ships/types";
import type { BodyPose } from "../sim/track";
import { deckSlope, shipToEarth, type V3 } from "./slope";
import {
  areaById,
  blockersIn,
  floorZ,
  JUMP_S,
  seamEdges,
  WALK_IN_WATER_DEPTH_M,
  WALK_INSIDE_SPEED_MS,
  WALK_LIFT_MAX_DEPTH_M,
  WALK_RADIUS_M,
  WALK_SPEED_MS,
  WALK_TURN_PER_PX,
  pointInPolygon,
  type Stair,
  type V2,
  type WalkArea,
  type WalkMap,
} from "./types";

/**
 * One walker on one piece of her (see README.md). Everything is in the
 * ship frame of that piece; the pose only says where the sea is. Nothing
 * here writes to the sim.
 *
 * Fun over realism (Gentry, 2026-11-22: "just walking is the whole idea"):
 * however steep she gets, the deck never pushes you, every railing and the
 * break hold, and you go in only when the sea is waist deep over your feet.
 */

export interface WalkerState {
  part: "whole" | "bow" | "stern";
  area: string;
  /** Feet in the ship frame (m); the height is the area's floor. */
  x: number;
  y: number;
  /** Heading in the ship frame (rad; 0 faces the bow, + turns to port). */
  yaw: number;
  /** Seconds into a jump (null or missing: feet on the floor). */
  jumpS?: number | null;
  /** Where that jump took off (ship frame x, y): the run-up is from here. */
  jumpFrom?: V2 | null;
}

/** Stick −1..1 (forward, strafe right), look in px since last read. */
export interface WalkInput {
  forward: number;
  strafe: number;
  lookDx: number;
  lookDy: number;
  /** Jump (pressed since the runner last read it; it zeroes it). */
  jump?: boolean;
}

export interface StepContext {
  map: WalkMap;
  spec: ShipSpec;
  /** The pose of the walker's piece. */
  pose: BodyPose;
  /** Where she broke (ship x), or null while whole. */
  breakX: number | null;
  /** Earth z of the sea surface at an earth (x, y). */
  seaZ(x: number, y: number): number;
  /**
   * Earth z of the water over a ship-frame point of an area (a room's own
   * level inside). Missing: the sea (`seaZ`) at the feet, as on deck.
   */
  waterZ?(areaId: string, x: number, y: number): number;
  /** Whether deck doors lead inside (false after the break); default true. */
  interiorsOpen?: boolean;
}

export type StepResult = {
  state: WalkerState;
  /** null while on deck; "deep" once the sea is waist deep over the feet. */
  inWater: null | "deep";
  /** Sea over the feet (m; negative when dry). */
  depthM: number;
  slopeDeg: number;
  /**
   * A running jump took them over a sea railing (with `inWater` "deep"):
   * the scene shows the fall to the sea.
   */
  overboard?: boolean;
  /** A door, lift or stair taken during this step (the last one). */
  via?: { kind: "door" | "lift" | "stair"; id: string };
};

/** The fixed substep (s). */
export const WALK_DT = 1 / 60;
/** The longest frame stepped (s): a stalled tab does not teleport. */
const MAX_DT = 0.25;
const EPS = 1e-4;
/** Speed share left wading at the waist (the rest fades in with depth). */
const WALK_WADE_MIN = 0.6;
/** How near the rail past the body's radius counts as "at" it (m). */
const RAIL_REACH_M = 0.08;
/** How squarely (cosine, about 30°) the run must face the rail to go over it. */
const RUN_AT_RAIL = 0.85;
/**
 * The run-up: a jump that took off nearer a rail than this past the body
 * (pressed against it already) never goes over that rail (m).
 */
const RUN_UP_M = 0.6;

/** The piece a walker at x is on: x >= breakX is the bow. */
export function partFor(
  x: number,
  breakX: number | null,
  broken: boolean
): "whole" | "bow" | "stern" {
  if (!broken || breakX === null) return "whole";
  return x >= breakX ? "bow" : "stern";
}

const feet: V3 = [0, 0, 0];

/** Water over the walker's feet at (x, y) on an area (m). */
function depthAt(ctx: StepContext, areaId: string, x: number, y: number) {
  shipToEarth(ctx.pose, [x, y, floorZ(ctx.map, areaId, x, ctx.spec, y)], feet);
  const water = ctx.waterZ
    ? ctx.waterZ(areaId, x, y)
    : ctx.seaZ(feet[0], feet[1]);
  return water - feet[2];
}

/** The decision that ends a walk (the "go down with the ship" switch). */
export function inWaterFromDepth(depthM: number): "deep" | null {
  return depthM >= WALK_IN_WATER_DEPTH_M - 1e-9 ? "deep" : null;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** Outward unit normal of a counter-clockwise outline's edge a→b. */
function outward(a: V2, b: V2): V2 {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dy / len, -dx / len];
}

/** Closest point on segment a→b to p, and the distance. */
function nearestOnSegment(p: V2, a: V2, b: V2): { q: V2; d: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const u =
    len2 > 0
      ? Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)
        )
      : 0;
  const q: V2 = [a[0] + u * dx, a[1] + u * dy];
  return { q, d: Math.hypot(p[0] - q[0], p[1] - q[1]) };
}

interface Sub {
  x: number;
  y: number;
  area: string;
}

/**
 * Moves the walker by (mx, my) inside their area's outline, sliding along
 * it. A seam edge is open: the move crosses into the area beyond (s.area
 * changes) and carries on inside that outline. Four passes in all.
 */
function moveInOutline(
  map: WalkMap,
  area: WalkArea,
  s: Sub,
  mx: number,
  my: number
): void {
  let poly = area.outline;
  let seams = seamEdges(map, s.area);
  let x0 = s.x;
  let y0 = s.y;
  let x1 = x0 + mx;
  let y1 = y0 + my;
  for (let pass = 0; pass < 4; pass += 1) {
    const rx = x1 - x0;
    const ry = y1 - y0;
    let bestT = Infinity;
    let best = -1;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const n = outward(a, b);
      if (rx * n[0] + ry * n[1] <= 0) continue;
      const sx = b[0] - a[0];
      const sy = b[1] - a[1];
      const den = cross(rx, ry, sx, sy);
      if (Math.abs(den) < 1e-12) continue;
      const t = cross(a[0] - x0, a[1] - y0, sx, sy) / den;
      const u = cross(a[0] - x0, a[1] - y0, rx, ry) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      if (t < bestT) {
        bestT = t;
        best = i;
      }
    }
    if (best < 0) break;
    const a = poly[best];
    const b = poly[(best + 1) % poly.length];
    const n = outward(a, b);
    const hit: V2 = [x0 + rx * bestT, y0 + ry * bestT];
    const across = seams ? seams[best] : null;
    const next = across !== null ? areaById(map, across) : undefined;
    if (next) {
      // Through the doorway: just past the edge, same motion, new outline.
      s.area = next.id;
      poly = next.outline;
      seams = seamEdges(map, next.id);
      x0 = hit[0] + n[0] * EPS;
      y0 = hit[1] + n[1] * EPS;
      continue;
    }
    // Stop at the edge and keep only the motion along it.
    const qx = hit[0] - n[0] * EPS;
    const qy = hit[1] - n[1] * EPS;
    const remX = x1 - qx;
    const remY = y1 - qy;
    const out = remX * n[0] + remY * n[1];
    x0 = qx;
    y0 = qy;
    x1 = qx + remX - out * n[0];
    y1 = qy + remY - out * n[1];
  }
  s.x = x1;
  s.y = y1;
}

/** Pushes the walker's body out of blockers and off the edges. */
function resolveBody(ctx: StepContext, area: WalkArea, s: Sub): void {
  const R = WALK_RADIUS_M;
  const blockers = blockersIn(ctx.map, area.id);
  const seams = seamEdges(ctx.map, area.id);
  for (let iter = 0; iter < 3; iter += 1) {
    let moved = false;
    for (const b of blockers) {
      let nx = 0;
      let ny = 0;
      let push = 0;
      if (b.kind === "circle") {
        const dx = s.x - b.at[0];
        const dy = s.y - b.at[1];
        const d = Math.hypot(dx, dy);
        if (d >= b.r + R) continue;
        if (d < 1e-9) {
          nx = 1;
        } else {
          nx = dx / d;
          ny = dy / d;
        }
        push = b.r + R - d;
      } else {
        const inside =
          s.x > b.min[0] && s.x < b.max[0] && s.y > b.min[1] && s.y < b.max[1];
        if (inside) {
          // Out through the nearest face.
          const faces = [
            { d: s.x - b.min[0], n: [-1, 0] },
            { d: b.max[0] - s.x, n: [1, 0] },
            { d: s.y - b.min[1], n: [0, -1] },
            { d: b.max[1] - s.y, n: [0, 1] },
          ].sort((p, q) => p.d - q.d)[0];
          nx = faces.n[0];
          ny = faces.n[1];
          push = faces.d + R;
        } else {
          const cx = Math.max(b.min[0], Math.min(b.max[0], s.x));
          const cy = Math.max(b.min[1], Math.min(b.max[1], s.y));
          const dx = s.x - cx;
          const dy = s.y - cy;
          const d = Math.hypot(dx, dy);
          if (d >= R) continue;
          nx = dx / d;
          ny = dy / d;
          push = R - d;
        }
      }
      s.x += nx * push;
      s.y += ny * push;
      moved = true;
    }
    // Keep the body off the railings and walls (a seam is no wall).
    const poly = area.outline;
    for (let i = 0; i < poly.length; i += 1) {
      if (seams && seams[i] !== null) continue;
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const { q, d } = nearestOnSegment([s.x, s.y], a, b);
      if (d >= R) continue;
      const n = outward(a, b);
      // Along the inward normal, so a corner never shoves it outside.
      const toward = (s.x - q[0]) * -n[0] + (s.y - q[1]) * -n[1];
      const push = R - Math.max(0, toward);
      if (push <= 0) continue;
      s.x -= n[0] * push;
      s.y -= n[1] * push;
      moved = true;
    }
    if (!moved) break;
  }
}

/**
 * In the air and running at a railing over the sea (not a wall: a house
 * side or a rail over a lower deck): over it they go. The body stops
 * WALK_RADIUS_M short of the rail, so "at" it means within a few cm more.
 */
function overSeaRail(
  area: WalkArea,
  s: Sub,
  mx: number,
  my: number,
  from: V2
): boolean {
  const poly = area.outline;
  const speed = Math.hypot(mx, my);
  if (speed < 1e-9) return false;
  for (let i = 0; i < poly.length; i += 1) {
    if (area.wallEdges?.includes(i)) continue;
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const { d } = nearestOnSegment([s.x, s.y], a, b);
    if (d > WALK_RADIUS_M + RAIL_REACH_M) continue;
    // A running jump: it took off well back from this rail.
    if (nearestOnSegment(from, a, b).d < WALK_RADIUS_M + RUN_UP_M) continue;
    const n = outward(a, b);
    // Running at it, not along it.
    if ((mx * n[0] + my * n[1]) / speed > RUN_AT_RAIL) return true;
  }
  return false;
}

/**
 * Steps through a stair, door or lift when the walker has just entered one
 * end, and returns it (null when none was taken). A door is shut while
 * interiors are closed; a lift stays put while its arrival is flooded
 * deeper than WALK_LIFT_MAX_DEPTH_M.
 */
function takeStairs(
  ctx: StepContext,
  s: Sub,
  px: number,
  py: number
): Stair | null {
  for (const st of ctx.map.stairs) {
    if (st.kind === "door" && ctx.interiorsOpen === false) continue;
    for (const [end, other] of [
      [st.from, st.to],
      [st.to, st.from],
    ] as const) {
      if (end.area !== s.area) continue;
      const r = st.widthM / 2;
      const before = Math.hypot(px - end.at[0], py - end.at[1]);
      const now = Math.hypot(s.x - end.at[0], s.y - end.at[1]);
      if (before >= r && now < r) {
        if (
          st.kind === "lift" &&
          depthAt(ctx, other.area, other.at[0], other.at[1]) >
            WALK_LIFT_MAX_DEPTH_M
        )
          return null;
        s.area = other.area;
        s.x = other.at[0];
        s.y = other.at[1];
        return st;
      }
    }
  }
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Walks the walker `dt` seconds: turns by the look drag once, then runs
 * ceil(dt / WALK_DT) substeps (dt clamped to 0.25 s), each applying the
 * stick in the ship frame (slowed by wading), the blockers, the railings,
 * the break and the stairs. Stops at the substep the sea reaches their
 * waist.
 */
export function stepWalker(
  s: WalkerState,
  input: WalkInput,
  ctx: StepContext,
  dt: number
): StepResult {
  const total = clamp(Number.isFinite(dt) ? dt : 0, 0, MAX_DT);
  const n = total > 0 ? Math.ceil(total / WALK_DT - 1e-9) : 0;
  const h = n > 0 ? total / n : 0;
  const yaw = s.yaw - input.lookDx * WALK_TURN_PER_PX;
  const sub: Sub = { x: s.x, y: s.y, area: s.area };

  // The stick, in the ship frame.
  let f = clamp(input.forward || 0, -1, 1);
  let r = clamp(input.strafe || 0, -1, 1);
  const mag = Math.hypot(f, r);
  if (mag > 1) {
    f /= mag;
    r /= mag;
  }
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  // Unit stick direction; the speed is the area's (inside or on deck).
  const dirX = f * cy + r * sy;
  const dirY = f * sy - r * cy;

  let inWater: StepResult["inWater"] = null;
  let overboard = false;
  let via: StepResult["via"];
  // A jump starts on the floor only, and never inside.
  let jumpS = s.jumpS ?? null;
  let jumpFrom = s.jumpFrom ?? null;
  if (
    input.jump &&
    jumpS === null &&
    n > 0 &&
    !areaById(ctx.map, s.area)?.interior
  ) {
    jumpS = 0;
    jumpFrom = [s.x, s.y];
  }
  let depth = depthAt(ctx, sub.area, sub.x, sub.y);
  for (let k = 0; k < n; k += 1) {
    const area = areaById(ctx.map, sub.area);
    if (!area) break;
    const speed = area.interior ? WALK_INSIDE_SPEED_MS : WALK_SPEED_MS;
    const baseX = speed * dirX;
    const baseY = speed * dirY;
    if (jumpS !== null) {
      if (
        !area.interior &&
        overSeaRail(area, sub, baseX, baseY, jumpFrom ?? [sub.x, sub.y])
      ) {
        overboard = true;
        inWater = "deep";
        break;
      }
      jumpS += h;
      if (jumpS >= JUMP_S) {
        jumpS = null;
        jumpFrom = null;
      }
    }
    // Wading: slower in water, down to WALK_WADE_MIN at the waist.
    const wade =
      depth > 0
        ? 1 - (1 - WALK_WADE_MIN) * clamp(depth / WALK_IN_WATER_DEPTH_M, 0, 1)
        : 1;
    const px = sub.x;
    const py = sub.y;
    moveInOutline(ctx.map, area, sub, baseX * wade * h, baseY * wade * h);
    // A seam may have carried them into the next room.
    const now = sub.area === area.id ? area : areaById(ctx.map, sub.area);
    if (now) resolveBody(ctx, now, sub);
    // Never leave the outline, nor step off the break onto the other piece.
    const offBreak =
      ctx.breakX !== null &&
      s.part !== "whole" &&
      (s.part === "bow" ? sub.x < ctx.breakX : sub.x >= ctx.breakX);
    if (offBreak || !now || !pointInPolygon([sub.x, sub.y], now.outline)) {
      sub.x = px;
      sub.y = py;
      sub.area = area.id;
    }
    const taken = takeStairs(ctx, sub, px, py);
    if (taken) via = { kind: taken.kind ?? "stair", id: taken.id };
    depth = depthAt(ctx, sub.area, sub.x, sub.y);
    inWater = inWaterFromDepth(depth);
    if (inWater) break;
  }
  if (!inWater) inWater = inWaterFromDepth(depth);

  return {
    state: {
      part: s.part,
      area: sub.area,
      x: sub.x,
      y: sub.y,
      yaw,
      jumpS,
      jumpFrom,
    },
    inWater,
    ...(overboard ? { overboard } : {}),
    ...(via ? { via } : {}),
    depthM: depth,
    slopeDeg: deckSlope(ctx.pose).deg,
  };
}
