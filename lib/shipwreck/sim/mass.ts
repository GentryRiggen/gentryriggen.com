import type { Compartment, ShipSpec } from "../ships/types";
import {
  MASS_BOILER,
  MASS_ENGINE,
  MASS_HOLD,
  MASS_PEAK,
  MASS_SHAFT,
  MASS_SUPERSTRUCTURE,
} from "./constants";
import type { HullModel, Slice } from "./geometry";

/**
 * The lightship (everything but flood water) as a mass per bin on the hull's
 * resampled stations: the hull steel by its section area, the superstructure
 * by its boxes, machinery, coal and cargo by compartment kind, then tilted
 * linearly so its centre sits at `spec.lcg`.
 */
export interface MassModel {
  /** Bin centres (the hull's stations) and their half-widths. */
  xs: Float64Array;
  lo: Float64Array;
  hi: Float64Array;
  /** kg per bin. */
  kg: Float64Array;
  total: number;
}

const KIND_FRACTION: Record<Compartment["kind"], number> = {
  boiler: MASS_BOILER,
  engine: MASS_ENGINE,
  shaft: MASS_SHAFT,
  hold: MASS_HOLD,
  peak: MASS_PEAK / 2,
  stern: MASS_PEAK / 2,
};

export function buildMass(
  spec: ShipSpec,
  hull: HullModel,
  hullFullArea: Float64Array,
  boxes: readonly Slice[]
): MassModel {
  const n = hull.n;
  const xs = hull.xs;
  const lo = new Float64Array(n);
  const hi = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    lo[i] = i === 0 ? xs[0] : (xs[i - 1] + xs[i]) / 2;
    hi[i] = i === n - 1 ? xs[n - 1] : (xs[i] + xs[i + 1]) / 2;
  }
  const total = spec.displacementT * 1000;
  const kg = new Float64Array(n);
  const add = (weights: Float64Array, mass: number) => {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += weights[i];
    if (sum <= 0) return;
    for (let i = 0; i < n; i += 1) kg[i] += (weights[i] / sum) * mass;
  };
  const w = new Float64Array(n);
  // Machinery, coal, cargo: spread over each kind's compartments by length.
  let kinds = 0;
  for (const kind of Object.keys(KIND_FRACTION) as Compartment["kind"][]) {
    const comps = spec.compartments.filter((c) => c.kind === kind);
    if (comps.length === 0) continue;
    w.fill(0);
    for (let i = 0; i < n; i += 1)
      for (const c of comps) {
        const overlap = Math.min(hi[i], c.toX) - Math.max(lo[i], c.fromX);
        if (overlap > 0) w[i] += overlap * hullFullArea[i];
      }
    add(w, KIND_FRACTION[kind] * total);
    kinds += KIND_FRACTION[kind];
  }
  // Superstructure over its boxes, by their section area.
  w.fill(0);
  for (const b of boxes)
    for (let k = 0; k < b.n; k += 1) {
      const f = ((b.xs[k] - hull.xMin) / (hull.xMax - hull.xMin)) * (n - 1);
      const i = Math.max(0, Math.min(n - 1, Math.round(f)));
      w[i] += b.fullA[k];
    }
  add(w, MASS_SUPERSTRUCTURE * total);
  // The hull steel and everything else, by section area.
  for (let i = 0; i < n; i += 1) w[i] = hullFullArea[i] * (hi[i] - lo[i]);
  add(w, (1 - kinds - MASS_SUPERSTRUCTURE) * total);
  // Tilt to the given centre of mass.
  let m = 0;
  let mx = 0;
  for (let i = 0; i < n; i += 1) {
    m += kg[i];
    mx += kg[i] * xs[i];
  }
  const c0 = mx / m;
  let s2 = 0;
  for (let i = 0; i < n; i += 1) s2 += kg[i] * (xs[i] - c0) * (xs[i] - c0);
  const k = (spec.lcg - c0) / (s2 / m);
  for (let i = 0; i < n; i += 1)
    kg[i] = Math.max(0, kg[i] * (1 + k * (xs[i] - c0)));
  let after = 0;
  for (let i = 0; i < n; i += 1) after += kg[i];
  for (let i = 0; i < n; i += 1) kg[i] *= total / after;
  return { xs, lo, hi, kg, total };
}

/** Mass, centre and pitch inertia (about that centre) of [xFrom, xTo]. */
export function massOf(
  model: MassModel,
  xFrom: number,
  xTo: number
): { mass: number; cx: number; iyy: number } {
  let m = 0;
  let mx = 0;
  let mxx = 0;
  for (let i = 0; i < model.xs.length; i += 1) {
    const width = model.hi[i] - model.lo[i];
    if (width <= 0) continue;
    const a = Math.max(model.lo[i], xFrom);
    const b = Math.min(model.hi[i], xTo);
    if (b <= a) continue;
    const part = (model.kg[i] * (b - a)) / width;
    const x = (a + b) / 2;
    m += part;
    mx += part * x;
    mxx += part * x * x;
  }
  const cx = m > 0 ? mx / m : (xFrom + xTo) / 2;
  return { mass: m, cx, iyy: Math.max(0, mxx - m * cx * cx) };
}
