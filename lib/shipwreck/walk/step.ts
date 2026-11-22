import type { ShipSpec } from "../ships/types";
import type { BodyPose } from "../sim/track";
import { deckSlope, shipToEarth, type V3 } from "./slope";
import {
  areaById,
  floorZ,
  WALK_FRICTION_MU,
  WALK_G,
  WALK_IN_WATER_DEPTH_M,
  WALK_KNEE_DEPTH_M,
  WALK_PUSH_FROM_DEG,
  WALK_RADIUS_M,
  WALK_SLIDE_FROM_DEG,
  WALK_SPEED_MS,
  WALK_TURN_PER_PX,
  pointInPolygon,
  type V2,
  type WalkArea,
  type WalkMap,
} from "./types";

/**
 * One walker on one piece of her (see README.md). Everything is in the
 * ship frame of that piece; the pose only says which way is down and where
 * the sea is. Nothing here writes to the sim.
 */

export interface WalkerState {
  part: "whole" | "bow" | "stern";
  area: string;
  /** Feet in the ship frame (m); the height is the area's floor. */
  x: number;
  y: number;
  /** The slip velocity: what the slope and water add to walking (m/s). */
  vx: number;
  vy: number;
  /** Heading in the ship frame (rad; 0 faces the bow, + turns to port). */
  yaw: number;
  sliding: boolean;
}

/** Stick −1..1 (forward, strafe right), look in px since last read. */
export interface WalkInput {
  forward: number;
  strafe: number;
  lookDx: number;
  lookDy: number;
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
}

export type StepResult = {
  state: WalkerState;
  /**
   * null while on deck; otherwise how they went in: "deep" (waist-deep
   * water), "railing" (slid over the downhill rail), "open-end" (off the
   * break, a ladder mouth, or a rail the sea is over).
   */
  inWater: null | "deep" | "railing" | "open-end";
  /** Sea over the feet (m; negative when dry). */
  depthM: number;
  slopeDeg: number;
};

/** The fastest a slide goes (m/s): a long steep deck never runs away. */
export const WALK_MAX_SLIP_MS = 10;
/** The fixed substep (s). */
export const WALK_DT = 1 / 60;
/** The longest frame stepped (s): a stalled tab does not teleport. */
const MAX_DT = 0.25;
const EPS = 1e-4;

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

/** Sea over the walker's feet at (x, y) on an area (m). */
function depthAt(ctx: StepContext, areaId: string, x: number, y: number) {
  shipToEarth(ctx.pose, [x, y, floorZ(ctx.map, areaId, x, ctx.spec)], feet);
  return ctx.seaZ(feet[0], feet[1]) - feet[2];
}

/** The decision that ends a walk (the "go down with the ship" switch). */
export function inWaterFromDepth(depthM: number): "deep" | null {
  return depthM >= WALK_IN_WATER_DEPTH_M - 1e-9 ? "deep" : null;
}

type EdgeKind = "rail" | "wall" | "open";

function edgeKind(a: WalkArea, i: number): EdgeKind {
  if (a.openEdges?.includes(i)) return "open";
  if (a.wallEdges?.includes(i)) return "wall";
  return "rail";
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
  vx: number;
  vy: number;
  area: string;
  inWater: StepResult["inWater"];
}

/** Whether a rail edge lets the walker through (sliding downhill, or awash). */
function railGives(
  ctx: StepContext,
  area: WalkArea,
  i: number,
  at: V2,
  sliding: boolean,
  downhill: V2
): "railing" | "open-end" | null {
  const kind = edgeKind(area, i);
  if (kind === "open") return "open-end";
  if (kind === "wall") return null;
  const a = area.outline[i];
  const b = area.outline[(i + 1) % area.outline.length];
  const n = outward(a, b);
  if (sliding && n[0] * downhill[0] + n[1] * downhill[1] > 0) return "railing";
  if (depthAt(ctx, area.id, at[0], at[1]) >= WALK_KNEE_DEPTH_M)
    return "open-end";
  return null;
}

/** Moves p0 by (mx, my) inside the area's outline, railings and all. */
function moveInOutline(
  ctx: StepContext,
  area: WalkArea,
  s: Sub,
  mx: number,
  my: number,
  sliding: boolean,
  downhill: V2
): void {
  const poly = area.outline;
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
    const gives = railGives(ctx, area, best, hit, sliding, downhill);
    if (gives) {
      s.x = x1;
      s.y = y1;
      s.inWater = gives;
      return;
    }
    // Held: stop at the rail and keep only the motion along it.
    const qx = hit[0] - n[0] * EPS;
    const qy = hit[1] - n[1] * EPS;
    const remX = x1 - qx;
    const remY = y1 - qy;
    const out = remX * n[0] + remY * n[1];
    x0 = qx;
    y0 = qy;
    x1 = qx + remX - out * n[0];
    y1 = qy + remY - out * n[1];
    const vOut = s.vx * n[0] + s.vy * n[1];
    if (vOut > 0) {
      s.vx -= vOut * n[0];
      s.vy -= vOut * n[1];
    }
  }
  s.x = x1;
  s.y = y1;
}

