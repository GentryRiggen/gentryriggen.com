import type { Slice } from "./geometry";

/**
 * Volumes under a plane. A point p of the ship frame is "under" the plane
 * when `nx*x + ny*y + nz*z + d < 0`. For the sea, (nx, ny, nz) is the earth's
 * up direction in the ship frame and d the earth height of the ship-frame
 * origin; for the water inside a compartment, d is that less the water level.
 *
 * Each section polygon is clipped against the plane (Sutherland–Hodgman, so
 * any shape works), its area and centroid taken by the shoelace formula, and
 * the results integrated along x by the trapezoid rule. Where the plane
 * crosses the length between two stations (a steep pitch), that interval is
 * split into blended sub-sections so the volume stays smooth up to 90°.
 */

/** Indexes into the result buffer of `integrateSlice`. */
export const R_VOL = 0;
export const R_MX = 1;
export const R_MY = 2;
export const R_MZ = 3;
/** ∫ chord dx, ∫ chord x dx, ∫ chord x² dx, ∫ chord³/12 dx over the cut. */
export const R_CH = 4;
export const R_CHX = 5;
export const R_CHXX = 6;
export const R_CHT = 7;
/** Strip quantities (stations only): ∫ s dx, ∫ s x dx, ∫ s x² dx, ∫ s x³... */
export const R_S = 8;
export const R_SX = 9;
export const R_SXX = 10;
/** ∫ s² dx and its x moments (added mass, normal to the axis). */
export const R_S2 = 11;
export const R_S2X = 12;
export const R_S2XX = 13;
export const R_SIZE = 14;

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, hypot, max, min, sqrt } = Math;

/** Sub-sections used where the plane crosses between two stations. */
const SPLIT = 8;

// Scratch: one clipped section's result.
let cA = 0;
let cAy = 0;
let cAz = 0;
let cChord = 0;
let cChord3 = 0;

/**
 * Clip one section (vertices `off .. off+nv-1` of ys/zs) to `a*y + b*z + c < 0`
 * and leave its area, first moments and cut chord in the scratch values.
 */
function clipSection(
  ys: Float64Array,
  zs: Float64Array,
  off: number,
  nv: number,
  a: number,
  b: number,
  c: number
): void {
  let a2 = 0;
  let sy = 0;
  let sz = 0;
  let chord = 0;
  let chord3 = 0;
  let firstY = 0;
  let firstZ = 0;
  let lastY = 0;
  let lastZ = 0;
  let count = 0;
  let firstIsEntry = false;
  let lastIsExit = false;

  let py = ys[off + nv - 1];
  let pz = zs[off + nv - 1];
  let pd = a * py + b * pz + c;
  for (let i = 0; i < nv; i += 1) {
    const ey = ys[off + i];
    const ez = zs[off + i];
    const ed = a * ey + b * ez + c;
    const eIn = ed < 0;
    const pIn = pd < 0;
    if (eIn !== pIn) {
      const t = pd / (pd - ed);
      const iy = py + (ey - py) * t;
      const iz = pz + (ez - pz) * t;
      // Emit the intersection.
      if (count === 0) {
        firstY = iy;
        firstZ = iz;
        firstIsEntry = eIn;
      } else {
        const cr = lastY * iz - iy * lastZ;
        a2 += cr;
        sy += (lastY + iy) * cr;
        sz += (lastZ + iz) * cr;
        if (lastIsExit && eIn) {
          const l = hypot(iy - lastY, iz - lastZ);
          chord += l;
          chord3 += l * l * l;
        }
      }
      lastY = iy;
      lastZ = iz;
      lastIsExit = !eIn;
      count += 1;
    }
    if (eIn) {
      if (count === 0) {
        firstY = ey;
        firstZ = ez;
        firstIsEntry = false;
      } else {
        const cr = lastY * ez - ey * lastZ;
        a2 += cr;
        sy += (lastY + ey) * cr;
        sz += (lastZ + ez) * cr;
      }
      lastY = ey;
      lastZ = ez;
      lastIsExit = false;
      count += 1;
    }
    py = ey;
    pz = ez;
    pd = ed;
  }
  if (count > 1) {
    const cr = lastY * firstZ - firstY * lastZ;
    a2 += cr;
    sy += (lastY + firstY) * cr;
    sz += (lastZ + firstZ) * cr;
    if (lastIsExit && firstIsEntry) {
      const l = hypot(firstY - lastY, firstZ - lastZ);
      chord += l;
      chord3 += l * l * l;
    }
  }
  cA = a2 / 2;
  cAy = sy / 6;
  cAz = sz / 6;
  cChord = chord;
  cChord3 = chord3;
}

// Per-station results of the current integration.
let stA = new Float64Array(256);
let stAy = new Float64Array(256);
let stAz = new Float64Array(256);
let stCh = new Float64Array(256);
let stCh3 = new Float64Array(256);
let stState = new Int8Array(256);
let subY = new Float64Array(64);
let subZ = new Float64Array(64);

