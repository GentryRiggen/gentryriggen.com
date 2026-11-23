import type { SeabedSpec, ShipSpec } from "../ships/types";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, floor, max, min, sqrt } = Math;
const INF = Infinity;

/**
 * The sea floor near a coast (`ShipSpec.seabed`): its depth from how far
 * offshore a point is (a profile, linear between its points), lowered to
 * nothing past the shore and lifted by rock bumps. Earth frame: metres, x
 * along her heading at the first event, y to port, z up from the sea.
 * Pure and allocation-free: the sim's floor contact calls it per hull
 * point, and the scene's floor and the camera's clamp read the same floor.
 */

/**
 * Which shore segments can be nearest to a point: per square cell of
 * `CELL_M`, the segments whose distance from the cell's centre is within
 * the cell's diagonal of the nearest one's (any point of the cell is
 * within half a diagonal of the centre, so every other segment is
 * farther from it than the nearest of these). Built lazily per cell and
 * kept per seabed; in the polyline's order, so ties go as in a full scan.
 * Only the speed changes: the floor is looked up per hull point per step.
 */
const CELL_M = 25;
const CELL_SLACK_M = CELL_M * Math.SQRT2 + 1e-3;
const MAX_CELLS = 20000;
const cellCache = new WeakMap<SeabedSpec, Map<number, Int32Array>>();

/** Distance from x, y to segment i of the shore (any degenerate: ∞). */
function segmentDistance(
  pts: SeabedSpec["shore"],
  i: number,
  x: number,
  y: number
): number {
  const ax = pts[i][0];
  const ay = pts[i][1];
  const dx = pts[i + 1][0] - ax;
  const dy = pts[i + 1][1] - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return Infinity;
  const u = ((x - ax) * dx + (y - ay) * dy) / len2;
  const t = u < 0 ? 0 : u > 1 ? 1 : u;
  const px = x - (ax + t * dx);
  const py = y - (ay + t * dy);
  return sqrt(px * px + py * py);
}

function shoreCandidates(s: SeabedSpec, x: number, y: number): Int32Array {
  const pts = s.shore;
  const ns = pts.length - 1;
  const ix = floor(x / CELL_M);
  const iy = floor(y / CELL_M);
  let cells = cellCache.get(s);
  if (!cells) {
    cells = new Map();
    cellCache.set(s, cells);
  }
  // Unique for |ix|, |iy| < 2²⁰ cells (26,000 km); anything else (NaN,
  // ∞) scans every segment.
  const key =
    abs(ix) < 1048576 && abs(iy) < 1048576
      ? (ix + 1048576) * 2097152 + (iy + 1048576)
      : NaN;
  let c = key === key ? cells.get(key) : undefined;
  if (c) return c;
  const cx = (ix + 0.5) * CELL_M;
  const cy = (iy + 0.5) * CELL_M;
  const d = new Float64Array(ns);
  let best = Infinity;
  for (let i = 0; i < ns; i += 1) {
    d[i] = segmentDistance(pts, i, cx, cy);
    best = min(best, d[i]);
  }
  const keep: number[] = [];
  for (let i = 0; i < ns; i += 1)
    if (key !== key || d[i] <= best + CELL_SLACK_M) keep.push(i);
  c = Int32Array.from(keep);
  if (key === key) {
    if (cells.size >= MAX_CELLS) cells.clear();
    cells.set(key, c);
  }
  return c;
}

/**
 * Signed distance (m) from the shore polyline: + on its sea side
 * (`seaSide`), − on land. The nearest segment by projection; at a corner
 * the side comes from the two segments' normals together.
 */
export function shoreDistance(s: SeabedSpec, x: number, y: number): number {
  const pts = s.shore;
  const n = pts.length;
  if (n === 0) return Infinity;
  if (n === 1) return sqrt((x - pts[0][0]) ** 2 + (y - pts[0][1]) ** 2);
  const cand = shoreCandidates(s, x, y);
  let best = INF;
  let side = 1;
  for (let j = 0; j < cand.length; j += 1) {
    const i = cand[j];
    const ax = pts[i][0];
    const ay = pts[i][1];
    const dx = pts[i + 1][0] - ax;
    const dy = pts[i + 1][1] - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 0) continue;
    const u = ((x - ax) * dx + (y - ay) * dy) / len2;
    const t = u < 0 ? 0 : u > 1 ? 1 : u;
    const px = x - (ax + t * dx);
    const py = y - (ay + t * dy);
    const d = sqrt(px * px + py * py);
    if (d > best) continue;
    // Left of the segment's direction: + (cross product).
    let cross = dx * (y - ay) - dy * (x - ax);
    // At an inner corner, the corner's own side: both segments' normals.
    if (t === 1 && i < n - 2) {
      const ex = pts[i + 2][0] - pts[i + 1][0];
      const ey = pts[i + 2][1] - pts[i + 1][1];
      const l1 = sqrt(len2);
      const l2 = sqrt(ex * ex + ey * ey);
      if (l2 > 0) {
        // Left normals (−dy, dx) of each, summed.
        const nx = -dy / l1 - ey / l2;
        const ny = dx / l1 + ex / l2;
        cross = nx * px + ny * py;
      }
    } else if (t === 0 && i > 0) {
      const ex = ax - pts[i - 1][0];
      const ey = ay - pts[i - 1][1];
      const l1 = sqrt(len2);
      const l2 = sqrt(ex * ex + ey * ey);
      if (l2 > 0) {
        const nx = -dy / l1 - ey / l2;
        const ny = dx / l1 + ex / l2;
        cross = nx * px + ny * py;
      }
    }
    best = d;
    side = cross >= 0 ? 1 : -1;
  }
  return best * side * s.seaSide;
}

