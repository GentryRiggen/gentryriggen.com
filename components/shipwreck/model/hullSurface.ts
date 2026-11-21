import type { ShipSpec } from "@/lib/shipwreck/ships/types";

/**
 * A smooth hull surface from a ship's offsets, for drawing. The sim blends
 * its stations linearly (facets are fine for volumes); the model needs
 * curves, so every series is interpolated with a monotone cubic (PCHIP),
 * which follows the offsets exactly at the stations and never overshoots
 * between them (no bumps or negative breadths at the fine ends).
 *
 * A point is addressed by `x` and `u`, the fraction of the section's own
 * height (0 at its bottom, 1 at its top, the deck edge), as the sim does.
 * Ship frame: x forward, y to port, z up from the keel at midships.
 */

/** Fractions of each section's height the stations are normalised to. */
export const HULL_FRACTIONS = [
  0, 0.01, 0.035, 0.07, 0.12, 0.19, 0.27, 0.36, 0.45, 0.53, 0.62, 0.72, 0.85, 1,
] as const;
const NF = HULL_FRACTIONS.length;

/**
 * Rounds the counter in plan (seen from above) to the real elliptical stern.
 * The offsets' run comes to a narrow point above the water (fine for the
 * sim's volumes: it is all above the night's waterline); the drawn hull
 * takes the larger of the offsets and this ellipse, faded in from `zFrom`
 * to `zTo` so the underwater run is the offsets' own.
 */
export interface CounterRounding {
  /** Where the ellipse starts (its widest point), m. */
  fromX: number;
  /** Its half-breadth there (default: the offsets' deck edge). */
  halfBreadth?: number;
  /** Superellipse exponent: 2 an ellipse, more a fuller, squarer end. */
  exponent?: number;
  zFrom: number;
  zTo: number;
}

/** Fritsch–Carlson slopes for a monotone cubic through (xs, ys). */
export function pchipSlopes(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>
): Float64Array {
  const n = xs.length;
  const m = new Float64Array(n);
  if (n < 2) return m;
  const d = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i += 1) {
    const h = xs[i + 1] - xs[i];
    d[i] = h > 0 ? (ys[i + 1] - ys[i]) / h : 0;
  }
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      const h0 = xs[i] - xs[i - 1];
      const h1 = xs[i + 1] - xs[i];
      const w0 = 2 * h1 + h0;
      const w1 = h1 + 2 * h0;
      m[i] = (w0 + w1) / (w0 / d[i - 1] + w1 / d[i]);
    }
  }
  return m;
}