function ensure(n: number, nv: number): void {
  if (stA.length < n) {
    const m = n * 2;
    stA = new Float64Array(m);
    stAy = new Float64Array(m);
    stAz = new Float64Array(m);
    stCh = new Float64Array(m);
    stCh3 = new Float64Array(m);
    stState = new Int8Array(m);
  }
  if (subY.length < nv) {
    subY = new Float64Array(nv * 2);
    subZ = new Float64Array(nv * 2);
  }
}

/** Evaluate station i of the slice into the per-station arrays. */
function station(
  s: Slice,
  i: number,
  nx: number,
  ny: number,
  nz: number,
  d: number
): void {
  const c = nx * s.xs[i] + d;
  // The section's bounding box decides wholly under / wholly clear quickly.
  const h = s.hbMax[i];
  const ay = abs(ny) * h;
  const zl = nz * s.zLo[i];
  const zh = nz * s.zHi[i];
  const lo = min(zl, zh) - ay + c;
  const hi = max(zl, zh) + ay + c;
  if (hi < 0) {
    stA[i] = s.fullA[i];
    stAy[i] = 0;
    stAz[i] = s.fullAz[i];
    stCh[i] = 0;
    stCh3[i] = 0;
    stState[i] = 2;
  } else if (lo >= 0 || s.fullA[i] <= 0) {
    stA[i] = 0;
    stAy[i] = 0;
    stAz[i] = 0;
    stCh[i] = 0;
    stCh3[i] = 0;
    stState[i] = 0;
  } else {
    clipSection(s.ys, s.zs, i * s.nv, s.nv, ny, nz, c);
    stA[i] = cA;
    stAy[i] = cAy;
    stAz[i] = cAz;
    stCh[i] = cChord;
    stCh3[i] = cChord3;
    stState[i] = 1;
  }
}

/**
 * Integrate the slice under the plane into `out` (length R_SIZE). With
 * `areas`, also writes each station's submerged area there.
 */
export function integrateSlice(
  s: Slice,
  nx: number,
  ny: number,
  nz: number,
  d: number,
  out: Float64Array,
  areas?: Float64Array,
  breadths?: Float64Array
): void {
  const n = s.n;
  const nv = s.nv;
  ensure(n, nv);
  out.fill(0);
  // Whole slice clear of / under the plane: bounding box of the stations.
  for (let i = 0; i < n; i += 1) station(s, i, nx, ny, nz, d);
  const xs = s.xs;
  let vol = 0;
  let mx = 0;
  let my = 0;
  let mz = 0;
  let ch = 0;
  let chx = 0;
  let chxx = 0;
  let cht = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const dx = x1 - x0;
    const s0 = stState[i];
    const s1 = stState[i + 1];
    const f0 = s.fullA[i] > 0 ? stA[i] / s.fullA[i] : s0 / 2;
    const f1 = s.fullA[i + 1] > 0 ? stA[i + 1] / s.fullA[i + 1] : s1 / 2;
    const split = (s0 !== s1 && (s0 !== 1 || s1 !== 1)) || abs(f0 - f1) > 0.35;
    if (!split) {
      const h = dx / 2;
      vol += (stA[i] + stA[i + 1]) * h;
      mx += (x0 * stA[i] + x1 * stA[i + 1]) * h;
      my += (stAy[i] + stAy[i + 1]) * h;
      mz += (stAz[i] + stAz[i + 1]) * h;
      ch += (stCh[i] + stCh[i + 1]) * h;
      chx += (x0 * stCh[i] + x1 * stCh[i + 1]) * h;
      chxx += (x0 * x0 * stCh[i] + x1 * x1 * stCh[i + 1]) * h;
      cht += ((stCh3[i] + stCh3[i + 1]) * h) / 12;
      continue;
    }
    // Blend sub-sections across the interval.
    let pa = stA[i];
    let pay = stAy[i];
    let paz = stAz[i];
    let pch = stCh[i];
    let pch3 = stCh3[i];
    let px = x0;
    const o0 = i * nv;
    const o1 = (i + 1) * nv;
    for (let k = 1; k <= SPLIT; k += 1) {
      let a;
      let ay;
      let az;
      let cch;
      let cch3;
      const t = k / SPLIT;
      const x = x0 + dx * t;
      if (k === SPLIT) {
        a = stA[i + 1];
        ay = stAy[i + 1];
        az = stAz[i + 1];
        cch = stCh[i + 1];
        cch3 = stCh3[i + 1];
      } else {
        for (let v = 0; v < nv; v += 1) {
          subY[v] = s.ys[o0 + v] + (s.ys[o1 + v] - s.ys[o0 + v]) * t;
          subZ[v] = s.zs[o0 + v] + (s.zs[o1 + v] - s.zs[o0 + v]) * t;
        }
        clipSection(subY, subZ, 0, nv, ny, nz, nx * x + d);
        a = cA;
        ay = cAy;
        az = cAz;
        cch = cChord;
        cch3 = cChord3;
      }
      const h = (x - px) / 2;
      vol += (pa + a) * h;
      mx += (px * pa + x * a) * h;
      my += (pay + ay) * h;
      mz += (paz + az) * h;
      ch += (pch + cch) * h;
      chx += (px * pch + x * cch) * h;
      chxx += (px * px * pch + x * x * cch) * h;
      cht += ((pch3 + cch3) * h) / 12;
      pa = a;
      pay = ay;
      paz = az;
      pch = cch;
      pch3 = cch3;
      px = x;
    }
  }
  out[R_VOL] = vol;
  out[R_MX] = mx;
  out[R_MY] = my;
  out[R_MZ] = mz;
  out[R_CH] = ch;
  out[R_CHX] = chx;
  out[R_CHXX] = chxx;
  out[R_CHT] = cht;
  // Strip quantities for damping and added mass: the submerged breadth s of
  // each station, normal to the ship's axis.
  let sw = 0;
  let swx = 0;
  let swxx = 0;
  let s2 = 0;
  let s2x = 0;
  let s2xx = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const dx = (xs[i + 1] - xs[i]) / 2;
    for (let e = 0; e < 2; e += 1) {
      const k = i + e;
      if (stState[k] === 0) continue;
      const full = 2 * s.hbMax[k];
      const b =
        stState[k] === 2
          ? full
          : max(stCh[k], s.fullA[k] > 0 ? (full * stA[k]) / s.fullA[k] : 0);
      const x = xs[k];
      if (breadths && e === 0) breadths[k] = b;
      sw += b * dx;
      swx += b * x * dx;
      swxx += b * x * x * dx;
      s2 += b * b * dx;
      s2x += b * b * x * dx;
      s2xx += b * b * x * x * dx;
    }
  }
  if (breadths) {
    if (stState[n - 1] === 0) breadths[n - 1] = 0;
    else
      breadths[n - 1] =
        stState[n - 1] === 2
          ? 2 * s.hbMax[n - 1]
          : max(
              stCh[n - 1],
              s.fullA[n - 1] > 0
                ? (2 * s.hbMax[n - 1] * stA[n - 1]) / s.fullA[n - 1]
                : 0
            );
    for (let i = 0; i < n - 1; i += 1) if (stState[i] === 0) breadths[i] = 0;
  }
  out[R_S] = sw;
  out[R_SX] = swx;
  out[R_SXX] = swxx;
  out[R_S2] = s2;
  out[R_S2X] = s2x;
  out[R_S2XX] = s2xx;
  if (areas) for (let i = 0; i < n; i += 1) areas[i] = stA[i];
}

