import type { ShipSpec } from "../ships/types";
import type { V2 } from "./types";

/**
 * The deck edge in plan, as the 3D model draws it, so the walk's railings
 * stand where the drawn ones do. A port of `topHalfBreadth` in
 * components/shipwreck/model/hullSurface.ts (lib must not import from
 * components): a monotone cubic (PCHIP) through the stations' top
 * half-breadths, widened aft by the counter's ellipse in plan. The counter's
 * numbers are each ship's recipe's (titanicRecipe.ts, lusitaniaRecipe.ts);
 * keep them in step.
 */

export interface CounterPlan {
  /** Where the ellipse starts (its widest point), m. */
  fromX: number;
  /** Its half-breadth there (default: the offsets' deck edge). */
  halfBreadth?: number;
  /** Superellipse exponent. */
  exponent: number;
}

/** Fritsch–Carlson slopes for a monotone cubic through (xs, ys). */
function pchipSlopes(xs: readonly number[], ys: readonly number[]): number[] {
  const n = xs.length;
  const m = new Array<number>(n).fill(0);
  if (n < 2) return m;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const h = xs[i + 1] - xs[i];
    d.push(h > 0 ? (ys[i + 1] - ys[i]) / h : 0);
  }
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (d[i - 1] * d[i] <= 0) continue;
    const h0 = xs[i] - xs[i - 1];
    const h1 = xs[i + 1] - xs[i];
    const w0 = 2 * h1 + h0;
    const w1 = h1 + 2 * h0;
    m[i] = (w0 + w1) / (w0 / d[i - 1] + w1 / d[i]);
  }
  return m;
}

function pchipAt(
  xs: readonly number[],
  ys: readonly number[],
  ms: readonly number[],
  x: number
): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 0;
  while (i < n - 2 && xs[i + 1] <= x) i += 1;
  const h = xs[i + 1] - xs[i];
  const t = (x - xs[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[i] +
    (t3 - 2 * t2 + t) * h * ms[i] +
    (-2 * t3 + 3 * t2) * ys[i + 1] +
    (t3 - t2) * h * ms[i + 1]
  );
}

/** The drawn deck edge's half-breadth at x (0 beyond her ends). */
export function deckEdgeOf(
  spec: Pick<ShipSpec, "stations">,
  counter: CounterPlan
): (x: number) => number {
  const xs = spec.stations.map((s) => s.x);
  const ys = spec.stations.map((s) => s.offsets[s.offsets.length - 1][1]);
  const ms = pchipSlopes(xs, ys);
  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  const b = counter.halfBreadth ?? pchipAt(xs, ys, ms, counter.fromX);
  return (x) => {
    if (x <= xMin || x >= xMax) return 0;
    const h = Math.max(0, pchipAt(xs, ys, ms, x));
    if (x >= counter.fromX) return h;
    const v = (counter.fromX - x) / (counter.fromX - xMin);
    if (v >= 1) return h;
    const n = counter.exponent;
    return Math.max(h, b * Math.pow(1 - Math.pow(v, n), 1 / n));
  };
}

/** An area's outline from its two sides, and which edges are its ends. */
export interface SidedOutline {
  outline: V2[];
  /** The edge across the forward end and the one across the after end. */
  fwdEdge: number;
  aftEdge: number;
}

/**
 * A counter-clockwise outline between x0 and x1 whose sides are at
 * ±halfWidth(x): the starboard side forward, across the forward end, the
 * port side aft, across the after end. Sampled every `step` m, then thinned
 * (Douglas–Peucker) to within 2 cm of the samples.
 */
export function sidedOutline(
  halfWidth: (x: number) => number,
  x0: number,
  x1: number,
  step = 0.5
): SidedOutline {
  const xs: number[] = [];
  const n = Math.max(1, Math.ceil((x1 - x0) / step));
  for (let i = 0; i <= n; i += 1) xs.push(x0 + ((x1 - x0) * i) / n);
  const side: V2[] = xs.map((x) => [x, halfWidth(x)] as const);
  const kept = simplify(side, 0.02);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const stbd: V2[] = kept.map(([x, y]) => [round(x), -round(y)] as const);
  const port: V2[] = [...kept]
    .reverse()
    .map(([x, y]) => [round(x), round(y)] as const);
  return {
    outline: [...stbd, ...port],
    fwdEdge: stbd.length - 1,
    aftEdge: stbd.length + port.length - 1,
  };
}

/** Douglas–Peucker: the fewest points within `tol` of the polyline. */
function simplify(pts: readonly V2[], tol: number): V2[] {
  if (pts.length <= 2) return [...pts];
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let worst = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const d = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / len;
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= tol) return [a, b];
  const left = simplify(pts.slice(0, at + 1), tol);
  const right = simplify(pts.slice(at), tol);
  return [...left.slice(0, -1), ...right];
}
