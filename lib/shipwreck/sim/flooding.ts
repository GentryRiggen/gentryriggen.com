import {
  BOX_FLOOD_M2_PER_M,
  CD_OPENING,
  DOWNFLOOD_M2_PER_M,
  FLOW_CAP,
  GRAV,
  HEAD_EPS,
  SPILL_BREADTH,
  VENT_BURST_M,
  VENT_BURST_M2,
  WEIR_CW,
} from "./constants";
import type { Slice } from "./geometry";
import {
  R_CH,
  R_MX,
  R_MY,
  R_MZ,
  R_SIZE,
  R_VOL,
  integrateSlice,
} from "./hydrostatics";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, max, min, pow, sqrt } = Math;

/**
 * Flooding. Each cell (a watertight compartment, part of one after the
 * breakup, or a superstructure box) holds a volume of water whose surface is
 * a level earth plane, found by solving volume(level) inside the cell's own
 * clipped sections. Water moves by:
 *
 * - openings to the sea: q = Cd·A·√(2g·Δh), Δh the sea's head over each
 *   strip of the opening less the water's head inside;
 * - spilling over a bulkhead top into the neighbour: q = Cw·b·h^1.5
 *   (Villemonte's drowned-weir factor once the far side is above the top);
 * - downflooding: once the sea is over the deck edge (the sheer) of a cell,
 *   it pours in through hatches, doors and portholes, DOWNFLOOD_M2_PER_M of
 *   open area per metre of deck edge under water (both sides);
 * - a superstructure box fills the same way over its lower edge, and while
 *   it is still dry it is buoyant;
 * - across a longitudinal bulkhead (wing bunker to the space beside it):
 *   the orifice law through the cells' cross-flow area, both directions.
 *
 * A wing or centre cell (a compartment with a `span`) is its share of each
 * section. The deck edge belongs to the centre cell (hatches and stairways
 * lead down into the main space, not into the bunkers beside it); a wing's
 * deck corner only counts toward the burst vents.
 */

export interface CellOpening {
  x: number;
  y: number;
  zLow: number;
  zHigh: number;
  area: number;
}

export interface Cell {
  /** Index of the original compartment, or -1 for a superstructure box. */
  comp: number;
  box: boolean;
  slice: Slice;
  /** Ship-frame tops of the bulkheads at its ends (spill heights). */
  aftTopZ: number;
  fwdTopZ: number;
  /** Is there a watertight bulkhead at that end (false at a break or the hull's end)? */
  aftWall: boolean;
  fwdWall: boolean;
  openings: CellOpening[];
  /** Can the pumps work this space (machinery)? */
  pumped: boolean;
  /** Permeability: the share of the space water can fill; and so its capacity. */
  perm: number;
  cap: number;
  water: number;
  /** Earth height of the water surface (valid while 0 < water < capacity). */
  level: number;
  /** Water centroid, ship frame, and free-surface area (last solve). */
  wx: number;
  wy: number;
  wz: number;
  fsArea: number;
  /** Lowest and highest earth z of the cell at the current pose. */
  zMin: number;
  zMax: number;
  /** Sea clip of the envelope at the current pose. */
  seaVol: number;
  seaMx: number;
  seaMy: number;
  seaMz: number;
  /** Cut through the envelope at the sea (see R_CH..R_CHT) and the strips. */
  seaCut: Float64Array;
  /** Per-station submerged breadth (drag, added mass). */
  seaBreadth: Float64Array;
  /** Per-station submerged area (sea) and water area, for the girder. */
  seaArea: Float64Array;
  waterArea: Float64Array;
  /** Floor area used while (nearly) empty. */
  footprint: number;
  /** Net inflow this step, m³/s (for the steady test and the HUD). */
  inflow: number;
  /** Open area to the cell(s) beside it across a longitudinal bulkhead, m². */
  cross: number;
}

