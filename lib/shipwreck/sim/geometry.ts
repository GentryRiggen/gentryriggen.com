import type { Compartment, ShipSpec } from "../ships/types";

/** A compartment's transverse extent (missing: the full breadth). */
export type Span = NonNullable<Compartment["span"]>;

/**
 * The hull resampled for the sim: `HULL_STATIONS` evenly spaced stations,
 * each with the same `LEVELS.length` offsets at fixed fractions of its own
 * height, so any two neighbouring sections can be blended vertex by vertex.
 */

export const HULL_STATIONS = 128;
/** Normalised heights of the resampled offsets (dense at the bilge). */
export const LEVELS = [
  0, 0.01, 0.035, 0.07, 0.12, 0.19, 0.27, 0.36, 0.45, 0.53, 0.62, 0.72, 0.85, 1,
];
const NL = LEVELS.length;

export interface HullModel {
  n: number;
  xs: Float64Array;
  zb: Float64Array;
  zt: Float64Array;
  /** Half-breadths, `n * LEVELS.length`. */
  hb: Float64Array;
  xMin: number;
  xMax: number;
}

/** Half-breadth of a station's offset list at height z (0 outside). */
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

export function buildHull(
  spec: Pick<ShipSpec, "stations">,
  count = HULL_STATIONS
): HullModel {
  const st = spec.stations;
  // Each spec station normalised to LEVELS.
  const sz0 = st.map((s) => s.offsets[0][0]);
  const sz1 = st.map((s) => s.offsets[s.offsets.length - 1][0]);
  const shb = st.map((s, i) =>
    LEVELS.map((l) => offsetAt(s.offsets, sz0[i] + (sz1[i] - sz0[i]) * l))
  );
  const xMin = st[0].x;
  const xMax = st[st.length - 1].x;
  const xs = new Float64Array(count);
  const zb = new Float64Array(count);
  const zt = new Float64Array(count);
  const hb = new Float64Array(count * NL);
  let k = 0;
  for (let i = 0; i < count; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / (count - 1);
    while (k < st.length - 2 && st[k + 1].x < x) k += 1;
    const t = Math.min(1, Math.max(0, (x - st[k].x) / (st[k + 1].x - st[k].x)));
    xs[i] = x;
    zb[i] = sz0[k] + (sz0[k + 1] - sz0[k]) * t;
    zt[i] = sz1[k] + (sz1[k + 1] - sz1[k]) * t;
    for (let j = 0; j < NL; j += 1)
      hb[i * NL + j] = shb[k][j] + (shb[k + 1][j] - shb[k][j]) * t;
  }
  return { n: count, xs, zb, zt, hb, xMin, xMax };
}

/** The section at x, blended from the two nearest resampled stations. */
export function sectionAt(
  hull: HullModel,
  x: number
): { zb: number; zt: number; hb: number[] } {
  const { n } = hull;
  const f = ((x - hull.xMin) / (hull.xMax - hull.xMin)) * (n - 1);
  const i = Math.max(0, Math.min(n - 2, Math.floor(f)));
  const t = Math.max(0, Math.min(1, f - i));
  const hb: number[] = [];
  for (let j = 0; j < NL; j += 1)
    hb.push(
      hull.hb[i * NL + j] +
        (hull.hb[(i + 1) * NL + j] - hull.hb[i * NL + j]) * t
    );
  return {
    zb: hull.zb[i] + (hull.zb[i + 1] - hull.zb[i]) * t,
    zt: hull.zt[i] + (hull.zt[i + 1] - hull.zt[i]) * t,
    hb,
  };
}

/** Half-breadth of the hull at (x, z). */
export function hullHalfBreadth(hull: HullModel, x: number, z: number): number {
  const s = sectionAt(hull, x);
  if (z < s.zb || z > s.zt || s.zt <= s.zb) return 0;
  const u = (z - s.zb) / (s.zt - s.zb);
  for (let j = 1; j < NL; j += 1) {
    if (u <= LEVELS[j]) {
      const t = (u - LEVELS[j - 1]) / (LEVELS[j] - LEVELS[j - 1]);
      return s.hb[j - 1] + (s.hb[j] - s.hb[j - 1]) * t;
    }
  }
  return s.hb[NL - 1];
}

/**
 * A slice of a closed volume between two x positions: a list of sections,
 * each a polygon in the (y, z) plane with `nv` vertices, counter-clockwise
 * (port side bottom to top, then starboard top to bottom).
 */
