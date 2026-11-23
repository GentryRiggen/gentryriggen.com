import type { ShipSpec } from "../ships/types";
import {
  type AgroundState,
  type Body,
  type FloorFn,
  earthOf,
  floorNear,
  placeAbout,
  upOf,
  updateBounds,
} from "./body";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, cos, max, min, sin } = Math;

const DEG = Math.PI / 180;

/**
 * The rest aground (`ShipSpec.aground`): a rule, not physics, like `wreck`.
 * A floating body that touches the floor with its way lost, listed at
 * least `minListDeg` toward the side of `restDeg`, hands its roll to the
 * report's pace from wherever physics left it: never back, along `pace`
 * (points the physics is already past are skipped), to `restDeg`. Her
 * pitch, heading and water stay as they were. Each step she rolls on the
 * point of her hull that is lowest then (its earth x, y kept: no sway, no
 * slide) and is re-seated so her deepest point is as deep in the floor as
 * it was when the rule began (the Lusitania's `seated` rule).
 */

/** Does the rule take this body now (touching, way lost, listed enough)? */
export function agroundBegins(
  spec: ShipSpec,
  b: Body,
  wayLost: boolean
): boolean {
  const rule = spec.aground;
  if (!rule || !wayLost || !b.grounded || b.part !== "whole") return false;
  return b.roll * rule.restDeg > 0 && abs(b.roll) >= rule.minListDeg * DEG;
}

/** How deep (m) the body's deepest hull point is in the floor (≥ 0). */
function penetration(b: Body, floor: FloorFn): number {
  const [nx, ny, nz] = upOf(b);
  const p = b.floorPts;
  // earthOf's turn (rotateYaw), its factors taken once for every vertex.
  const c = cos(b.pitch);
  const s = sin(b.pitch);
  const cr = cos(b.roll);
  const sr = sin(b.roll);
  const ssr = s * sr;
  const scr = s * cr;
  const cy = cos(b.yaw);
  const sy = sin(b.yaw);
  let deepest = 0;
  for (let k = 0; k < p.length; k += 4) {
    const rx = c * p[k] + ssr * p[k + 1] + scr * p[k + 2];
    const ry = cr * p[k + 1] - sr * p[k + 2];
    const z = b.z + nx * p[k] + ny * p[k + 1] + nz * p[k + 2];
    const f = floorNear(
      b,
      floor,
      k / 4,
      b.x + (cy * rx - sy * ry),
      b.y + (sy * rx + cy * ry),
      z
    );
    deepest = max(deepest, f - z);
  }
  return deepest;
}

/** Start the rule: its pace from her roll now (real second `realT`). */
export function beginAground(
  spec: ShipSpec,
  b: Body,
  realT: number,
  floor: FloorFn
): AgroundState {
  const rule = spec.aground as NonNullable<ShipSpec["aground"]>;
  const rest = rule.restDeg * DEG;
  const from = abs(b.roll);
  const pace: [number, number][] = [[realT, from]];
  for (const [t, deg] of rule.pace) {
    const r = min(abs(rest), abs(deg) * DEG);
    if (t > realT && r > pace[pace.length - 1][1]) pace.push([t, r]);
  }
  b.vx = 0;
  b.vz = 0;
  b.wp = 0;
  b.wr = 0;
  return {
    pace,
    rest,
    seat: penetration(b, floor),
    done: from >= abs(rest),
  };
}

function paceAt(p: readonly [number, number][], t: number): number {
  if (t <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i += 1) {
    if (t > p[i][0]) continue;
    const [ta, ra] = p[i - 1];
    const [tb, rb] = p[i];
    return tb > ta ? ra + ((rb - ra) * (t - ta)) / (tb - ta) : rb;
  }
  return p[p.length - 1][1];
}

/** The ship-frame hull vertex lowest in the earth now. */
function lowestVertex(b: Body): [number, number, number] {
  const [nx, ny, nz] = upOf(b);
  const p = b.floorPts;
  let best = Infinity;
  let k0 = 0;
  for (let k = 0; k < p.length; k += 4) {
    const z = nx * p[k] + ny * p[k + 1] + nz * p[k + 2];
    if (z < best) {
      best = z;
      k0 = k;
    }
  }
  return [p[k0], p[k0 + 1], p[k0 + 2]];
}

/**
 * One step of the rule to real second `realT` (the end of the step). True
 * once she lies at her rest.
 */
export function stepAground(b: Body, realT: number, floor: FloorFn): boolean {
  const a = b.aground as AgroundState;
  const side = a.rest >= 0 ? 1 : -1;
  const target = min(abs(a.rest), max(abs(b.roll), paceAt(a.pace, realT)));
  // Roll on the point that bears now, held where it is.
  const p = lowestVertex(b);
  const e = earthOf(b, p[0], p[1], p[2]);
  b.roll = side * target;
  placeAbout(b, p, e);
  // Re-seat: her deepest point as deep in the floor as when it began.
  b.z += penetration(b, floor) - a.seat;
  updateBounds(b);
  b.vx = 0;
  b.vz = 0;
  b.wp = 0;
  b.wr = 0;
  b.grounded = true;
  // At her rest, or at the end of her pace (a pace that stops short of
  // `restDeg` rests where it ends: the run never grinds on to endT).
  a.done = target >= abs(a.rest) || realT >= a.pace[a.pace.length - 1][0];
  return a.done;
}
