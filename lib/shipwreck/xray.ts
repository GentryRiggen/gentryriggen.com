import type { Compartment, ShipSpec } from "./ships/types";
import { hullHalfBreadth, type HullModel } from "./sim/geometry";
import type { BodyPose } from "./sim/track";

/**
 * Geometry for the X-ray cutaway: where each compartment's water stands.
 * The sim gives each compartment's fill (0..1 of its capacity); the water
 * inside lies level with the earth, not the ship, so its free surface is
 * the earth height below which that share of the compartment's volume lies.
 * The volume is sampled (points weighted by the hull's breadth), so any
 * pitch and roll works, including a hull standing on end.
 */

/** Earth height of a ship-frame point under `pose` (Rz·Ry·Rx, as the sim). */
export function earthZ(
  pose: BodyPose,
  x: number,
  y: number,
  z: number
): number {
  const sp = Math.sin(pose.pitch);
  const cp = Math.cos(pose.pitch);
  const sr = Math.sin(pose.roll);
  const cr = Math.cos(pose.roll);
  return pose.z - sp * x + cp * (sr * y + cr * z);
}

/** Weighted sample points through a compartment's volume. */
export interface VolumeSamples {
  /** x, y, z per point (ship frame). */
  points: Float32Array;
  /** Volume each point stands for (m³). */
  weights: Float32Array;
  total: number;
  /** Scratch for the sort (earth heights). */
  heights: Float32Array;
  order: Uint16Array;
}

const NX = 8;
const NZ = 14;
const NY = 4;

/** The top of a compartment's watertight envelope at x (its bulkhead tops). */
export function compartmentTopZ(c: Compartment, x: number): number {
  const u = c.toX > c.fromX ? (x - c.fromX) / (c.toX - c.fromX) : 0;
  return c.aftBulkheadTopZ + (c.fwdBulkheadTopZ - c.aftBulkheadTopZ) * u;
}

/**
 * Samples a compartment's volume between `fromX` and `toX` (already clipped
 * to a part after the break), from the keel to its bulkhead tops.
 */
export function compartmentSamples(
  hull: HullModel,
  c: Compartment,
  fromX = c.fromX,
  toX = c.toX
): VolumeSamples {
  const n = NX * NZ * NY;
  const points = new Float32Array(n * 3);
  const weights = new Float32Array(n);
  let total = 0;
  let k = 0;
  const dx = (toX - fromX) / NX;
  for (let i = 0; i < NX; i += 1) {
    const x = fromX + dx * (i + 0.5);
    const top = compartmentTopZ(c, x);
    const dz = top / NZ;
    for (let j = 0; j < NZ; j += 1) {
      const z = dz * (j + 0.5);
      const hb = hullHalfBreadth(hull, x, z);
      const dy = (2 * hb) / NY;
      for (let m = 0; m < NY; m += 1) {
        points[k * 3] = x;
        points[k * 3 + 1] = -hb + dy * (m + 0.5);
        points[k * 3 + 2] = z;
        const w = Math.max(0, dx * dz * dy);
        weights[k] = w;
        total += w;
        k += 1;
      }
    }
  }
  const order = new Uint16Array(n);
  for (let i = 0; i < n; i += 1) order[i] = i;
  return { points, weights, total, heights: new Float32Array(n), order };
}

/**
 * The earth height of the water's free surface in a compartment holding
 * `fill` (0..1) of its volume, or -Infinity when dry and +Infinity when full.
 * Allocation-free (sorts the samples' scratch in place).
 */
export function waterLevel(
  s: VolumeSamples,
  pose: BodyPose,
  fill: number
): number {
  if (!(fill > 0.0005) || s.total <= 0) return -Infinity;
  if (fill >= 0.999) return Infinity;
  const n = s.weights.length;
  const p = s.points;
  for (let i = 0; i < n; i += 1)
    s.heights[i] = earthZ(pose, p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  // Insertion sort by height, starting from last frame's order (nearly sorted).
  const h = s.heights;
  const o = s.order;
  for (let i = 1; i < n; i += 1) {
    const v = o[i];
    const hv = h[v];
    let j = i - 1;
    while (j >= 0 && h[o[j]] > hv) {
      o[j + 1] = o[j];
      j -= 1;
    }
    o[j + 1] = v;
  }
  const want = fill * s.total;
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    const w = s.weights[o[i]];
    if (acc + w >= want) {
      // Each sample stands for the heights halfway to its neighbours.
      const here = h[o[i]];
      const lo = i > 0 ? (h[o[i - 1]] + here) / 2 : here;
      const hi = i + 1 < n ? (here + h[o[i + 1]]) / 2 : here;
      const u = w > 0 ? (want - acc) / w : 0;
      return lo + (hi - lo) * u;
    }
    acc += w;
  }
  return h[o[n - 1]];
}

/** Depth of water over a floor point (m), given the water's earth level. */
export function depthOver(
  pose: BodyPose,
  floor: readonly [number, number, number],
  level: number
): number {
  if (level === -Infinity) return 0;
  const fz = earthZ(pose, floor[0], floor[1], floor[2]);
  if (level === Infinity) return Infinity;
  return Math.max(0, level - fz);
}

/** The part (whole, bow or stern) that holds ship-frame x. */
export function partAt(
  breakX: number | null,
  broken: boolean,
  x: number
): "whole" | "bow" | "stern" {
  if (!broken || breakX === null) return "whole";
  return x >= breakX ? "bow" : "stern";
}

/** The compartments a part holds, clipped to its x range. */
export function partCompartments(
  spec: Pick<ShipSpec, "compartments">,
  part: "whole" | "bow" | "stern",
  breakX: number | null
): { index: number; fromX: number; toX: number }[] {
  const out: { index: number; fromX: number; toX: number }[] = [];
  spec.compartments.forEach((c, index) => {
    let from = c.fromX;
    let to = c.toX;
    if (part === "bow" && breakX !== null) from = Math.max(from, breakX);
    if (part === "stern" && breakX !== null) to = Math.min(to, breakX);
    if (to - from > 0.05) out.push({ index, fromX: from, toX: to });
  });
  return out;
}