export interface Slice {
  n: number;
  nv: number;
  xFrom: number;
  xTo: number;
  xs: Float64Array;
  ys: Float64Array;
  zs: Float64Array;
  /** Whole-section area and its first moment in z, per station. */
  fullA: Float64Array;
  fullAz: Float64Array;
  hbMax: Float64Array;
  zLo: Float64Array;
  zHi: Float64Array;
  /** The whole slice: volume and centroid (cy is 0 unless spanned). */
  capacity: number;
  cx: number;
  cy: number;
  cz: number;
  /** A wing or centre cell: its span, and the hull's own half-breadth at
   * the top of each station (the deck edge, outside a centre cell). */
  span?: Span;
  edgeHb?: Float64Array;
  /** Spanned only: each station's first moment in y (A·cy) and breadth. */
  fullAy?: Float64Array;
  width?: Float64Array;
}

function polygonArea(
  ys: Float64Array,
  zs: Float64Array,
  off: number,
  nv: number
): [number, number, number] {
  let a2 = 0;
  let sy = 0;
  let sz = 0;
  for (let i = 0; i < nv; i += 1) {
    const j = i === nv - 1 ? 0 : i + 1;
    const cr = ys[off + i] * zs[off + j] - ys[off + j] * zs[off + i];
    a2 += cr;
    sy += (ys[off + i] + ys[off + j]) * cr;
    sz += (zs[off + i] + zs[off + j]) * cr;
  }
  const area = a2 / 2;
  return [area, area > 1e-12 ? sz / 6 : 0, area > 1e-12 ? sy / 6 : 0];
}

function finishSlice(
  xs: number[],
  sections: { y: number[]; z: number[] }[],
  nv: number,
  span?: Span
): Slice {
  const n = xs.length;
  const s: Slice = {
    n,
    nv,
    xFrom: xs[0],
    xTo: xs[n - 1],
    xs: Float64Array.from(xs),
    ys: new Float64Array(n * nv),
    zs: new Float64Array(n * nv),
    fullA: new Float64Array(n),
    fullAz: new Float64Array(n),
    hbMax: new Float64Array(n),
    zLo: new Float64Array(n),
    zHi: new Float64Array(n),
    capacity: 0,
    cx: 0,
    cy: 0,
    cz: 0,
  };
  const fullAy = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let hbMax = 0;
    let zLo = Infinity;
    let zHi = -Infinity;
    for (let v = 0; v < nv; v += 1) {
      const y = sections[i].y[v];
      const z = sections[i].z[v];
      s.ys[i * nv + v] = y;
      s.zs[i * nv + v] = z;
      hbMax = Math.max(hbMax, Math.abs(y));
      zLo = Math.min(zLo, z);
      zHi = Math.max(zHi, z);
    }
    const [a, az, ay] = polygonArea(s.ys, s.zs, i * nv, nv);
    fullAy[i] = ay;
    s.fullA[i] = a;
    s.fullAz[i] = az;
    s.hbMax[i] = hbMax;
    s.zLo[i] = zLo;
    s.zHi[i] = zHi;
  }
  let v = 0;
  let mx = 0;
  let mz = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const dx = s.xs[i + 1] - s.xs[i];
    v += ((s.fullA[i] + s.fullA[i + 1]) * dx) / 2;
    mx += ((s.xs[i] * s.fullA[i] + s.xs[i + 1] * s.fullA[i + 1]) * dx) / 2;
    mz += ((s.fullAz[i] + s.fullAz[i + 1]) * dx) / 2;
  }
  s.capacity = v;
  s.cx = v > 0 ? mx / v : (s.xFrom + s.xTo) / 2;
  s.cz = v > 0 ? mz / v : 0;
  if (span) {
    // A full-breadth section is symmetric (cy 0); only a wing or centre
    // cell needs its transverse centre.
    let my = 0;
    for (let i = 0; i < n - 1; i += 1)
      my += ((fullAy[i] + fullAy[i + 1]) * (s.xs[i + 1] - s.xs[i])) / 2;
    s.cy = v > 0 ? my / v : 0;
    s.span = span;
    s.fullAy = fullAy;
    const width = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k < nv; k += 1) {
        lo = Math.min(lo, s.ys[i * nv + k]);
        hi = Math.max(hi, s.ys[i * nv + k]);
      }
      width[i] = hi - lo;
    }
    s.width = width;
  }
  return s;
}