/** The profile's depth (m, + down) at `off` metres offshore (0 inshore of it). */
export function profileDepth(s: SeabedSpec, off: number): number {
  const p = s.profile;
  const n = p.length;
  if (n === 0) return 0;
  if (off <= p[0][0]) return p[0][1];
  for (let i = 1; i < n; i += 1) {
    if (off > p[i][0]) continue;
    const [xa, da] = p[i - 1];
    const [xb, db] = p[i];
    return xb > xa ? da + ((db - da) * (off - xa)) / (xb - xa) : db;
  }
  return p[n - 1][1];
}

/** The floor's depth (m, + down) at earth x, y. */
export function seabedDepth(s: SeabedSpec, x: number, y: number): number {
  let d = profileDepth(s, max(0, shoreDistance(s, x, y)));
  const rocks = s.rocks;
  if (rocks)
    for (let i = 0; i < rocks.length; i += 1) {
      const r = rocks[i];
      const q = ((x - r.x) ** 2 + (y - r.y) ** 2) / (r.radiusM * r.radiusM);
      if (q >= 1 || r.topDepthM >= d) continue;
      // The bump rises from the profile at its edge to its top at its centre.
      d = min(d, r.topDepthM + q * (d - r.topDepthM));
    }
  return d;
}

/**
 * Earth z of the floor (negative) at earth x, y: the seabed's, or
 * −seaDepthM everywhere without one.
 */
export function floorAt(spec: ShipSpec, x: number, y: number): number {
  return spec.seabed ? -seabedDepth(spec.seabed, x, y) : -spec.seaDepthM;
}

/**
 * The highest the floor comes (earth z) anywhere within `r` metres of x, y:
 * a bound for skipping the per-point lookup while a hull is clear of it.
 */
export function floorTopNear(
  spec: ShipSpec,
  x: number,
  y: number,
  r: number
): number {
  const s = spec.seabed;
  if (!s) return -spec.seaDepthM;
  const d = shoreDistance(s, x, y);
  const lo = max(0, d - r);
  const hi = max(0, d + r);
  let depth = min(profileDepth(s, lo), profileDepth(s, hi));
  for (const [off, dp] of s.profile)
    if (off > lo && off < hi) depth = min(depth, dp);
  const rocks = s.rocks;
  if (rocks)
    for (const k of rocks) {
      const reach = r + k.radiusM;
      if ((x - k.x) ** 2 + (y - k.y) ** 2 < reach * reach)
        depth = min(depth, k.topDepthM);
    }
  return -depth;
}

/**
 * A bound on how steeply the floor rises (m per m across, any direction)
 * anywhere within `reach` of earth x, y: the profile's steepest segment
 * (offshore distance changes no faster than position, as `floorTopNear`
 * also takes), plus for each rock bump that reach overlaps its rise from
 * the deepest profile to its top over its radius (inside a bump the depth
 * is top + q·(d − top), q = r²/R²: its slope is at most
 * q·|∇d| + (d − top)·|∇q| ≤ |∇d| + (deepest − top)·2/R; bumps that
 * overlap add up). Lets a hull point well above the floor skip the lookup
 * while it moves less than its clearance over this (body.ts `floorNear`).
 */
export function seabedSlopeNear(
  s: SeabedSpec,
  x: number,
  y: number,
  reach: number
): number {
  const p = s.profile;
  let l = 0;
  let deepest = 0;
  for (let i = 0; i < p.length; i += 1) {
    deepest = max(deepest, p[i][1]);
    if (i === 0 || p[i][1] === p[i - 1][1]) continue;
    // A step (two depths at one distance) is a cliff: no bound.
    if (p[i][0] <= p[i - 1][0]) return Infinity;
    l = max(l, abs(p[i][1] - p[i - 1][1]) / (p[i][0] - p[i - 1][0]));
  }
  const rocks = s.rocks;
  if (rocks)
    for (let i = 0; i < rocks.length; i += 1) {
      const r = rocks[i];
      const near = r.radiusM + reach;
      if ((x - r.x) ** 2 + (y - r.y) ** 2 >= near * near) continue;
      if (r.radiusM <= 0) continue; // never lifts the floor
      l += (2 * max(0, deepest - r.topDepthM)) / r.radiusM;
    }
  return l;
}