export function makeCell(
  slice: Slice,
  comp: number,
  box: boolean,
  aftTopZ: number,
  fwdTopZ: number,
  aftWall: boolean,
  fwdWall: boolean,
  perm: number,
  cross = 0
): Cell {
  let footprint = 0;
  const width = slice.width;
  if (width)
    // A wing or centre: its own breadth (it is not symmetric about y = 0).
    for (let i = 0; i < slice.n - 1; i += 1)
      footprint +=
        ((width[i] + width[i + 1]) / 2) * (slice.xs[i + 1] - slice.xs[i]);
  else
    for (let i = 0; i < slice.n - 1; i += 1)
      footprint +=
        (slice.hbMax[i] + slice.hbMax[i + 1]) * (slice.xs[i + 1] - slice.xs[i]);
  return {
    comp,
    box,
    slice,
    aftTopZ,
    fwdTopZ,
    aftWall,
    fwdWall,
    openings: [],
    pumped: false,
    perm,
    cap: slice.capacity * perm,
    water: 0,
    level: -Infinity,
    wx: slice.cx,
    wy: 0,
    wz: slice.cz,
    fsArea: 0,
    zMin: 0,
    zMax: 0,
    seaVol: 0,
    seaMx: 0,
    seaMy: 0,
    seaMz: 0,
    seaCut: new Float64Array(R_SIZE),
    seaBreadth: new Float64Array(slice.n),
    seaArea: new Float64Array(slice.n),
    waterArea: new Float64Array(slice.n),
    footprint: max(1, footprint * 0.8),
    inflow: 0,
    cross,
  };
}

const buf = new Float64Array(R_SIZE);

/** Earth z range of the cell's stations at the pose (n = up in ship). */
export function cellBounds(
  c: Cell,
  nx: number,
  ny: number,
  nz: number,
  z0: number
): void {
  const s = c.slice;
  let lo = Infinity;
  let hi = -Infinity;
  const ay = abs(ny);
  for (let i = 0; i < s.n; i += 1) {
    const base = z0 + nx * s.xs[i];
    const a = nz * s.zLo[i];
    const b = nz * s.zHi[i];
    const h = ay * s.hbMax[i];
    lo = min(lo, base + min(a, b) - h);
    hi = max(hi, base + max(a, b) + h);
  }
  c.zMin = lo;
  c.zMax = hi;
}

/** Clip the cell's envelope by the sea. */
export function cellSea(
  c: Cell,
  nx: number,
  ny: number,
  nz: number,
  z0: number,
  areas: boolean
): void {
  const out = c.seaCut;
  integrateSlice(
    c.slice,
    nx,
    ny,
    nz,
    z0,
    out,
    areas ? c.seaArea : undefined,
    c.seaBreadth
  );
  c.seaVol = out[R_VOL];
  c.seaMx = out[R_MX];
  c.seaMy = out[R_MY];
  c.seaMz = out[R_MZ];
}

/** The level that holds the cell's water, its centroid and free surface. */
export function solveLevel(
  c: Cell,
  nx: number,
  ny: number,
  nz: number,
  z0: number,
  areas: boolean
): void {
  const s = c.slice;
  const cap = s.capacity;
  const lean = sqrt(max(0, 1 - nx * nx));
  if (c.water <= 1e-6) {
    c.water = 0;
    c.level = c.zMin;
    c.wx = s.cx;
    c.wy = 0;
    c.wz = s.zLo[0];
    c.fsArea = c.footprint * c.perm;
    if (areas) c.waterArea.fill(0);
    return;
  }
  if (c.water >= c.cap * (1 - 1e-9)) {
    c.water = c.cap;
    c.level = c.zMax;
    c.wx = s.cx;
    c.wy = s.cy;
    c.wz = s.cz;
    c.fsArea = 0;
    if (areas)
      for (let i = 0; i < s.n; i += 1) c.waterArea[i] = s.fullA[i] * c.perm;
    return;
  }
  // The space the water fills is water / permeability.
  const target = c.water / c.perm;
  const tol = max(0.2, cap * 2e-4);
  let lo = c.zMin;
  let hi = c.zMax;
  let vLo = 0;
  let vHi = cap;
  let level = c.level > lo && c.level < hi ? c.level : lo + (hi - lo) * 0.3;
  let v = 0;
  let area = 0;
  for (let it = 0; it < 30; it += 1) {
    integrateSlice(
      s,
      nx,
      ny,
      nz,
      z0 - level,
      buf,
      areas ? c.waterArea : undefined
    );
    v = buf[R_VOL];
    area = lean > 0.3 ? buf[R_CH] / lean : 0;
    if (abs(v - target) < tol) break;
    if (v < target) {
      lo = level;
      vLo = v;
    } else {
      hi = level;
      vHi = v;
    }
    let next = area > 1 ? level + (target - v) / area : Number.NaN;
    if (!(next > lo && next < hi)) {
      // Secant on the bracket, then bisection.
      next =
        vHi > vLo
          ? lo + ((target - vLo) / (vHi - vLo)) * (hi - lo)
          : (lo + hi) / 2;
      if (!(next > lo && next < hi) || it > 12) next = (lo + hi) / 2;
    }
    level = next;
  }
  c.level = level;
  if (v > 1e-6) {
    c.wx = buf[R_MX] / v;
    c.wy = buf[R_MY] / v;
    c.wz = buf[R_MZ] / v;
  }
  if (areas) for (let i = 0; i < s.n; i += 1) c.waterArea[i] *= c.perm;
  // Free surface as water volume per metre of level.
  c.fsArea = max(area, min(c.footprint, 50)) * c.perm;
}

