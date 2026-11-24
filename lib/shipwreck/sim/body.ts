import {
  ADDED_MASS_COEF,
  AXIAL_ADDED_MASS,
  AXIAL_CD,
  DRAG_CD,
  FLOOR_DAMP_S,
  FLOOR_FRICTION,
  FLOOR_SLIP_MS,
  FLOW_CAP,
  GRAV,
  HEAVE_ZETA,
  PITCH_ZETA,
  P_ATM,
  PUMP_DEPTH_M,
  ROLL_ADDED,
  ROLL_GYRATION,
  ROLL_ZETA,
  VERTICAL_GYRATION,
} from "./constants";
import { airHeadM, cellSealed, gasOutflow } from "./air";
import { type DeckWater, deckFlows } from "./deckWater";
import { type DoorLink, doorFlow } from "./doors";
import { STEADY_AVG_S } from "./events";
import {
  type AirStep,
  type Cell,
  type DeckSea,
  capAirFlow,
  capSeaFlow,
  cellBounds,
  cellSea,
  crossFlow,
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
 * roll + lifts the port side (a list to starboard). Afloat, yaw is her
 * heading (`headway.turn`, 1.4; else 0): pose and position only, the
 * physics sees a straight course (her surge along it).
 */

export type BodyPart = "whole" | "bow" | "stern";
export type BodyMode = "float" | "fall" | "landing" | "landed";

/** Water spilling over a bulkhead top between cells[a] (aft) and cells[b]. */
export interface SpillLink {
  a: number;
  b: number;
  /** Ship frame: the bulkhead's x, its top, and the middle of the shared breadth. */
  x: number;
  topZ: number;
  y: number;
  /** Breadth the two cells share at the top (m). */
  breadth: number;
}

/** Cells side by side across a longitudinal bulkhead (coal doors). */
export interface CrossLink {
  a: number;
  b: number;
  area: number;
  /** Ship frame: the doors, low on the bulkhead. */
  x: number;
  y: number;
  z: number;
}

export interface Body {
  part: BodyPart;
  xFrom: number;
  xTo: number;
  /** Hull cells, aft to forward, then the superstructure boxes. */
  cells: Cell[];
  boxes: Cell[];
  /** cells then boxes (one list for the hot loops). */
  all: Cell[];
  /** Where water can spill over a bulkhead top from one cell to the next. */
  links: SpillLink[];
  /** Cells side by side, joined through a longitudinal bulkhead. */
  crosses: CrossLink[];
  /**
   * Full-breadth stand-ins for each run of wing and centre cells: the cut
   * quantities that do not add across a longitudinal bulkhead (waterplane
   * inertia, added mass, the axial front) come from these instead.
   */
  cuts: Cell[];
  lightMass: number;
  lightCx: number;
  lightCy: number;
  lightCz: number;
  lightIyy: number;
  beam: number;
  depth: number;
  /** Density of the water she floats in and floods with (kg/m³). */
  rho: number;
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
  /** netFlow averaged over the last STEADY_AVG_S or so (Infinity: none yet). */
  flowAvg: number;
  mode: BodyMode;
  /** Highest / lowest earth z of the body (hull and boxes). */
  top: number;
  bottom: number;
  /** Her wreck's rest rule in radians (`spec.wreck`), or null (1.0). */
  wreck: { rest: number; min: number } | null;
  /** A wave ship's whole hull once `capsized` has fired: its dive keeps
   *  her keel up even if she rolled off her keel as she went under
   *  (`descent.ts`, `keelUpDive`). */
  capsized: boolean;
  /** Her keel went under while `capsized` (a rule): from then her roll is
   *  eased keel up (run.ts `stepKeelUnder`). */
  keelUnder: boolean;
  /** A stern part that rolls over as it falls (`wreckParts.stern`): the
   *  roll it lands at (radians, magnitude), or null. */
  capsize: number | null;
  /** Its roll rate (rad/s) while it capsizes. */
  capsizeRate: number;
  /** Afloat and still for this long (s); frozen once steady. */
  steadyFor: number;
  frozen: boolean;
  /** The settled test's window (`STEADY_POSE_S`): when it began and the
   *  pose's range since (pitch and roll in radians, z in m). */
  poseBox?: {
    t: number;
    lo: [number, number, number];
    hi: [number, number, number];
  };
  /** Landing: the first point to touch (ship frame), where it touched
   * (earth), when, the pitch then, and the pitch it settles to. */
  contactP: [number, number, number];
  contactE: [number, number, number];
  contactT: number;
  contactPitch: number;
  restPitch: number;
  restRoll: number;
  /** How deep the contact already was when it landed afloat (m). */
  contactD0: number;
  /** Landed from afloat (grounded when she went under): no further plough,
   * and her lowest hull point kept at that depth in the mud as she turns. */
  seated: boolean;
  /** A whole hull that touched the floor with its after half first (a
   * stern-first plunge in water shallower than she is long): it settles
   * as a stern does, along the floor, not nose down about its stern. */
  sternFirst: boolean;
  /** `spec.pivotDrag` (R22): landing on its bow, it swings down about the
   *  contact no faster than `pivotRate` (descent.ts). */
  pivotDrag: boolean;
  /** Hull vertices for the floor while afloat: x, y, z, length (m) each. */
  floorPts: Float64Array;
  /** Floor stiffness per metre of hull per vertex (N/m per m). */
  floorK: number;
  /** Touching the floor this step (afloat), and which end touched. */
  grounded: boolean;
  touchBow: boolean;
  touchStern: boolean;
  /** This step's floor forces (N, earth up) and where (ship-frame x). */
  floorN: number;
  floorX: Float64Array;
  floorF: Float64Array;
  /** Green water on her open deck (the whole hull afloat), or null. */
  deckWater: DeckWater | null;
  /** Watertight doors open between its cells (1.4); missing: none. */
  doors?: DoorLink[];
  /** The ram head this step (m, Cp·u²/2g) on its `ram` openings; missing: 0. */
  ramHead?: number;
  /** `spec.boxWaterAtSide`: its boxes' water weighs at its own y. */
  boxWaterAtSide?: boolean;
  /**
   * The floor under an earth x, y (`spec.seabed`'s `floorAt`): the floor
   * contact looks it up under each hull point. Missing: the flat floor.
   */
  floorFn?: FloorFn;
  /** Farthest any hull vertex is from the origin (m), for the floor bound. */
  floorReach?: number;
  /** With `floorFn`: a bound on the floor's slope within `FLOOR_MEMO_M`
   *  of an earth x, y (seabed.ts `seabedSlopeNear`), for `floorNear`. */
  floorSlope?: FloorFn;
  /** `floorNear`'s memo: per `floorPts` vertex the earth x, y, floor z
   *  and slope bound of its last lookup. */
  floorMemo?: Float64Array;
  /** A mass held in her (`spec.heel.rock`, from its time): kg, ship frame. */
  rock?: { m: number; x: number; y: number; z: number };
  /** Her earth x, y held once her way is lost on the floor (`seabed` or a
   *  drift path: no sway, no slide), or missing. */
  hold?: { x: number; y: number };
  /** The rest aground (`spec.aground`), once it has begun. */
  aground?: AgroundState;
  /** Her trapped air (`spec.trappedAir`), per cell of `all`; missing: none. */
  air?: TrappedAir;
}

/**
 * The air caught in a body's cells (`spec.trappedAir`, air.ts), one entry
 * per cell of `Body.all`.
 */
export interface TrappedAir {
  /** Air mass (atmosphere·m³: the volume it would fill at the surface). */
  mass: Float64Array;
  /** Gauge head of the air this step (m of her water; 0 unsealed). */
  head: Float64Array;
  /** Sealed this step (1) or open to the air above the sea (0). */
  sealed: Uint8Array;
  /** Her stated slow leak (m²) from each cell's top. */
  leak: Float64Array;
  /** Air out this step (atm·m³/s), and the step's scratch. */
  out: Float64Array;
  step: AirStep;
}

/** The floor's earth z under an earth x, y. */
export type FloorFn = (x: number, y: number) => number;

// Module constants: global lookups (Infinity) are slow in test sandboxes.
const NO_FLOOR = -Infinity;

/** How far (m) a hull vertex may move before its slope bound is renewed. */
export const FLOOR_MEMO_M = 10;

/**
 * The floor (earth z) under `floorPts` vertex `k` at earth x, y, looked up
 * with `floor`, when it may reach the vertex's earth z; −∞ when it cannot
 * (the vertex is clear by more than the floor can rise since its last
 * lookup: that lookup's floor plus `floorSlope` × the distance moved).
 * Only the speed changes: a vertex skipped is one whose depth into the
 * floor is ≤ 0, which the floor code ignores anyway. A body without
 * `floorSlope` looks up every vertex.
 */
export function floorNear(
  b: Body,
  floor: FloorFn,
  k: number,
  x: number,
  y: number,
  z: number
): number {
  const slope = b.floorSlope;
  if (!slope) return floor(x, y);
  // Four numbers a vertex, as `floorPts` has.
  const n = b.floorPts.length;
  let m = b.floorMemo;
  if (!m || m.length !== n) {
    m = new Float64Array(n).fill(NaN);
    b.floorMemo = m;
  }
  const i = k * 4;
  const dx = x - m[i];
  const dy = y - m[i + 1];
  const moved = sqrt(dx * dx + dy * dy);
  // (NaN before the first lookup: every test fails, so it looks up.)
  if (moved <= FLOOR_MEMO_M && m[i + 2] + m[i + 3] * moved < z - 1e-6)
    return NO_FLOOR;
  const f = floor(x, y);
  m[i] = x;
  m[i + 1] = y;
  m[i + 2] = f;
  m[i + 3] = slope(x, y);
  return f;
}

/** The rest aground under way (`spec.aground`, a rule). */
export interface AgroundState {
  /** Roll pace from where it began: [real s, |roll| rad], ascending. */
  pace: [number, number][];
  /** Her rest (rad, signed as roll). */
  rest: number;
  /** How deep her lowest point was in the floor when it began (m). */
  seat: number;
  /** She has reached her rest. */
  done: boolean;
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

/**
 * Turn a floating body to heading `yaw` about its centre of mass: earth x
 * and y only (z, pitch and roll do not see yaw).
 */
export function turnTo(b: Body, yaw: number): void {
  if (yaw === b.yaw) return;
  const g0 = rotateYaw(b.yaw, b.pitch, b.roll, b.gx, b.gy, b.gz);
  const g1 = rotateYaw(yaw, b.pitch, b.roll, b.gx, b.gy, b.gz);
  b.x += g0[0] - g1[0];
  b.y += g0[1] - g1[1];
  b.yaw = yaw;
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
let deckBuf = new Float64Array(32);

/** Mass properties from the lightship and the water (ship frame). */
function massProps(b: Body): { ip: number } {
  let m = b.lightMass;
  let mx = b.lightMass * b.lightCx;
  let my = b.lightMass * b.lightCy;
  let mz = b.lightMass * b.lightCz;
  for (const c of b.all) {
    if (c.water <= 0) continue;
    const w = b.rho * c.water;
    m += w;
    mx += w * c.wx;
    // Cabins and corridors cut the superstructure up: its water cannot
    // run across the ship (1.0), unless it lies where it came in
    // (`spec.boxWaterAtSide`).
    my += c.box ? (b.boxWaterAtSide ? w * c.wy : 0) : w * c.wy;
    mz += w * c.wz;
  }
  const rock = b.rock;
  if (rock) {
    m += rock.m;
    mx += rock.m * rock.x;
    my += rock.m * rock.y;
    mz += rock.m * rock.z;
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
    const w = b.rho * c.water;
    const len = c.slice.xTo - c.slice.xFrom;
    ip += w * ((c.wx - b.gx) ** 2 + (len * len) / 12);
  }
  if (rock) ip += rock.m * (rock.x - b.gx) ** 2;
  return { ip };
}

/** A sealed pocket's air volume never reaches 0 (m³, for the head). */
const AIR_VOL_MIN = 1e-6;

/** The air in fresh cells: each holds its air volume at the surface. */
export function makeTrappedAir(
  all: readonly Cell[],
  leak: Float64Array,
  step: AirStep
): TrappedAir {
  const n = all.length;
  const mass = new Float64Array(n);
  for (let i = 0; i < n; i += 1) mass[i] = max(0, all[i].cap - all[i].water);
  return {
    mass,
    head: new Float64Array(n),
    sealed: new Uint8Array(n),
    leak,
    out: new Float64Array(n),
    step,
  };
}

/**
 * Trapped air at the pose, before the flows: a cell open to the air above
 * the sea holds its air volume at the surface (h = 0); a sealed one keeps
 * its air, whose Boyle head the flows see.
 */
function airHeads(
  b: Body,
  air: TrappedAir,
  nx: number,
  ny: number,
  nz: number
): void {
  const all = b.all;
  for (let i = 0; i < all.length; i += 1) {
    const c = all[i];
    const vol = c.cap - c.water;
    if (!cellSealed(c, nx, ny, nz, b.z)) {
      air.sealed[i] = 0;
      air.mass[i] = max(0, vol);
      air.head[i] = 0;
      continue;
    }
    air.sealed[i] = 1;
    if (vol <= 0) air.mass[i] = 0;
    // A full space has none: its head is the sea's on its water (0).
    air.head[i] =
      vol <= 0 ? 0 : airHeadM(air.mass[i], max(vol, AIR_VOL_MIN), b.rho);
  }
}

/**
 * Cell i's sea inflow with its trapped air (m³/s, capped): the orifice law
 * on the sea's head less the inside's plus the air's, the Boyle cap, and
 * the air it lets out this step (`air.out`: through openings under the sea
 * where its pressure beats the sea's, its stated leak, and the exchange
 * through its ceiling), never more than brings its head down to the sea's
 * at the shallowest way out.
 */
function airInflow(
  b: Body,
  air: TrappedAir,
  i: number,
  nx: number,
  ny: number,
  nz: number,
  dt: number
): number {
  const c = b.all[i];
  const st = air.step;
  st.h = air.head[i];
  let q = seaInflow(c, nx, ny, nz, b.z, b.ramHead, st);
  air.out[i] = 0;
  if (!air.sealed[i]) return capSeaFlow(c, q, dt);
  const m = air.mass[i];
  const vol = max(c.cap - c.water, AIR_VOL_MIN);
  q = capSeaFlow(c, capAirFlow(q, m, vol, st, dt), dt);
  if (m <= 0) return q;
  const h = st.h;
  const rg = b.rho * GRAV;
  // Her stated leak, out of the pocket's top to the sea or the air there.
  let out = st.out;
  let hsOut = st.hsOut;
  const leak = air.leak[i];
  if (leak > 0) {
    const hsTop = max(0, -c.zMax);
    const dp = (h - hsTop) * rg;
    if (dp > 0) {
      out += gasOutflow(leak, dp, P_ATM + h * rg);
      hsOut = min(hsOut, hsTop);
    }
  }
  // Never past the head of the shallowest way out (FLOW_CAP of the gap).
  if (out > 0) {
    const eq = vol * (1 + (hsOut * rg) / P_ATM);
    out = min(out, (FLOW_CAP * max(0, m - eq)) / dt);
  }
  // The ceiling's exchange: each m³ of water in lets a m³ of air out.
  const glug = min(st.glug, max(0, q));
  if (glug > 0) out += glug * (m / vol);
  air.out[i] = min(out, m / dt);
  return q;
}

/** Trapped air after the water has moved: sealed cells lose what left. */
function airAfter(b: Body, air: TrappedAir, dt: number): void {
  const all = b.all;
  for (let i = 0; i < all.length; i += 1) {
    const c = all[i];
    const vol = c.cap - c.water;
    if (!air.sealed[i]) air.mass[i] = max(0, vol);
    else if (vol <= AIR_VOL_MIN) air.mass[i] = 0;
    else air.mass[i] = max(0, air.mass[i] - air.out[i] * dt);
  }
}

/**
 * One fixed step of a floating body: hydrostatics at the current pose, the
 * water's levels, the flows (applied), then the motion. `areas` asks the
 * cells to keep per-station areas for the girder. `sea` (when the ship has
 * deck openings) is the wave surface they see; `pumpDepth` the water depth
 * over which the pumps in a space stop.
 */
export function stepFloat(
  b: Body,
  dt: number,
  areas: boolean,
  drift: number,
  pumps = 0,
  floorZ = -Infinity,
  sea: DeckSea | null = null,
  pumpDepth = PUMP_DEPTH_M,
  heelM = 0
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
    if (c.slice.span) continue;
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
  for (const c of b.cuts) {
    cellSea(c, nx, ny, nz, b.z, true);
    const o = c.seaCut;
    ch += o[R_CH];
    chx += o[R_CHX];
    chxx += o[R_CHXX];
    cht += o[R_CHT];
    s2 += o[R_S2];
    s2x += o[R_S2X];
    s2xx += o[R_S2XX];
    for (let i = 0; i < c.slice.n; i += 1) front = max(front, c.seaArea[i]);
  }
  // Water surfaces.
  for (const c of b.all) solveLevel(c, nx, ny, nz, b.z, areas);
  const { ip } = massProps(b);
  // Trapped air: which cells are sealed, and their air's heads.
  const air = b.air;
  if (air) airHeads(b, air, nx, ny, nz);

  // Flows at this pose.
  let inflow = 0;
  const all = b.all;
  if (dwBuf.length < all.length) dwBuf = new Float64Array(all.length * 2);
  const dw = dwBuf;
  if (deckBuf.length < all.length) deckBuf = new Float64Array(all.length * 2);
  const deckQ = deckBuf;
  if (sea !== null)
    deckFlows(
      all,
      b.deckWater,
      b.x,
      b.y,
      b.z,
      cos(b.pitch),
      sin(b.pitch),
      cos(b.roll),
      sin(b.roll),
      sea,
      dt,
      deckQ
    );
  for (let i = 0; i < all.length; i += 1) {
    const c = all[i];
    const q = air
      ? airInflow(b, air, i, nx, ny, nz, dt)
      : capSeaFlow(c, seaInflow(c, nx, ny, nz, b.z, b.ramHead), dt);
    c.inflow = q;
    inflow += q;
    dw[i] = q * dt;
    if (q > 0) c.seaIn += q * dt;
    if (sea !== null && c.deck.length > 0) {
      // Over the deck: one step may fill the cell, no more, or empty it.
      // Deck water a full cell cannot take is dropped (its bay already
      // gave it up: a negligible leak, deckWater.ts).
      let qd = deckQ[i];
      qd =
        qd > 0
          ? min(qd, max(0, c.cap - c.water - dw[i]) / dt)
          : max(qd, -max(0, c.water + dw[i]) / dt);
      c.inflow += qd;
      inflow += qd;
      dw[i] += qd * dt;
      if (qd > 0) c.deckIn += qd * dt;
    }
  }
  for (const l of b.links) {
    const q = spill(
      b.cells[l.a],
      b.cells[l.b],
      l.x,
      l.topZ,
      l.breadth,
      nx,
      nz,
      b.z,
      dt,
      ny,
      l.y,
      air ? air.head[l.a] : 0,
      air ? air.head[l.b] : 0
    );
    dw[l.a] -= q * dt;
    dw[l.b] += q * dt;
  }
  for (const l of b.crosses) {
    const q = crossFlow(
      b.cells[l.a],
      b.cells[l.b],
      l.area,
      l.x,
      l.y,
      l.z,
      nx,
      ny,
      nz,
      b.z,
      dt,
      air ? air.head[l.a] : 0,
      air ? air.head[l.b] : 0
    );
    dw[l.a] -= q * dt;
    dw[l.b] += q * dt;
  }
  if (b.doors)
    for (const l of b.doors) {
      const q = air
        ? doorFlow(
            b.cells[l.a],
            b.cells[l.b],
            l,
            nx,
            nz,
            b.z,
            dt,
            air.head[l.a],
            air.head[l.b]
          )
        : doorFlow(b.cells[l.a], b.cells[l.b], l, nx, nz, b.z, dt);
      dw[l.a] -= q * dt;
      dw[l.b] += q * dt;
    }
  // Pumps, aftmost machinery space first, while the water there is shallow.
  let pumpLeft = pumps * dt;
  for (let i = 0; i < b.cells.length && pumpLeft > 0; i += 1) {
    const c = b.cells[i];
    if (!c.pumped || c.water <= 0 || c.level - c.zMin > pumpDepth) continue;
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
  if (air) airAfter(b, air, dt);
  b.inflow = inflow;
  b.netFlow = (after - before) / dt;
  b.flowAvg = Number.isFinite(b.flowAvg)
    ? b.flowAvg + (b.netFlow - b.flowAvg) * min(1, dt / STEADY_AVG_S)
    : b.netFlow;

  // Forces and moments about G.
  const c = cos(b.pitch);
  const s = sin(b.pitch);
  const bx = vol > 0 ? bmx / vol : b.gx;
  const by = vol > 0 ? bmy / vol : b.gy;
  const bz = vol > 0 ? bmz / vol : b.gz;
  const r = rotate(b.pitch, b.roll, bx - b.gx, by - b.gy, bz - b.gz);
  const rho = b.rho;
  const fb = rho * GRAV * vol;
  const fz = fb - b.mass * GRAV;
  const tauP = -r[0] * fb;
  const tauR = r[1] * fb * c;

  const lean = sqrt(max(0, 1 - nx * nx));
  const strip = ADDED_MASS_COEF * rho * (Math.PI / 8);
  const gx = b.gx;
  const mn = b.mass + strip * s2;
  const mt = b.mass + AXIAL_ADDED_MASS * rho * vol;
  const ipe = ip + strip * max(0, s2xx - 2 * gx * s2x + gx * gx * s2);
  const ir = b.mass * (ROLL_GYRATION * b.beam) ** 2 * (1 + ROLL_ADDED);

  // Linear damping from the waterplane's stiffness.
  const awp = lean > 0.3 ? ch / lean : 0;
  const il = lean > 0.3 ? max(0, chxx - 2 * gx * chx + gx * gx * ch) / lean : 0;
  const cn0 = 2 * HEAVE_ZETA * sqrt(rho * GRAV * awp * mn);
  const cp0 = 2 * PITCH_ZETA * sqrt(rho * GRAV * il * ipe);
  const cr0 = 2 * ROLL_ZETA * sqrt(rho * GRAV * max(0, cht) * ir);

  // Quadratic drag normal to the axis, per station, linearised.
  const vn = b.vx * s + b.vz * c;
  const vt = b.vx * c - b.vz * s;
  let cnn = cn0;
  let cnp = 0;
  let cpp = cp0;
  const half = 0.5 * rho * DRAG_CD;
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
  const ct = 0.5 * rho * AXIAL_CD * front * abs(vt);
  const vt2 = (mt * vt + ft * dt) / (mt + ct * dt);
  // An outside heeling moment (`spec.heel`: wind, N·m, + to starboard).
  const wr2 = (ir * b.wr + (tauR + heelM) * dt) / (ir + cr0 * dt);
  const wp0 = b.wp;
  b.an = (vn2 - vn) / dt;
  b.alpha = (wp2 - wp0) / dt;
  b.vx = vn2 * s + vt2 * c;
  b.vz = vn2 * c - vt2 * s;
  b.wp = wp2;
  b.wr = wr2;
  b.grounded = false;
  b.floorN = 0;
  if (b.bottom < floorZ && floorContact(b, dt, floorZ, mt, mn, ipe, ir)) {
    b.an = (b.vx * s + b.vz * c - vn) / dt;
    b.alpha = (b.wp - wp0) / dt;
  }

  // Move the centre of mass, turn about it, and place the origin. On a
  // heading (yaw), her surge runs along it; the drift stays earth y.
  const yaw = b.yaw;
  const g0 =
    yaw === 0
      ? rotate(b.pitch, b.roll, b.gx, b.gy, b.gz)
      : rotateYaw(yaw, b.pitch, b.roll, b.gx, b.gy, b.gz);
  const gex = b.x + g0[0] + (yaw === 0 ? b.vx : b.vx * cos(yaw)) * dt;
  const gey = b.y + g0[1] + (yaw === 0 ? drift : drift + b.vx * sin(yaw)) * dt;
  const gez = b.z + g0[2] + b.vz * dt;
  b.pitch += b.wp * dt;
  b.roll += b.wr * dt;
  const g1 =
    yaw === 0
      ? rotate(b.pitch, b.roll, b.gx, b.gy, b.gz)
      : rotateYaw(yaw, b.pitch, b.roll, b.gx, b.gy, b.gz);
  b.x = gex - g1[0];
  b.y = gey - g1[1];
  b.z = gez - g1[2];
}

/**
 * For tests and tools: the buoyancy and weight (N) at the body's pose and
 * the roll moment about its centre of mass (N·m, + to starboard), from the
 * floating step's own sums (every envelope's sea clip, the water's levels,
 * the mass). Moves nothing.
 */
export function staticForces(b: Body): {
  fb: number;
  weight: number;
  tauR: number;
} {
  const [nx, ny, nz] = upOf(b);
  updateBounds(b);
  let vol = 0;
  let bmx = 0;
  let bmy = 0;
  let bmz = 0;
  for (const c of b.all) {
    cellSea(c, nx, ny, nz, b.z, false);
    vol += c.seaVol;
    bmx += c.seaMx;
    bmy += c.seaMy;
    bmz += c.seaMz;
  }
  for (const c of b.all) solveLevel(c, nx, ny, nz, b.z, false);
  massProps(b);
  const bx = vol > 0 ? bmx / vol : b.gx;
  const by = vol > 0 ? bmy / vol : b.gy;
  const bz = vol > 0 ? bmz / vol : b.gz;
  const r = rotate(b.pitch, b.roll, bx - b.gx, by - b.gy, bz - b.gz);
  const fb = b.rho * GRAV * vol;
  return { fb, weight: b.mass * GRAV, tauR: r[1] * fb * cos(b.pitch) };
}

// Scratch for the floor contact (grown as needed).
let fIdx = new Int32Array(64);
let fD = new Float64Array(64);
let fK = new Float64Array(64);
let fC = new Float64Array(64);
let fCf = new Float64Array(64);
let fR = new Float64Array(64 * 3);
const fA = new Float64Array(16);
const fRhs = new Float64Array(4);
const fQ = new Float64Array(4);

function growFloor(n: number): void {
  if (fIdx.length >= n) return;
  const m = n * 2;
  fIdx = new Int32Array(m);
  fD = new Float64Array(m);
  fK = new Float64Array(m);
  fC = new Float64Array(m);
  fCf = new Float64Array(m);
  fR = new Float64Array(m * 3);
}

/** Solve the 4×4 system a·x = r in place (Gaussian elimination, pivoting). */
function solve4(a: Float64Array, r: Float64Array, x: Float64Array): boolean {
  for (let col = 0; col < 4; col += 1) {
    let piv = col;
    for (let row = col + 1; row < 4; row += 1)
      if (abs(a[row * 4 + col]) > abs(a[piv * 4 + col])) piv = row;
    if (abs(a[piv * 4 + col]) < 1e-30) return false;
    if (piv !== col) {
      for (let k = 0; k < 4; k += 1) {
        const t = a[col * 4 + k];
        a[col * 4 + k] = a[piv * 4 + k];
        a[piv * 4 + k] = t;
      }
      const t = r[col];
      r[col] = r[piv];
      r[piv] = t;
    }
    for (let row = col + 1; row < 4; row += 1) {
      const f = a[row * 4 + col] / a[col * 4 + col];
      if (f === 0) continue;
      for (let k = col; k < 4; k += 1) a[row * 4 + k] -= f * a[col * 4 + k];
      r[row] -= f * r[col];
    }
  }
  for (let row = 3; row >= 0; row -= 1) {
    let v = r[row];
    for (let k = row + 1; k < 4; k += 1) v -= a[row * 4 + k] * x[k];
    x[row] = v / a[row * 4 + row];
  }
  return true;
}

/**
 * The sea floor under a floating body: every hull vertex below `floorZ`
 * pushes back with a spring (its depth into the mud) and a damper, and drags
 * along the floor with regularised Coulomb friction. Applied implicitly to
 * the velocities this step has just found (heave and surge of G, pitch and
 * roll rates), so a stiff floor stays stable at any step: with q = (vx, vz,
 * wp, wr) and each contact's Jacobians Jz (vertical) and Jx (along),
 *   (M + dt·Σ[(k·dt + c)·Jz·Jzᵀ + cf·Jx·Jxᵀ]) q' = M·q + dt·Σ k·d·Jz,
 * and a contact that would pull is dropped and the system solved again.
 * Roll: the contacts' forces act in roll like any other (no rule by list).
 * There is no sideways friction: with no sway in the model it would lock
 * her roll instead of letting her turn about the keel where it touches.
 * Returns true if anything touched.
 */
function floorContact(
  b: Body,
  dt: number,
  floorZ: number,
  mt: number,
  mn: number,
  ipe: number,
  ir: number
): boolean {
  const [nx, ny, nz] = upOf(b);
  const pts = b.floorPts;
  const np = pts.length / 4;
  growFloor(np);
  const cp = cos(b.pitch);
  const sp = sin(b.pitch);
  const mid = (b.xFrom + b.xTo) / 2;
  // A seabed (`spec.seabed`): the floor under each point, at its earth
  // x, y (the origin plus its ship x, y turned by her heading).
  const fn = b.floorFn;
  const cy = fn ? cos(b.yaw) : 1;
  const sy = fn ? sin(b.yaw) : 0;
  let n = 0;
  for (let p = 0; p < np; p += 1) {
    const x = pts[p * 4];
    const y = pts[p * 4 + 1];
    const z = pts[p * 4 + 2];
    const zp = b.z + nx * x + ny * y + nz * z;
    const fz = fn
      ? floorNear(b, fn, p, b.x + cy * x - sy * y, b.y + sy * x + cy * y, zp)
      : floorZ;
    const d = fz - zp;
    if (d <= 0) continue;
    const r = rotate(b.pitch, b.roll, x - b.gx, y - b.gy, z - b.gz);
    fIdx[n] = p;
    fD[n] = d;
    fK[n] = b.floorK * pts[p * 4 + 3];
    fC[n] = fK[n] * FLOOR_DAMP_S;
    fR[n * 3] = r[0];
    fR[n * 3 + 1] = r[1];
    fR[n * 3 + 2] = r[2];
    n += 1;
  }
  if (n === 0) return false;
  // Generalised mass: the hull's axial and normal masses turned to earth.
  const mxx = mt * cp * cp + mn * sp * sp;
  const mzz = mt * sp * sp + mn * cp * cp;
  const mxz = (mn - mt) * sp * cp;
  const q0 = [b.vx, b.vz, b.wp, b.wr];
  // Friction coefficients from the force each contact carries now.
  for (let i = 0; i < n; i += 1) {
    const rx = fR[i * 3];
    const ry = fR[i * 3 + 1];
    const rz = fR[i * 3 + 2];
    const uz = q0[1] - rx * q0[2] + cp * ry * q0[3];
    const ux = q0[0] + rz * q0[2] + sp * ry * q0[3];
    const f0 = max(0, fK[i] * fD[i] - fC[i] * uz);
    fCf[i] = (FLOOR_FRICTION * f0) / max(FLOOR_SLIP_MS, abs(ux));
  }
  const active = new Uint8Array(n).fill(1);
  for (let pass = 0; pass < 4; pass += 1) {
    fA.fill(0);
    fA[0] = mxx;
    fA[1] = mxz;
    fA[4] = mxz;
    fA[5] = mzz;
    fA[10] = ipe;
    fA[15] = ir;
    fRhs[0] = mxx * q0[0] + mxz * q0[1];
    fRhs[1] = mxz * q0[0] + mzz * q0[1];
    fRhs[2] = ipe * q0[2];
    fRhs[3] = ir * q0[3];
    for (let i = 0; i < n; i += 1) {
      if (!active[i]) continue;
      const rx = fR[i * 3];
      const ry = fR[i * 3 + 1];
      const rz = fR[i * 3 + 2];
      const jz1 = 1;
      const jz2 = -rx;
      const jz3 = cp * ry;
      const kz = dt * (fK[i] * dt + fC[i]);
      // Jz = (0, 1, -rx, cp·ry)
      fA[5] += kz * jz1 * jz1;
      fA[6] += kz * jz1 * jz2;
      fA[7] += kz * jz1 * jz3;
      fA[9] += kz * jz2 * jz1;
      fA[10] += kz * jz2 * jz2;
      fA[11] += kz * jz2 * jz3;
      fA[13] += kz * jz3 * jz1;
      fA[14] += kz * jz3 * jz2;
      fA[15] += kz * jz3 * jz3;
      const push = dt * fK[i] * fD[i];
      fRhs[1] += push * jz1;
      fRhs[2] += push * jz2;
      fRhs[3] += push * jz3;
      // Jx = (1, 0, rz, sp·ry)
      const kx = dt * fCf[i];
      const jx = [1, 0, rz, sp * ry];
      for (let r = 0; r < 4; r += 1)
        for (let c = 0; c < 4; c += 1) fA[r * 4 + c] += kx * jx[r] * jx[c];
    }
    if (!solve4(fA, fRhs, fQ)) return false;
    let dropped = false;
    for (let i = 0; i < n; i += 1) {
      if (!active[i]) continue;
      const uz = fQ[1] - fR[i * 3] * fQ[2] + cp * fR[i * 3 + 1] * fQ[3];
      if (fK[i] * fD[i] - (fK[i] * dt + fC[i]) * uz < 0) {
        active[i] = 0;
        dropped = true;
      }
    }
    if (!dropped) break;
  }
  b.vx = fQ[0];
  b.vz = fQ[1];
  b.wp = fQ[2];
  b.wr = fQ[3];
  if (b.floorX.length < n) {
    b.floorX = new Float64Array(np);
    b.floorF = new Float64Array(np);
  }
  let m = 0;
  for (let i = 0; i < n; i += 1) {
    if (!active[i]) continue;
    const uz = fQ[1] - fR[i * 3] * fQ[2] + cp * fR[i * 3 + 1] * fQ[3];
    const f = fK[i] * fD[i] - (fK[i] * dt + fC[i]) * uz;
    const x = pts[fIdx[i] * 4];
    b.floorX[m] = x;
    b.floorF[m] = f;
    m += 1;
    if (x >= mid) b.touchBow = true;
    else b.touchStern = true;
  }
  b.floorN = m;
  b.grounded = m > 0;
  return true;
}