/** Index of the interval of sorted `xs` holding x (clamped). */
function interval(xs: ArrayLike<number>, x: number): number {
  let lo = 0;
  let hi = xs.length - 2;
  if (x <= xs[0]) return 0;
  if (x >= xs[hi + 1]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The monotone cubic through (xs, ys) with slopes ms, at x (clamped). */
export function pchipAt(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  ms: ArrayLike<number>,
  x: number
): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  const i = interval(xs, x);
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

/** Half-breadth of a station's offsets at height z (linear, as the sim). */
function offsetAt(
  offsets: readonly (readonly [number, number])[],
  z: number
): number {
  if (z <= offsets[0][0]) return offsets[0][1];
  for (let i = 1; i < offsets.length; i += 1) {
    const [z1, h1] = offsets[i];
    if (z <= z1) {
      const [z0, h0] = offsets[i - 1];
      const t = z1 > z0 ? (z - z0) / (z1 - z0) : 1;
      return h0 + (h1 - h0) * t;
    }
  }
  return offsets[offsets.length - 1][1];
}

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** One section of the drawn hull. */
export interface HullSection {
  x: number;
  zb: number;
  zt: number;
  /** Half-breadth at each of `HULL_FRACTIONS`. */
  hb: Float64Array;
  slopes: Float64Array;
}

export interface HullSurface {
  /** The after end (the counter) and the forward end (the stem head). */
  xMin: number;
  xMax: number;
  section(x: number): HullSection;
  /** Half-breadth at fraction u of a section's height. */
  halfBreadthU(section: HullSection, u: number): number;
  /** Half-breadth at (x, z); 0 outside the hull. */
  halfBreadth(x: number, z: number): number;
  /** Height of the section's bottom (the keel line and the counter). */
  zBottom(x: number): number;
  /** Height of the deck edge (the spec's sheer). */
  zTop(x: number): number;
  /** Half-breadth of the deck edge. */
  topHalfBreadth(x: number): number;
}

export function createHullSurface(
  spec: Pick<ShipSpec, "stations" | "sheerZ">,
  counter?: CounterRounding
): HullSurface {
  const st = spec.stations;
  const xs = st.map((s) => s.x);
  const zb = st.map((s) => s.offsets[0][0]);
  const zt = st.map((s) => s.offsets[s.offsets.length - 1][0]);
  const series: Float64Array[] = [];
  for (let j = 0; j < NF; j += 1) {
    series.push(
      Float64Array.from(st, (s, k) =>
        offsetAt(s.offsets, zb[k] + (zt[k] - zb[k]) * HULL_FRACTIONS[j])
      )
    );
  }
  const zbSlopes = pchipSlopes(xs, zb);
  const seriesSlopes = series.map((s) => pchipSlopes(xs, s));
  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  const fractions = Float64Array.from(HULL_FRACTIONS);

  // The counter's ellipse: as wide as the offsets' deck edge where it
  // starts, reaching zero at the after end.
  let ellipseB = 0;
  if (counter) {
    ellipseB =
      counter.halfBreadth ??
      pchipAt(xs, series[NF - 1], seriesSlopes[NF - 1], counter.fromX);
  }
  function counterWidth(x: number, z: number): number {
    if (!counter || x >= counter.fromX) return 0;
    const a = counter.fromX - xMin;
    const v = (counter.fromX - x) / a;
    if (v >= 1) return 0;
    const n = counter.exponent ?? 2;
    return (
      ellipseB *
      Math.pow(1 - Math.pow(v, n), 1 / n) *
      smoothstep(counter.zFrom, counter.zTo, z)
    );
  }

  function zBottom(x: number): number {
    const top = spec.sheerZ(x);
    return Math.min(top - 0.3, pchipAt(xs, zb, zbSlopes, x));
  }

  function section(x: number): HullSection {
    const bottom = zBottom(x);
    const top = spec.sheerZ(x);
    const hb = new Float64Array(NF);
    for (let j = 0; j < NF; j += 1) {
      const h = Math.max(0, pchipAt(xs, series[j], seriesSlopes[j], x));
      const z = bottom + (top - bottom) * HULL_FRACTIONS[j];
      hb[j] = Math.max(h, counterWidth(x, z));
    }
    // Ends: the counter's tip and the stem head close to a line.
    if (x <= xMin + 1e-6 || x >= xMax - 1e-6) hb.fill(0);
    return { x, zb: bottom, zt: top, hb, slopes: pchipSlopes(fractions, hb) };
  }

  function halfBreadthU(s: HullSection, u: number): number {
    return Math.max(0, pchipAt(fractions, s.hb, s.slopes, u));
  }

  function halfBreadth(x: number, z: number): number {
    if (x < xMin || x > xMax) return 0;
    const s = section(x);
    if (z < s.zb || z > s.zt) return 0;
    return halfBreadthU(s, (z - s.zb) / (s.zt - s.zb));
  }

  return {
    xMin,
    xMax,
    section,
    halfBreadthU,
    halfBreadth,
    zBottom,
    zTop: (x) => spec.sheerZ(x),
    topHalfBreadth: (x) => {
      if (x <= xMin || x >= xMax) return 0;
      return section(x).hb[NF - 1];
    },
  };
}