/**
 * The head that drives water out of a cell: its surface, or for a full cell
 * the sea's pressure (its deck is open) or its top if that is above the sea.
 */
export function headLevel(c: Cell): number {
  if (c.water <= 0) return -Infinity;
  if (c.water >= c.cap) return max(0, c.zMax);
  return c.level;
}

function orifice(area: number, dh: number): number {
  const a = abs(dh);
  const q =
    a < HEAD_EPS
      ? CD_OPENING * area * sqrt(2 * GRAV * HEAD_EPS) * (a / HEAD_EPS)
      : CD_OPENING * area * sqrt(2 * GRAV * a);
  return dh >= 0 ? q : -q;
}

/** Room left below the sea (m³) before the cell's surface reaches z = 0. */
function roomToSea(c: Cell): number {
  if (c.water >= c.cap) return 0;
  const surface = c.water > 0 ? c.level : c.zMin;
  return max(0, -surface) * max(c.fsArea, 1);
}

/**
 * Sea inflow (m³/s, + in) through a cell's openings, its deck edge and, for
 * a box, its lower edge, at the pose (earth z = z0 + n·p).
 */
export function seaInflow(
  c: Cell,
  nx: number,
  ny: number,
  nz: number,
  z0: number
): number {
  const full = c.water >= c.cap;
  const inside = full ? headLevel(c) : c.water > 0 ? c.level : -Infinity;
  let q = 0;
  // Openings, in four strips each.
  for (const o of c.openings) {
    const strip = o.area / 4;
    for (let k = 0; k < 4; k += 1) {
      const z = o.zLow + ((o.zHigh - o.zLow) * (k + 0.5)) / 4;
      const ze = z0 + nx * o.x + ny * o.y + nz * z;
      const hs = max(0, -ze);
      const hi = max(0, inside - ze);
      if (hs <= 0 && hi <= 0) continue;
      q += orifice(strip, hs - hi);
    }
  }
  // The deck edge (hull cells) or the lower edge (boxes): sections' corner
  // vertices. Hull sections: port top is vertex nl-1, starboard top nl.
  // A centre cell takes the hull's own deck edges; a wing takes none.
  const s = c.slice;
  const nv = s.nv;
  const perM = c.box ? BOX_FLOOD_M2_PER_M : DOWNFLOOD_M2_PER_M;
  const iPort = c.box ? 0 : nv / 2 - 1;
  const iStbd = c.box ? nv - 1 : nv / 2;
  const span = s.span;
  const edge = span && span.side === "centre" ? s.edgeHb : undefined;
  const wing = span !== undefined && span.side !== "centre";
  let deepest = 0;
  for (let i = 0; i < s.n; i += 1) {
    const dx =
      ((i < s.n - 1 ? s.xs[i + 1] : s.xs[i]) -
        (i > 0 ? s.xs[i - 1] : s.xs[i])) /
      2;
    if (dx <= 0 || s.fullA[i] <= 0) continue;
    const base = z0 + nx * s.xs[i];
    for (let side = 0; side < 2; side += 1) {
      const v = i * nv + (side === 0 ? iPort : iStbd);
      const y = edge ? (side === 0 ? edge[i] : -edge[i]) : s.ys[v];
      const ze = base + ny * y + nz * s.zs[v];
      if (ze >= 0) continue;
      deepest = min(deepest, ze);
      if (wing) continue;
      const hi = max(0, inside - ze);
      q += orifice(perM * dx, -ze - hi);
    }
  }
  // Deep under, the pressure bursts the vents, skylights and hatch covers
  // that still held the air in: a large opening at the deepest deck point.
  if (deepest < -VENT_BURST_M) {
    const hi = max(0, inside - deepest);
    q += orifice(VENT_BURST_M2, -deepest - hi);
  }
  return q;
}

