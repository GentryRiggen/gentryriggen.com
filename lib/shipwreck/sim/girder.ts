import type { Compartment } from "../ships/types";
import {
  ENGINE_CASING_FACTOR,
  GIRDER_END_FRACTION,
  GRAV,
  RHO,
} from "./constants";
import type { Body } from "./body";
import type { MassModel } from "./mass";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, cos, floor, max, min } = Math;

/**
 * The hull girder. Load per bin (on the hull's resampled stations) is the
 * buoyancy of the sections under the sea less the weight of the lightship
 * and the water, both resolved normal to the hull's axis, less the inertia
 * of the bin's mass (the body's normal and pitch accelerations). Shear is
 * its running sum from the stern, bending moment the running integral of
 * shear; a small linear closure correction removes the residue at the bow.
 * Positive `hog` is hogging (deck in tension: the ends sag). Strength is
 * the spec's hogMaxNm / sagMaxNm over the middle half of the length, falling
 * linearly to GIRDER_END_FRACTION at the ends, and ENGINE_CASING_FACTOR of
 * that over the engine spaces (their casings cut through the decks).
 */

export interface GirderState {
  /** Bending moment per bin, N·m (+ hogging). */
  hog: Float64Array;
  /** Highest |moment| / strength and where. */
  worst: number;
  worstX: number;
  worstHog: number;
}

const loads = {
  buf: new Float64Array(0),
  shear: new Float64Array(0),
  moment: new Float64Array(0),
};

function deposit(
  q: Float64Array,
  model: MassModel,
  x: number,
  f: number
): void {
  const n = model.xs.length;
  const x0 = model.xs[0];
  const step = (model.xs[n - 1] - x0) / (n - 1);
  const p = (x - x0) / step;
  const i = max(0, min(n - 2, floor(p)));
  const t = max(0, min(1, p - i));
  q[i] += f * (1 - t);
  q[i + 1] += f * t;
}

/** Girder strength along the length as a fraction of the spec's values. */
export function strengthProfile(
  xs: Float64Array,
  compartments: readonly Compartment[]
): Float64Array {
  const n = xs.length;
  const xMin = xs[0];
  const xMax = xs[n - 1];
  const mid = (xMin + xMax) / 2;
  const half = (xMax - xMin) / 2;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const d = abs(xs[i] - mid) / half; // 0 middle .. 1 ends
    let f = d <= 0.5 ? 1 : 1 - ((1 - GIRDER_END_FRACTION) * (d - 0.5)) / 0.5;
    if (
      compartments.some(
        (c) => c.kind === "engine" && xs[i] >= c.fromX && xs[i] <= c.toX
      )
    )
      f *= ENGINE_CASING_FACTOR;
    out[i] = f;
  }
  return out;
}

export function girder(
  b: Body,
  model: MassModel,
  hogMax: number,
  sagMax: number,
  strength: Float64Array,
  out: GirderState
): void {
  const n = model.xs.length;
  if (loads.buf.length !== n) {
    loads.buf = new Float64Array(n);
    loads.shear = new Float64Array(n);
    loads.moment = new Float64Array(n);
  }
  const q = loads.buf;
  q.fill(0);
  const c = cos(b.pitch) * cos(b.roll);
  // Lightship weight and inertia.
  for (let i = 0; i < n; i += 1) {
    const m = model.kg[i];
    const a = b.an - b.alpha * (model.xs[i] - b.gx);
    q[i] -= m * (GRAV * c + a);
  }
  // Buoyancy and water, per cell station (trapezoid weights).
  for (const cell of b.all) {
    const s = cell.slice;
    for (let k = 0; k < s.n; k += 1) {
      const dx =
        ((k < s.n - 1 ? s.xs[k + 1] : s.xs[k]) -
          (k > 0 ? s.xs[k - 1] : s.xs[k])) /
        2;
      if (dx <= 0) continue;
      const a = b.an - b.alpha * (s.xs[k] - b.gx);
      const buoy = RHO * GRAV * c * cell.seaArea[k];
      const wm = RHO * cell.waterArea[k];
      deposit(q, model, s.xs[k], (buoy - wm * (GRAV * c + a)) * dx);
    }
  }
  // Shear and moment, stern to bow.
  const hog = out.hog.length === n ? out.hog : (out.hog = new Float64Array(n));
  let shear = 0;
  let moment = 0;
  const xs = model.xs;
  let shearEnd = 0;
  for (let i = 0; i < n; i += 1) shearEnd += q[i];
  const len = xs[n - 1] - xs[0];
  const sh = loads.shear;
  for (let i = 0; i < n; i += 1) {
    shear += q[i] - (shearEnd * (model.hi[i] - model.lo[i])) / len;
    sh[i] = shear;
  }
  const m = loads.moment;
  m[0] = 0;
  for (let i = 1; i < n; i += 1) {
    moment += sh[i - 1] * (xs[i] - xs[i - 1]);
    m[i] = moment;
  }
  const mEnd = m[n - 1];
  let worst = 0;
  let worstX = 0;
  let worstHog = 0;
  for (let i = 0; i < n; i += 1) {
    const value = -(m[i] - (mEnd * (xs[i] - xs[0])) / len);
    hog[i] = value;
    const f = strength[i];
    const u = value >= 0 ? value / (hogMax * f) : -value / (sagMax * f);
    if (u > worst) {
      worst = u;
      worstX = xs[i];
      worstHog = value;
    }
  }
  out.worst = worst;
  out.worstX = worstX;
  out.worstHog = worstHog;
}
