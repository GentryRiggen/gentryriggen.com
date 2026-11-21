import {
  ADDED_MASS_COEF,
  AXIAL_ADDED_MASS,
  AXIAL_CD,
  DRAG_CD,
  GRAV,
  HEAVE_ZETA,
  PITCH_ZETA,
  PUMP_DEPTH_M,
  RHO,
  ROLL_ADDED,
  ROLL_GYRATION,
  ROLL_ZETA,
  VERTICAL_GYRATION,
} from "./constants";
import {
  type Cell,
  capSeaFlow,
  cellBounds,
  cellSea,
  seaInflow,
  solveLevel,
  spill,
} from "./flooding";
import {
  R_CH,
  R_CHT,
  R_CHX,
  R_CHXX,
  R_S2,
  R_S2X,
  R_S2XX,
} from "./hydrostatics";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, cos, max, min, sin, sqrt } = Math;

/**
 * A rigid floating body (the whole ship, or the bow or stern after the
 * breakup): heave and surge of its centre of mass in the earth's x–z plane,
 * pitch and roll, with weight = lightship + water at their centre and
 * buoyancy at the centre of buoyancy. Added mass and inertia come from strip
 * theory (ρ·π·s²/8 per metre of submerged breadth s); damping is linear
 * (a fraction of critical, from the waterplane's stiffness) plus quadratic
 * drag per station, all applied implicitly so a fixed step stays stable.
 *
 * Rotation ship → earth: Rz(yaw)·Ry(pitch)·Rx(roll); pitch + is bow down,
 * roll + lifts the port side (a list to starboard). Yaw stays 0 afloat.
 */

export type BodyPart = "whole" | "bow" | "stern";
export type BodyMode = "float" | "fall" | "landing" | "landed";

export interface Body {
  part: BodyPart;
  xFrom: number;
  xTo: number;
  /** Hull cells, aft to forward, then the superstructure boxes. */
  cells: Cell[];
  boxes: Cell[];
  /** cells then boxes (one list for the hot loops). */
  all: Cell[];
  /** Spill breadth at each bulkhead between cells[i] and cells[i+1] (0: none). */
  walls: number[];
  lightMass: number;
  lightCx: number;
  lightCy: number;
  lightCz: number;
  lightIyy: number;
  beam: number;
  depth: number;
  // Pose: earth position of the ship-frame origin, angles.
  x: number;
  y: number;
  z: number;
  pitch: number;
  roll: number;
  yaw: number;
  // Velocity of the centre of mass (earth) and angular rates.
  vx: number;
  vz: number;
  wp: number;
  wr: number;
  wy: number;
  // Centre of mass (ship frame) and total mass, last step.
  gx: number;
  gy: number;
  gz: number;
  mass: number;
  /** Last accelerations (normal to the axis, pitch) for the girder. */
  an: number;
  alpha: number;
  /** Sea inflow, m³/s, and the net change of water aboard (after the pumps). */
  inflow: number;
  netFlow: number;
  mode: BodyMode;
  /** Highest / lowest earth z of the body (hull and boxes). */
  top: number;
  bottom: number;
  /** Afloat and still for this long (s); frozen once steady. */
  steadyFor: number;
  frozen: boolean;
  /** Landing: the first point to touch (ship frame), where it touched
   * (earth), when, the pitch then, and the pitch it settles to. */
  contactP: [number, number, number];
  contactE: [number, number, number];
  contactT: number;
  contactPitch: number;
  restPitch: number;
}

/** Earth up in the ship frame. */
export function upOf(b: Body): [number, number, number] {
  const cp = cos(b.pitch);
  return [-sin(b.pitch), cp * sin(b.roll), cp * cos(b.roll)];
}

/** Earth z of a ship-frame point of the body (yaw does not change z). */
export function earthZ(b: Body, x: number, y: number, z: number): number {
  const [nx, ny, nz] = upOf(b);
  return b.z + nx * x + ny * y + nz * z;
}

/** Ship-frame vector rotated to earth (no yaw). */
export function rotate(
  pitch: number,
  roll: number,
  px: number,
  py: number,
  pz: number
): [number, number, number] {
  const c = cos(pitch);
  const s = sin(pitch);
  const cr = cos(roll);
  const sr = sin(roll);
  return [
    c * px + s * sr * py + s * cr * pz,
    cr * py - sr * pz,
    -s * px + c * sr * py + c * cr * pz,
  ];
}

/** Ship-frame vector rotated to earth with yaw: Rz(yaw)·Ry(pitch)·Rx(roll). */
export function rotateYaw(
  yaw: number,
  pitch: number,
  roll: number,
  px: number,
  py: number,
  pz: number
): [number, number, number] {
  const [x, y, z] = rotate(pitch, roll, px, py, pz);
  const c = cos(yaw);
  const s = sin(yaw);
  return [c * x - s * y, s * x + c * y, z];
}

/**
 * Turn the body to new angles about the ship-frame point p (its centre of
 * mass, or a point stuck in the mud), which ends at earth position e.
 */