/** Cap a sea inflow so one step cannot overfill past the sea level. */
export function capSeaFlow(c: Cell, q: number, dt: number): number {
  if (q > 0) {
    const left = c.cap - c.water;
    // While the sea is over the whole cell it may fill to the brim;
    // otherwise one step may only close part of the gap to the sea level.
    const limit = c.zMax < 0 ? left : min(left, roomToSea(c) * FLOW_CAP);
    return min(q, max(0, limit) / dt);
  }
  return max(q, -c.water / dt);
}

/**
 * Spill between two neighbouring cells over the bulkhead top between them
 * at ship-frame (xb, topZ), breadth `breadth` (m). Returns m³/s from a to b.
 */
export function spill(
  a: Cell,
  b: Cell,
  xb: number,
  topZ: number,
  breadth: number,
  nx: number,
  nz: number,
  z0: number,
  dt: number,
  ny = 0,
  yb = 0
): number {
  let zt = z0 + nx * xb + nz * topZ;
  if (yb !== 0) zt += ny * yb;
  const ha = headLevel(a);
  const hb = headLevel(b);
  if (ha <= zt && hb <= zt) return 0;
  const up = ha >= hb ? a : b;
  const down = up === a ? b : a;
  const hUp = up === a ? ha : hb;
  const hDown = up === a ? hb : ha;
  const h1 = hUp - zt;
  const h2 = max(0, hDown - zt);
  if (h1 <= 0 || down.water >= down.cap) return 0;
  const r = h2 / h1;
  const drown = r > 0 ? pow(max(0, 1 - pow(r, 1.5)), 0.385) : 1;
  let q = WEIR_CW * SPILL_BREADTH * breadth * pow(h1, 1.5) * drown;
  // One step may not more than half-equalise the two sides.
  const downSurface = down.water > 0 ? down.level : down.zMin;
  const dh = hUp - max(downSurface, zt);
  const aUp = max(up.fsArea, 1);
  const aDown = max(down.fsArea, 1);
  const eq = (dh * aUp * aDown) / (aUp + aDown);
  const limit = min(max(0, eq) * FLOW_CAP, up.water, down.cap - down.water);
  q = min(q, limit / dt);
  return up === a ? q : -q;
}

/**
 * Flow across a longitudinal bulkhead between two cells side by side (a
 * wing bunker and the space beside it) through `area` m² of coal doors and
 * leaks low on the bulkhead at ship-frame (xd, yd, zd): q = Cd·A·√(2g·Δh),
 * Δh the higher surface less the lower one (or the door, if that is
 * higher). Capped like a spill: one step may only half-equalise the two.
 * Returns m³/s from a to b.
 */
export function crossFlow(
  a: Cell,
  b: Cell,
  area: number,
  xd: number,
  yd: number,
  zd: number,
  nx: number,
  ny: number,
  nz: number,
  z0: number,
  dt: number
): number {
  const ha = headLevel(a);
  const hb = headLevel(b);
  if (ha === hb) return 0;
  const up = ha > hb ? a : b;
  const down = up === a ? b : a;
  const hUp = up === a ? ha : hb;
  const zDoor = z0 + nx * xd + ny * yd + nz * zd;
  if (hUp <= zDoor || down.water >= down.cap) return 0;
  const downSurface = down.water > 0 ? down.level : down.zMin;
  const dh = hUp - max(downSurface, zDoor);
  if (dh <= 0) return 0;
  let q = orifice(area, dh);
  const aUp = max(up.fsArea, 1);
  const aDown = max(down.fsArea, 1);
  const eq = (dh * aUp * aDown) / (aUp + aDown);
  const limit = min(max(0, eq) * FLOW_CAP, up.water, down.cap - down.water);
  q = min(q, limit / dt);
  return up === a ? q : -q;
}