/** Pushes the walker's body out of blockers and off holding rails. */
function resolveBody(
  ctx: StepContext,
  area: WalkArea,
  s: Sub,
  sliding: boolean,
  downhill: V2
): void {
  const R = WALK_RADIUS_M;
  for (let iter = 0; iter < 3; iter += 1) {
    let moved = false;
    for (const b of ctx.map.blockers) {
      if (b.area !== area.id) continue;
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
      const vIn = s.vx * nx + s.vy * ny;
      if (vIn < 0) {
        s.vx -= vIn * nx;
        s.vy -= vIn * ny;
      }
      moved = true;
    }
    // Keep the body off the rails and walls that hold.
    const poly = area.outline;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const { q, d } = nearestOnSegment([s.x, s.y], a, b);
      if (d >= R) continue;
      if (railGives(ctx, area, i, q, sliding, downhill)) continue;
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

/** Steps through a stair when the walker has just entered one end. */
function takeStairs(ctx: StepContext, s: Sub, px: number, py: number): void {
  for (const st of ctx.map.stairs) {
    for (const [end, other] of [
      [st.from, st.to],
      [st.to, st.from],
    ] as const) {
      if (end.area !== s.area) continue;
      const r = st.widthM / 2;
      const before = Math.hypot(px - end.at[0], py - end.at[1]);
      const now = Math.hypot(s.x - end.at[0], s.y - end.at[1]);
      if (before >= r && now < r) {
        s.area = other.area;
        s.x = other.at[0];
        s.y = other.at[1];
        s.vx = 0;
        s.vy = 0;
        return;
      }
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Walks the walker `dt` seconds: turns by the look drag once, then runs
 * ceil(dt / WALK_DT) substeps (dt clamped to 0.25 s), each applying the
 * stick in the ship frame, the slope's and the water's push, the blockers,
 * the railings and the break, and the stairs. Stops at the substep they go
 * into the sea.
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
  const { deg, downhill } = deckSlope(ctx.pose);
  const sinT = Math.sin((deg * Math.PI) / 180);
  const sliding = deg >= WALK_SLIDE_FROM_DEG;
  const sub: Sub = {
    x: s.x,
    y: s.y,
    vx: s.vx,
    vy: s.vy,
    area: s.area,
    inWater: null,
  };

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
  const baseX = WALK_SPEED_MS * (f * cy + r * sy);
  const baseY = WALK_SPEED_MS * (f * sy - r * cy);
  // Uphill is slower from 10°, impossible from 20°.
  const uphillShare =
    1 -
    clamp(
      (deg - WALK_PUSH_FROM_DEG) / (WALK_SLIDE_FROM_DEG - WALK_PUSH_FROM_DEG),
      0,
      1
    );

  let depth = depthAt(ctx, sub.area, sub.x, sub.y);
  for (let k = 0; k < n; k += 1) {
    const area = areaById(ctx.map, sub.area);
    if (!area) break;
    // Wading: half speed at knee depth, nothing at waist depth.
    const wade =
      depth > 0 ? clamp(1 - depth / (2 * WALK_KNEE_DEPTH_M), 0, 1) : 1;
    let wx = baseX * wade;
    let wy = baseY * wade;
    const along = wx * downhill[0] + wy * downhill[1];
    if (along < 0) {
      wx -= (1 - uphillShare) * along * downhill[0];
      wy -= (1 - uphillShare) * along * downhill[1];
    }
    // The push: past 10° the slope (ramping in to full at 20°), water on
    // the deck in proportion to its depth; friction holds it to a drift.
    // From 20° a slide, with nothing to hold it.
    let push = 0;
    if (sliding) {
      push = WALK_G * sinT;
    } else {
      push +=
        WALK_G *
        sinT *
        clamp(
          (deg - WALK_PUSH_FROM_DEG) /
            (WALK_SLIDE_FROM_DEG - WALK_PUSH_FROM_DEG),
          0,
          1
        );
      if (depth > 0)
        push += WALK_G * sinT * clamp(depth / WALK_IN_WATER_DEPTH_M, 0, 1);
    }
    // μ·g as a linear drag rate (1/s) on the slip, on purpose: it settles
    // the push to a steady drift. It is not Coulomb friction.
    const drag = sliding ? 0 : WALK_FRICTION_MU * WALK_G;
    sub.vx = (sub.vx + push * downhill[0] * h) / (1 + drag * h);
    sub.vy = (sub.vy + push * downhill[1] * h) / (1 + drag * h);
    if (sliding) {
      const v = Math.hypot(sub.vx, sub.vy);
      if (v > WALK_MAX_SLIP_MS) {
        sub.vx *= WALK_MAX_SLIP_MS / v;
        sub.vy *= WALK_MAX_SLIP_MS / v;
      }
    }

    const px = sub.x;
    const py = sub.y;
    moveInOutline(
      ctx,
      area,
      sub,
      (wx + sub.vx) * h,
      (wy + sub.vy) * h,
      sliding,
      downhill
    );
    if (!sub.inWater && ctx.breakX !== null && s.part !== "whole") {
      const off = s.part === "bow" ? sub.x < ctx.breakX : sub.x >= ctx.breakX;
      if (off) sub.inWater = "open-end";
    }
    if (sub.inWater) break;
    resolveBody(ctx, area, sub, sliding, downhill);
    // Never leave the outline except by going in.
    if (!pointInPolygon([sub.x, sub.y], area.outline)) {
      sub.x = px;
      sub.y = py;
      sub.vx = 0;
      sub.vy = 0;
    }
    takeStairs(ctx, sub, px, py);
    depth = depthAt(ctx, sub.area, sub.x, sub.y);
    if (inWaterFromDepth(depth)) {
      sub.inWater = "deep";
      break;
    }
  }
  if (!sub.inWater && inWaterFromDepth(depth)) sub.inWater = "deep";

  return {
    state: {
      part: s.part,
      area: sub.area,
      x: sub.x,
      y: sub.y,
      vx: sub.vx,
      vy: sub.vy,
      yaw,
      sliding,
    },
    inWater: sub.inWater,
    depthM: depth,
    slopeDeg: deg,
  };
}