export function placeAbout(
  b: Body,
  p: readonly [number, number, number],
  e: readonly [number, number, number]
): void {
  const r = rotateYaw(b.yaw, b.pitch, b.roll, p[0], p[1], p[2]);
  b.x = e[0] - r[0];
  b.y = e[1] - r[1];
  b.z = e[2] - r[2];
}

/** Earth position of a ship-frame point of the body (with yaw). */
export function earthOf(
  b: Body,
  px: number,
  py: number,
  pz: number
): [number, number, number] {
  const r = rotateYaw(b.yaw, b.pitch, b.roll, px, py, pz);
  return [b.x + r[0], b.y + r[1], b.z + r[2]];
}

/** Update top/bottom and the cells' earth bounds. */
export function updateBounds(b: Body): void {
  const [nx, ny, nz] = upOf(b);
  let top = -Infinity;
  let bottom = Infinity;
  for (const c of b.cells) {
    cellBounds(c, nx, ny, nz, b.z);
    top = max(top, c.zMax);
    bottom = min(bottom, c.zMin);
  }
  for (const c of b.boxes) {
    cellBounds(c, nx, ny, nz, b.z);
    top = max(top, c.zMax);
  }
  b.top = top;
  b.bottom = bottom;
}

/** Total flood water aboard, m³. */
export function waterOf(b: Body): number {
  let w = 0;
  for (const c of b.cells) w += c.water;
  for (const c of b.boxes) w += c.water;
  return w;
}

let dwBuf = new Float64Array(32);

/** Mass properties from the lightship and the water (ship frame). */
function massProps(b: Body): { ip: number } {
  let m = b.lightMass;
  let mx = b.lightMass * b.lightCx;
  let my = b.lightMass * b.lightCy;
  let mz = b.lightMass * b.lightCz;
  for (const c of b.all) {
    if (c.water <= 0) continue;
    const w = RHO * c.water;
    m += w;
    mx += w * c.wx;
    // Cabins and corridors cut the superstructure up: its water cannot
    // run across the ship.
    my += c.box ? 0 : w * c.wy;
    mz += w * c.wz;
  }
  b.mass = m;
  b.gx = mx / m;
  b.gy = my / m;
  b.gz = mz / m;
  let ip =
    b.lightIyy +
    b.lightMass * (b.lightCx - b.gx) * (b.lightCx - b.gx) +
    m * (VERTICAL_GYRATION * b.depth) ** 2;
  for (const c of b.all) {
    if (c.water <= 0) continue;
    const w = RHO * c.water;
    const len = c.slice.xTo - c.slice.xFrom;
    ip += w * ((c.wx - b.gx) ** 2 + (len * len) / 12);
  }
  return { ip };
}

/**
 * One fixed step of a floating body: hydrostatics at the current pose, the
 * water's levels, the flows (applied), then the motion. `areas` asks the
 * cells to keep per-station areas for the girder.
 */