function hullPolygon(sec: { zb: number; zt: number; hb: number[] }): {
  y: number[];
  z: number[];
} {
  const y: number[] = [];
  const z: number[] = [];
  for (let j = 0; j < NL; j += 1) {
    y.push(sec.hb[j]);
    z.push(sec.zb + (sec.zt - sec.zb) * LEVELS[j]);
  }
  for (let j = NL - 1; j >= 0; j -= 1) {
    y.push(-sec.hb[j]);
    z.push(sec.zb + (sec.zt - sec.zb) * LEVELS[j]);
  }
  return { y, z };
}

/**
 * Part of a hull section beside a longitudinal bulkhead at |y| = span.y,
 * with the same vertex count (so sections still blend vertex by vertex):
 * the side's half-breadths clamped at the bulkhead. Where the hull is
 * narrower than the bulkhead's offset a wing has no width (its vertices
 * coincide). Centre + port + starboard add up to the whole section.
 */
function spanPolygon(
  poly: { y: number[]; z: number[] },
  span: Span
): { y: number[]; z: number[] } {
  const y = poly.y.slice();
  const half = y.length / 2;
  const b = span.y;
  for (let v = 0; v < y.length; v += 1) {
    const hb = Math.abs(poly.y[v]);
    const right = v < half; // the port side, bottom to top
    if (span.side === "centre") y[v] = (right ? 1 : -1) * Math.min(hb, b);
    else if (span.side === "port") y[v] = right ? Math.max(hb, b) : b;
    else y[v] = right ? -b : -Math.max(hb, b);
  }
  return { y, z: poly.z };
}

/**
 * The hull between xFrom and xTo, with sections clipped there; with a
 * span, only that wing or the centre between the longitudinal bulkheads.
 */
export function hullSlice(
  hull: HullModel,
  xFrom: number,
  xTo: number,
  span?: Span
): Slice {
  const a = Math.max(hull.xMin, xFrom);
  const b = Math.min(hull.xMax, xTo);
  const xs: number[] = [a];
  for (let i = 0; i < hull.n; i += 1) {
    const x = hull.xs[i];
    if (x > a + 0.3 && x < b - 0.3) xs.push(x);
  }
  xs.push(b);
  // Long gaps (a short slice between two stations) get one more section.
  const out: number[] = [];
  for (let i = 0; i < xs.length; i += 1) {
    out.push(xs[i]);
    if (i < xs.length - 1 && xs[i + 1] - xs[i] > 2.5) {
      const parts = Math.ceil((xs[i + 1] - xs[i]) / 2.5);
      for (let p = 1; p < parts; p += 1)
        out.push(xs[i] + ((xs[i + 1] - xs[i]) * p) / parts);
    }
  }
  if (!span)
    return finishSlice(
      out,
      out.map((x) => hullPolygon(sectionAt(hull, x))),
      NL * 2
    );
  const sections = out.map((x) => sectionAt(hull, x));
  const slice = finishSlice(
    out,
    sections.map((sec) => spanPolygon(hullPolygon(sec), span)),
    NL * 2,
    span
  );
  slice.edgeHb = Float64Array.from(sections.map((sec) => sec.hb[NL - 1]));
  return slice;
}

/**
 * A superstructure box: from the deck edge (`sheerZ`), or its own floor
 * `baseZ` (a tier on another box), up to `topZ`, as wide as the hull's
 * deck at each x, or no wider than `halfBreadth` either side (a deckhouse
 * inboard of an open deck).
 */
export function boxSlice(
  hull: HullModel,
  sheerZ: (x: number) => number,
  fromX: number,
  toX: number,
  topZ: number,
  halfBreadth?: number,
  baseZ?: number
): Slice {
  const a = Math.max(hull.xMin, fromX);
  const b = Math.min(hull.xMax, toX);
  const parts = Math.max(2, Math.ceil((b - a) / 3));
  const xs: number[] = [];
  for (let p = 0; p <= parts; p += 1) xs.push(a + ((b - a) * p) / parts);
  const sections = xs.map((x) => {
    const sec = sectionAt(hull, x);
    const hb =
      halfBreadth === undefined
        ? sec.hb[NL - 1]
        : Math.min(sec.hb[NL - 1], halfBreadth);
    const z0 = baseZ === undefined ? sheerZ(x) : baseZ;
    const z1 = Math.max(z0, topZ);
    return { y: [hb, hb, -hb, -hb], z: [z0, z1, z1, z0] };
  });
  return finishSlice(xs, sections, 4);
}