/** Pose of a body: earth height of its origin, pitch (bow down +), roll. */
export interface Pose {
  heave: number;
  pitch: number;
  roll: number;
}

/**
 * Earth up in the ship frame for a pose. The ship-to-earth rotation is
 * Ry(pitch)·Rx(roll) (yaw fixed), so earth z = heave + n·p.
 */
export function upInShip(
  pitch: number,
  roll: number
): [number, number, number] {
  const cp = Math.cos(pitch);
  return [-Math.sin(pitch), cp * Math.sin(roll), cp * Math.cos(roll)];
}

export interface Hydrostatics {
  volume: number;
  /** Centre of buoyancy, ship frame. */
  cb: { x: number; y: number; z: number };
  /** Area of the cut through the hull at the sea surface. */
  waterplaneArea: number;
}

const buf = new Float64Array(R_SIZE);

/** Submerged volume of a slice in the sea at a pose (for tests and tools). */
export function hydrostatics(slice: Slice, pose: Pose): Hydrostatics {
  const [nx, ny, nz] = upInShip(pose.pitch, pose.roll);
  integrateSlice(slice, nx, ny, nz, pose.heave, buf);
  const v = buf[R_VOL];
  const cb = {
    x: v > 0 ? buf[R_MX] / v : 0,
    y: v > 0 ? buf[R_MY] / v : 0,
    z: v > 0 ? buf[R_MZ] / v : 0,
  };
  return { volume: v, cb, waterplaneArea: waterplaneArea(slice, pose) };
}

/**
 * The waterplane area: the chord integral over the cut, divided by how far
 * the plane leans from the sections; near vertical (where the cut runs along
 * the sections, not across them) it is dV/dheave instead.
 */
export function waterplaneArea(slice: Slice, pose: Pose): number {
  const [nx, ny, nz] = upInShip(pose.pitch, pose.roll);
  const lean = sqrt(max(0, 1 - nx * nx));
  if (lean > 0.3) {
    integrateSlice(slice, nx, ny, nz, pose.heave, buf);
    return buf[R_CH] / lean;
  }
  const dh = 0.25;
  integrateSlice(slice, nx, ny, nz, pose.heave - dh, buf);
  const v0 = buf[R_VOL];
  integrateSlice(slice, nx, ny, nz, pose.heave + dh, buf);
  return (v0 - buf[R_VOL]) / (2 * dh);
}