export function stepFloat(
  b: Body,
  dt: number,
  areas: boolean,
  drift: number,
  pumps = 0
): void {
  const [nx, ny, nz] = upOf(b);
  updateBounds(b);
  // Buoyancy of every envelope (hull cells and boxes).
  let vol = 0;
  let bmx = 0;
  let bmy = 0;
  let bmz = 0;
  let ch = 0;
  let chx = 0;
  let chxx = 0;
  let cht = 0;
  let s2 = 0;
  let s2x = 0;
  let s2xx = 0;
  let front = 0;
  for (const c of b.all) {
    cellSea(c, nx, ny, nz, b.z, true);
    vol += c.seaVol;
    bmx += c.seaMx;
    bmy += c.seaMy;
    bmz += c.seaMz;
    const o = c.seaCut;
    ch += o[R_CH];
    chx += o[R_CHX];
    chxx += o[R_CHXX];
    cht += o[R_CHT];
    s2 += o[R_S2];
    s2x += o[R_S2X];
    s2xx += o[R_S2XX];
    if (!c.box)
      for (let i = 0; i < c.slice.n; i += 1) front = max(front, c.seaArea[i]);
  }
  // Water surfaces.
  for (const c of b.all) solveLevel(c, nx, ny, nz, b.z, areas);
  const { ip } = massProps(b);

  // Flows at this pose.
  let inflow = 0;
  const all = b.all;
  if (dwBuf.length < all.length) dwBuf = new Float64Array(all.length * 2);
  const dw = dwBuf;
  for (let i = 0; i < all.length; i += 1) {
    const c = all[i];
    const q = capSeaFlow(c, seaInflow(c, nx, ny, nz, b.z), dt);
    c.inflow = q;
    inflow += q;
    dw[i] = q * dt;
  }
  for (let i = 0; i < b.cells.length - 1; i += 1) {
    const breadth = b.walls[i];
    if (breadth <= 0) continue;
    const a = b.cells[i];
    const c = b.cells[i + 1];
    const q = spill(a, c, a.slice.xTo, a.fwdTopZ, breadth, nx, nz, b.z, dt);
    dw[i] -= q * dt;
    dw[i + 1] += q * dt;
  }
  // Pumps, aftmost machinery space first, while the water there is shallow.
  let pumpLeft = pumps * dt;
  for (let i = 0; i < b.cells.length && pumpLeft > 0; i += 1) {
    const c = b.cells[i];
    if (!c.pumped || c.water <= 0 || c.level - c.zMin > PUMP_DEPTH_M) continue;
    const take = min(pumpLeft, c.water + dw[i]);
    if (take <= 0) continue;
    dw[i] -= take;
    pumpLeft -= take;
  }
  let before = 0;
  let after = 0;
  for (let i = 0; i < all.length; i += 1) {
    const c = all[i];
    before += c.water;
    c.water = min(c.cap, max(0, c.water + dw[i]));
    after += c.water;
  }
  b.inflow = inflow;
  b.netFlow = (after - before) / dt;

  // Forces and moments about G.
  const c = cos(b.pitch);
  const s = sin(b.pitch);
  const bx = vol > 0 ? bmx / vol : b.gx;
  const by = vol > 0 ? bmy / vol : b.gy;
  const bz = vol > 0 ? bmz / vol : b.gz;
  const r = rotate(b.pitch, b.roll, bx - b.gx, by - b.gy, bz - b.gz);
  const fb = RHO * GRAV * vol;
  const fz = fb - b.mass * GRAV;
  const tauP = -r[0] * fb;
  const tauR = r[1] * fb * c;

  const lean = sqrt(max(0, 1 - nx * nx));
  const strip = ADDED_MASS_COEF * RHO * (Math.PI / 8);
  const gx = b.gx;
  const mn = b.mass + strip * s2;
  const mt = b.mass + AXIAL_ADDED_MASS * RHO * vol;
  const ipe = ip + strip * max(0, s2xx - 2 * gx * s2x + gx * gx * s2);
  const ir = b.mass * (ROLL_GYRATION * b.beam) ** 2 * (1 + ROLL_ADDED);

  // Linear damping from the waterplane's stiffness.
  const awp = lean > 0.3 ? ch / lean : 0;
  const il = lean > 0.3 ? max(0, chxx - 2 * gx * chx + gx * gx * ch) / lean : 0;
  const cn0 = 2 * HEAVE_ZETA * sqrt(RHO * GRAV * awp * mn);
  const cp0 = 2 * PITCH_ZETA * sqrt(RHO * GRAV * il * ipe);
  const cr0 = 2 * ROLL_ZETA * sqrt(RHO * GRAV * max(0, cht) * ir);

  // Quadratic drag normal to the axis, per station, linearised.
  const vn = b.vx * s + b.vz * c;
  const vt = b.vx * c - b.vz * s;
  let cnn = cn0;
  let cnp = 0;
  let cpp = cp0;
  const half = 0.5 * RHO * DRAG_CD;
  for (const cell of b.all) {
    const sl = cell.slice;
    for (let i = 0; i < sl.n; i += 1) {
      const br = cell.seaBreadth[i];
      if (br <= 0) continue;
      const dx =
        ((i < sl.n - 1 ? sl.xs[i + 1] : sl.xs[i]) -
          (i > 0 ? sl.xs[i - 1] : sl.xs[i])) /
        2;
      const arm = sl.xs[i] - gx;
      const v = vn - b.wp * arm;
      const k = half * br * abs(v) * dx;
      cnn += k;
      cnp += k * arm;
      cpp += k * arm * arm;
    }
  }
  // Implicit 2×2 solve for (vn, wp):
  //   (mn + cnn·dt) vn' - cnp·dt wp' = mn·vn + fn·dt
  //   -cnp·dt vn' + (ipe + cpp·dt) wp' = ipe·wp + τ·dt
  const fn = fz * c;
  const ft = -fz * s;
  const a11 = mn + cnn * dt;
  const a12 = -cnp * dt;
  const a22 = ipe + cpp * dt;
  const r1 = mn * vn + fn * dt;
  const r2 = ipe * b.wp + tauP * dt;
  const det = a11 * a22 - a12 * a12;
  const vn2 = (r1 * a22 - a12 * r2) / det;
  const wp2 = (a11 * r2 - a12 * r1) / det;
  const ct = 0.5 * RHO * AXIAL_CD * front * abs(vt);
  const vt2 = (mt * vt + ft * dt) / (mt + ct * dt);
  const wr2 = (ir * b.wr + tauR * dt) / (ir + cr0 * dt);
  b.an = (vn2 - vn) / dt;
  b.alpha = (wp2 - b.wp) / dt;
  b.vx = vn2 * s + vt2 * c;
  b.vz = vn2 * c - vt2 * s;
  b.wp = wp2;
  b.wr = wr2;

  // Move the centre of mass, turn about it, and place the origin.
  const g0 = rotate(b.pitch, b.roll, b.gx, b.gy, b.gz);
  const gex = b.x + g0[0] + b.vx * dt;
  const gey = b.y + g0[1] + drift * dt;
  const gez = b.z + g0[2] + b.vz * dt;
  b.pitch += b.wp * dt;
  b.roll += b.wr * dt;
  const g1 = rotate(b.pitch, b.roll, b.gx, b.gy, b.gz);
  b.x = gex - g1[0];
  b.y = gey - g1[1];
  b.z = gez - g1[2];
}
