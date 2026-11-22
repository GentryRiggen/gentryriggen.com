import type { Opening, ShipSpec } from "../ships/types";
import {
  BOX_PERMEABILITY,
  BREAK_DAMAGE_M,
  BREAK_OPEN_FRACTION,
  BREAK_SNAP_M,
  DESCENT_TIME_SCALE,
  DRIFT_MPS,
  END_T,
  FAST_FRAME_S,
  FAST_STEP_S,
  PERMEABILITY,
  PUMP_M3S,
  RHO,
  SIM_STEP_S,
  SLOW_FRAME_S,
} from "./constants";
import { type Body, earthZ, stepFloat, updateBounds } from "./body";
import { stepFall, stepLanding } from "./descent";
import {
  DYNAMO_FLOOD_M,
  FUNNEL_STAY_LIMIT_DEG,
  FUNNEL_STAY_STEP_DEG,
  FUNNEL_UNDER_M,
  LIGHTS_FLICKER_TRIM_DEG,
  STEADY_HOLD_S,
  STEADY_INFLOW_M3S,
  type SimEvent,
  type SimEventKind,
} from "./events";
import { type Cell, makeCell } from "./flooding";
import {
  type HullModel,
  boxSlice,
  buildHull,
  hullHalfBreadth,
  hullSlice,
  sectionAt,
} from "./geometry";
import { type GirderState, girder, strengthProfile } from "./girder";
import { R_SIZE, R_VOL, integrateSlice, upInShip } from "./hydrostatics";
import { type MassModel, buildMass, massOf } from "./mass";
import type { BodyPose, SimFrame, SimTrack } from "./track";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, cos, floor, min, sin } = Math;

/**
 * Running the night: build the ship, settle her, open the holes at t = 0
 * and step until both parts rest on the floor or 6:00 AM comes.
 */

export interface SimProbe {
  t: number;
  bodies: readonly Body[];
  /** Highest bending moment over strength (0 after the break), where. */
  girderUse: number;
  girderX: number;
  girderHogNm: number;
  /** Bending moment per hull station (N·m, + hogging) and the stations. */
  girderHog: Float64Array;
  stationX: Float64Array;
}

export interface SimOptions {
  /** Stop at this shown time if she still floats (default 6:00 AM). */
  endT?: number;
  /** Called after every step (tools and calibration only). */
  probe?: (p: SimProbe) => void;
}

const DEG = Math.PI / 180;
const SETTLE_S = 300;

/** The openings of a What-if run: the real damage where there was some. */
export function whatIfOpenings(
  spec: ShipSpec,
  compartmentIds: readonly string[]
): Opening[] {
  const out: Opening[] = [];
  for (const id of compartmentIds) {
    const comp = spec.compartments.find((c) => c.id === id);
    if (!comp) continue;
    const real = spec.realNight.filter((o) => o.compartmentId === id);
    if (real.length > 0) out.push(...real);
    else
      out.push({
        compartmentId: id,
        areaM2: 0.2,
        zLow: 2.5,
        zHigh: 3.5,
        x: (comp.fromX + comp.toX) / 2,
        side: "starboard",
      });
  }
  return out;
}

interface World {
  spec: ShipSpec;
  hull: HullModel;
  mass: MassModel;
  bodies: Body[];
  compCapacity: number[];
  realT: number;
  t: number;
  nextFrameT: number;
  fast: boolean;
  broken: boolean;
  breakX: number | null;
  brokeAtT: number | null;
  sankAtT: number | null;
  flickerAtT: number | null;
  lightsOut: boolean;
  steadyFor: number;
  steady: boolean;
  scriptedNext: number;
  funnelFallen: boolean[];
  fired: Set<string>;
  events: SimEvent[];
  frames: SimFrame[];
  done: boolean;
  outcome: "sank" | "floated";
  endT: number;
  girderState: GirderState;
  strength: Float64Array;
  forecastle: { x: number; z: number } | null;
  bridge: { x: number; z: number } | null;
  probe?: (p: SimProbe) => void;
  /** Settling before the collision (s left), and the holes to open then. */
  settleLeft: number;
  pending: { i: number; o: Cell["openings"][number] }[];
}

/** Settle her level before the collision, then open the holes at t = 0. */
function settle(w: World): void {
  const body = w.bodies[0];
  stepFloat(body, SIM_STEP_S, false, 0);
  w.settleLeft -= SIM_STEP_S;
  if (w.settleLeft > 0) return;
  body.vx = 0;
  body.vz = 0;
  body.wp = 0;
  body.wr = 0;
  body.x = 0;
  body.y = 0;
  for (const c of body.cells.concat(body.boxes)) c.water = 0;
  for (const p of w.pending) body.cells[p.i].openings.push(p.o);
  updateBounds(body);
  // Replace the placeholder frame with the settled ship at t = 0.
  w.frames[0] = frame(w);
  w.nextFrameT = SLOW_FRAME_S;
}

function cellOpening(
  hull: HullModel,
  o: Opening
): { x: number; y: number; zLow: number; zHigh: number; area: number } {
  const zMid = (o.zLow + o.zHigh) / 2;
  const hb = hullHalfBreadth(hull, o.x, zMid);
  return {
    x: o.x,
    y: (o.side === "port" ? 1 : -1) * hb,
    zLow: o.zLow,
    zHigh: o.zHigh,
    area: o.areaM2,
  };
}

function wallsOf(hull: HullModel, cells: Cell[]): number[] {
  const walls: number[] = [];
  for (let i = 0; i < cells.length - 1; i += 1) {
    const a = cells[i];
    walls.push(
      a.fwdWall && cells[i + 1].aftWall
        ? 2 * hullHalfBreadth(hull, a.slice.xTo, a.fwdTopZ - 0.05)
        : 0
    );
  }
  return walls;
}

function makeBody(
  w: { spec: ShipSpec; hull: HullModel; mass: MassModel },
  part: Body["part"],
  cells: Cell[],
  boxes: Cell[]
): Body {
  const xFrom = cells[0].slice.xFrom;
  const xTo = cells[cells.length - 1].slice.xTo;
  const light = massOf(w.mass, xFrom, xTo);
  return {
    part,
    xFrom,
    xTo,
    cells,
    boxes,
    all: cells.concat(boxes),
    walls: wallsOf(w.hull, cells),
    lightMass: light.mass,
    lightCx: light.cx,
    lightCy: w.spec.tcg ?? 0,
    lightCz: w.spec.kg,
    lightIyy: light.iyy,
    beam: w.spec.beam,
    depth: w.spec.depth,
    x: 0,
    y: 0,
    z: -w.spec.draught,
    pitch: 0,
    roll: 0,
    yaw: 0,
    vx: 0,
    vz: 0,
    wp: 0,
    wr: 0,
    wy: 0,
    gx: light.cx,
    gy: 0,
    gz: w.spec.kg,
    mass: light.mass,
    an: 0,
    alpha: 0,
    inflow: 0,
    netFlow: 0,
    mode: "float",
    top: 0,
    bottom: 0,
    steadyFor: 0,
    frozen: false,
    contactP: [0, 0, 0],
    contactE: [0, 0, 0],
    contactT: 0,
    contactPitch: 0,
    restPitch: 0,
  };
}

function buildWorld(
  spec: ShipSpec,
  openings: readonly Opening[],
  opts: SimOptions
): World {
  const hull = buildHull(spec);
  const whole = hullSlice(hull, hull.xMin, hull.xMax);
  const fullArea = new Float64Array(hull.n);
  for (let i = 0; i < hull.n; i += 1) {
    // Stations of the whole slice are the hull's own (plus none between).
    let k = 0;
    let best = Infinity;
    for (let j = 0; j < whole.n; j += 1) {
      const d = abs(whole.xs[j] - hull.xs[i]);
      if (d < best) {
        best = d;
        k = j;
      }
    }
    fullArea[i] = whole.fullA[k];
  }
  const boxSlices = spec.superstructure.map((s) =>
    boxSlice(hull, spec.sheerZ, s.fromX, s.toX, s.topZ)
  );
  const mass = buildMass(spec, hull, fullArea, boxSlices);
  const last = spec.compartments.length - 1;
  const cells = spec.compartments.map((c, i) =>
    makeCell(
      hullSlice(hull, c.fromX, c.toX),
      i,
      false,
      c.aftBulkheadTopZ,
      c.fwdBulkheadTopZ,
      i > 0,
      i < last,
      c.permeability ?? PERMEABILITY[c.kind]
    )
  );
  spec.compartments.forEach((c, i) => {
    cells[i].pumped = c.kind === "boiler" || c.kind === "engine";
  });
  const boxes = boxSlices.map((s) =>
    makeCell(s, -1, true, 0, 0, false, false, BOX_PERMEABILITY)
  );
  const ctx = { spec, hull, mass };
  const body = makeBody(ctx, "whole", cells, boxes);

  const pending = openings
    .map((o) => ({
      i: spec.compartments.findIndex((c) => c.id === o.compartmentId),
      o: cellOpening(hull, o),
    }))
    .filter((p) => p.i >= 0);

  // Landmarks for the geometric events.
  const fwdBox = spec.superstructure
    .filter((s) => s.toX >= hull.xMax - 1)
    .sort((a, b) => b.toX - a.toX)[0];
  const longest = spec.superstructure
    .slice()
    .sort((a, b) => b.toX - b.fromX - (a.toX - a.fromX))[0];
  const boat = spec.decks.find((d) => d.name === "Boat");
  const sheerAt = (x: number) => spec.sheerZ(x) - spec.depth;
  const w: World = {
    spec,
    hull,
    mass,
    bodies: [body],
    compCapacity: cells.map((c) => c.cap),
    realT: 0,
    t: 0,
    nextFrameT: 0,
    fast: false,
    broken: false,
    breakX: null,
    brokeAtT: null,
    sankAtT: null,
    flickerAtT: null,
    lightsOut: false,
    steadyFor: 0,
    steady: false,
    scriptedNext: 0,
    funnelFallen: spec.funnels.map(() => false),
    fired: new Set(),
    events: [{ t: 0, realT: 0, kind: "collision" }],
    frames: [],
    done: false,
    outcome: "floated",
    endT: opts.endT ?? END_T,
    girderState: { hog: new Float64Array(0), worst: 0, worstX: 0, worstHog: 0 },
    strength: strengthProfile(hull.xs, spec.compartments),
    settleLeft: SETTLE_S,
    pending,
    probe: opts.probe,
    forecastle: fwdBox
      ? { x: (fwdBox.fromX + fwdBox.toX) / 2, z: fwdBox.topZ }
      : null,
    bridge:
      longest && boat
        ? { x: longest.toX, z: boat.z + sheerAt(longest.toX) }
        : null,
  };
  // A placeholder until she has settled, so a track is never empty.
  w.frames.push(frame(w));
  return w;
}

function emit(w: World, kind: SimEventKind, index?: number): void {
  w.events.push(
    index === undefined
      ? { t: w.t, realT: w.realT, kind }
      : { t: w.t, realT: w.realT, kind, index }
  );
}

function once(w: World, key: string, kind: SimEventKind, index?: number): void {
  if (w.fired.has(key)) return;
  w.fired.add(key);
  emit(w, kind, index);
}

/** Flickering lights: a fixed pattern of dips, from a hash of the time. */
function flicker(t: number): number {
  const k = floor(t * 6);
  const h = (((k * 2654435761) >>> 0) % 1000) / 1000;
  return h < 0.3 ? 0.15 + h : 0.85 + 0.15 * h;
}

function power(w: World): number {
  if (w.lightsOut) return 0;
  if (w.flickerAtT === null) return 1;
  return flicker(w.t);
}

function poseOf(b: Body): BodyPose {
  return {
    part: b.part,
    x: b.x,
    y: b.y,
    z: b.z,
    pitch: b.pitch,
    roll: b.roll,
    yaw: b.yaw,
  };
}

function frame(w: World): SimFrame {
  const water = w.compCapacity.map(() => 0);
  let total = 0;
  for (const b of w.bodies) {
    for (const c of b.cells) {
      water[c.comp] += c.water;
      total += c.water;
    }
    for (const c of b.boxes) total += c.water;
  }
  const lead = w.bodies.find((b) => b.part === "stern") ?? w.bodies[0];
  return {
    t: w.t,
    realT: w.realT,
    bodies: w.bodies.map(poseOf),
    water: water.map((v, i) =>
      w.compCapacity[i] > 0 ? min(1, v / w.compCapacity[i]) : 0
    ),
    waterAboardT: (RHO * total) / 1000,
    trimDeg: lead.pitch / DEG,
    listDeg: lead.roll / DEG,
    power: power(w),
  };
}

const splitBuf = new Float64Array(R_SIZE);

/** Split the whole ship at x into stern and bow. */
function breakUp(w: World, xRaw: number): void {
  const whole = w.bodies[0];
  let x = xRaw;
  for (const c of whole.cells) {
    if (abs(c.slice.xTo - x) < BREAK_SNAP_M && c.fwdWall) x = c.slice.xTo;
  }
  const [nx, ny, nz] = upInShip(whole.pitch, whole.roll);
  const sternCells: Cell[] = [];
  const bowCells: Cell[] = [];
  for (const c of whole.cells) {
    if (c.slice.xTo <= x + 1e-6) sternCells.push(c);
    else if (c.slice.xFrom >= x - 1e-6) bowCells.push(c);
    else {
      const aft = makeCell(
        hullSlice(w.hull, c.slice.xFrom, x),
        c.comp,
        false,
        c.aftTopZ,
        c.fwdTopZ,
        c.aftWall,
        false,
        c.perm
      );
      const fwd = makeCell(
        hullSlice(w.hull, x, c.slice.xTo),
        c.comp,
        false,
        c.aftTopZ,
        c.fwdTopZ,
        false,
        c.fwdWall,
        c.perm
      );
      if (c.water > 0) {
        let aftWater: number;
        if (c.water >= c.cap) aftWater = aft.cap;
        else {
          integrateSlice(aft.slice, nx, ny, nz, whole.z - c.level, splitBuf);
          aftWater = min(c.water, splitBuf[R_VOL] * c.perm, aft.cap);
        }
        aft.water = aftWater;
        fwd.water = min(fwd.cap, c.water - aftWater);
        aft.level = c.level;
        fwd.level = c.level;
      }
      for (const o of c.openings) (o.x < x ? aft : fwd).openings.push(o);
      sternCells.push(aft);
      bowCells.push(fwd);
    }
  }
  const sternBoxes: Cell[] = [];
  const bowBoxes: Cell[] = [];
  w.spec.superstructure.forEach((s, i) => {
    const c = whole.boxes[i];
    if (s.toX <= x) sternBoxes.push(c);
    else if (s.fromX >= x) bowBoxes.push(c);
    else {
      const aft = makeCell(
        boxSlice(w.hull, w.spec.sheerZ, s.fromX, x, s.topZ),
        -1,
        true,
        0,
        0,
        false,
        false,
        BOX_PERMEABILITY
      );
      const fwd = makeCell(
        boxSlice(w.hull, w.spec.sheerZ, x, s.toX, s.topZ),
        -1,
        true,
        0,
        0,
        false,
        false,
        BOX_PERMEABILITY
      );
      const f = c.cap > 0 ? c.water / c.cap : 0;
      aft.water = f * aft.cap;
      fwd.water = f * fwd.cap;
      sternBoxes.push(aft);
      bowBoxes.push(fwd);
    }
  });
  // The broken face is open to the sea, and the hull either side of it is
  // torn (shell, decks, bulkheads as the halves hinge and grind): every cell
  // with an end within BREAK_DAMAGE_M gets an opening there, the nearer the
  // larger, the cells at the face the whole BREAK_OPEN_FRACTION.
  const faceArea = (at: number) => {
    const tmp = hullSlice(w.hull, at - 0.5, at + 0.5);
    return tmp.fullA[0] * BREAK_OPEN_FRACTION;
  };
  const tear = (cell: Cell, end: number, stern: boolean) => {
    const d = abs(end - x);
    if (d > BREAK_DAMAGE_M) return;
    const sec = sectionAt(w.hull, end);
    cell.openings.push({
      // Half a metre inside the cell (stern cells lie aft of their end).
      x: end + (stern ? -0.5 : 0.5),
      y: 0,
      zLow: sec.zb,
      zHigh: sec.zt,
      area: faceArea(end) * (1 - d / BREAK_DAMAGE_M),
    });
  };
  for (const c of sternCells) tear(c, c.slice.xTo, true);
  for (const c of bowCells) tear(c, c.slice.xFrom, false);
  sternCells[sternCells.length - 1].fwdWall = false;
  bowCells[0].aftWall = false;

  const ctx = { spec: w.spec, hull: w.hull, mass: w.mass };
  const parts = [
    makeBody(ctx, "stern", sternCells, sternBoxes),
    makeBody(ctx, "bow", bowCells, bowBoxes),
  ];
  const c = cos(whole.pitch);
  const s = sin(whole.pitch);
  for (const p of parts) {
    p.x = whole.x;
    p.y = whole.y;
    p.z = whole.z;
    p.pitch = whole.pitch;
    p.roll = whole.roll;
    p.wp = whole.wp;
    p.wr = whole.wr;
    // Velocity of the part's own centre: v + ω × r in the x–z plane.
    const dx = p.lightCx - whole.gx;
    const dz = p.lightCz - whole.gz;
    const rx = c * dx + s * dz;
    const rz = -s * dx + c * dz;
    p.vx = whole.vx + whole.wp * rz;
    p.vz = whole.vz - whole.wp * rx;
    updateBounds(p);
  }
  w.bodies = parts;
  w.broken = true;
  w.breakX = x;
  w.brokeAtT = w.t;
}

function landmarkUnder(
  b: Body,
  mark: { x: number; z: number } | null
): boolean {
  return mark !== null && earthZ(b, mark.x, 0, mark.z) < 0;
}

/** Events that read the ship's pose and water. */
function watch(w: World): void {
  const spec = w.spec;
  const wholeAfloat =
    !w.broken && w.bodies[0].mode === "float" && w.bodies[0].top > -0.5;
  // Historical events while she is afloat and in one piece.
  if (wholeAfloat) {
    const scripted = spec.scripted;
    while (
      w.scriptedNext < scripted.length &&
      scripted[w.scriptedNext].t <= w.t
    ) {
      const e = scripted[w.scriptedNext];
      emit(w, e.kind, e.index);
      w.scriptedNext += 1;
      if (
        e.kind === "boat-lowered" &&
        !scripted.slice(w.scriptedNext).some((n) => n.kind === "boat-lowered")
      )
        emit(w, "last-boat", e.index);
    }
    const whole = w.bodies[0];
    if (landmarkUnder(whole, w.forecastle)) once(w, "fc", "forecastle-under");
    if (landmarkUnder(whole, w.bridge)) once(w, "br", "bridge-under");
    if (
      w.flickerAtT === null &&
      (whole.pitch / DEG >= LIGHTS_FLICKER_TRIM_DEG ||
        w.funnelFallen.some(Boolean))
    ) {
      w.flickerAtT = w.t;
      emit(w, "lights-flicker");
    }
    // The dynamos: the aftmost engine space flooded deep enough.
    const comps = spec.compartments;
    let dyn = -1;
    for (let i = 0; i < comps.length; i += 1)
      if (comps[i].kind === "engine") {
        dyn = i;
        break;
      }
    if (dyn >= 0 && !w.lightsOut) {
      const cell = whole.cells[dyn];
      if (cell.water > 0 && cell.level - cell.zMin >= DYNAMO_FLOOD_M) {
        w.lightsOut = true;
        emit(w, "lights-out");
      }
    }
  }
  // Funnels: base well under, or the body too steep for the stays.
  spec.funnels.forEach((f, i) => {
    if (w.funnelFallen[i]) return;
    const b = w.bodies.find((p) => f.x >= p.xFrom && f.x <= p.xTo);
    if (!b || b.mode !== "float") return;
    if (
      earthZ(b, f.x, 0, f.baseZ) < -FUNNEL_UNDER_M ||
      abs(b.pitch) / DEG > FUNNEL_STAY_LIMIT_DEG + FUNNEL_STAY_STEP_DEG * i
    ) {
      w.funnelFallen[i] = true;
      emit(w, "funnel-falls", i);
    }
  });
}

function under(w: World, b: Body): void {
  if (b.part === "bow") once(w, "bow-under", "bow-under");
  else if (b.part === "stern") once(w, "stern-under", "stern-under");
  else {
    once(w, "bow-under", "bow-under");
    once(w, "stern-under", "stern-under");
  }
  if (w.bodies.every((p) => p.mode !== "float")) w.sankAtT = w.t;
}

function step(w: World): void {
  if (w.settleLeft > 0) {
    settle(w);
    return;
  }
  const spec = w.spec;
  const compressed = w.bodies.every((b) => b.mode !== "float");
  const dt = w.steady
    ? SIM_STEP_S
    : compressed
      ? FAST_STEP_S * DESCENT_TIME_SCALE
      : w.fast
        ? FAST_STEP_S
        : SIM_STEP_S;
  if (!w.steady) {
    for (const b of w.bodies) {
      if (b.mode === "float" && b.frozen) continue;
      if (b.mode === "float") {
        const girderNow = !w.broken;
        stepFloat(b, dt, girderNow, DRIFT_MPS, w.lightsOut ? 0 : PUMP_M3S);
        updateBounds(b);
        if (girderNow) {
          girder(
            b,
            w.mass,
            spec.girder.hogMaxNm,
            spec.girder.sagMaxNm,
            w.strength,
            w.girderState
          );
        }
        if (
          b.part === "whole" &&
          b.cells.filter((c) => c.slice.xFrom >= 0).every((c) => c.zMax < 0)
        )
          once(w, "bow-under", "bow-under");
        if (b.top < -0.5) {
          b.mode = "fall";
          under(w, b);
        }
      } else if (b.mode === "fall") {
        if (stepFall(b, dt, -spec.seaDepthM)) {
          // An intact hull is both: it lands as one.
          if (b.part !== "stern") emit(w, "bow-lands");
          if (b.part !== "bow") emit(w, "stern-lands");
        }
      } else if (b.mode === "landing") {
        stepLanding(b, dt);
      }
    }
  }
  w.realT += dt;
  w.t += compressed ? dt / DESCENT_TIME_SCALE : dt;
  if (!w.broken && w.girderState.worst >= 1 && w.bodies[0].mode === "float") {
    breakUp(w, w.girderState.worstX);
    emit(w, "breakup");
    if (!w.lightsOut) {
      w.lightsOut = true;
      emit(w, "lights-out");
    }
  }
  watch(w);
  const whole = w.bodies[0];
  if (
    !w.fast &&
    (w.broken ||
      w.flickerAtT !== null ||
      abs(whole.pitch) > 8 * DEG ||
      (w.t > 120 && abs(whole.wp) > 0.003))
  )
    w.fast = true;
  // Floating steady? Each floating body freezes once it has stopped moving
  // and taking water; when nothing is left moving the run holds its pose
  // to the end.
  if (!w.steady && w.t > 1800) {
    for (const b of w.bodies) {
      if (b.mode !== "float" || b.frozen) continue;
      const still =
        abs(b.netFlow) < STEADY_INFLOW_M3S &&
        abs(b.wp) < 1e-5 &&
        abs(b.wr) < 1e-5 &&
        abs(b.vz) < 1e-3;
      b.steadyFor = still ? b.steadyFor + dt : 0;
      if (b.steadyFor >= STEADY_HOLD_S) b.frozen = true;
    }
    if (
      w.bodies.some((b) => b.frozen) &&
      w.bodies.every((b) => b.frozen || b.mode === "landed")
    ) {
      w.steady = true;
      emit(w, "floating-steady");
    }
  }
  if (w.t + 1e-9 >= w.nextFrameT) {
    w.frames.push(frame(w));
    const interval = w.fast && !w.steady ? FAST_FRAME_S : SLOW_FRAME_S;
    while (w.nextFrameT <= w.t + 1e-9) w.nextFrameT += interval;
  }
  if (w.probe)
    w.probe({
      t: w.t,
      bodies: w.bodies,
      girderUse: w.broken ? 0 : w.girderState.worst,
      girderX: w.girderState.worstX,
      girderHogNm: w.girderState.worstHog,
      girderHog: w.girderState.hog,
      stationX: w.hull.xs,
    });
  if (w.bodies.every((b) => b.mode === "landed")) {
    w.done = true;
    w.outcome = "sank";
  } else if (w.t >= w.endT) {
    w.done = true;
    w.outcome = w.bodies.some((b) => b.mode === "float") ? "floated" : "sank";
  }
  if (w.done && w.frames[w.frames.length - 1].t < w.t) w.frames.push(frame(w));
}

export interface SimRunner {
  /** Step for up to `budgetMs` of wall time; true once the run is done. */
  advance(budgetMs: number): boolean;
  readonly done: boolean;
  /** 0..1, roughly how far the run has got. */
  progress(): number;
  /** The track so far (complete once done). */
  track(): SimTrack;
}

function trackOf(w: World): SimTrack {
  return {
    frames: w.frames,
    events: w.events,
    outcome: w.outcome,
    sankAtT: w.sankAtT,
    brokeAtT: w.brokeAtT,
    breakX: w.breakX,
    endT: w.t,
  };
}

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function createSimRunner(
  spec: ShipSpec,
  openings: readonly Opening[],
  opts: SimOptions = {}
): SimRunner {
  let world: World | null = null;
  const runner: SimRunner = {
    advance(budgetMs: number) {
      const start = now();
      if (!world) {
        world = buildWorld(spec, openings, opts);
        if (now() - start >= budgetMs) return false;
      }
      const w = world;
      while (!w.done) {
        step(w);
        if (now() - start >= budgetMs) break;
      }
      return w.done;
    },
    get done() {
      return world?.done ?? false;
    },
    progress() {
      if (!world) return 0;
      if (world.done) return 1;
      return min(0.99, world.t / world.endT);
    },
    track() {
      if (!world) world = buildWorld(spec, openings, opts);
      return trackOf(world);
    },
  };
  return runner;
}

/** The whole run at once. */
export function simulate(
  spec: ShipSpec,
  openings: readonly Opening[],
  opts: SimOptions = {}
): SimTrack {
  const runner = createSimRunner(spec, openings, opts);
  runner.advance(Infinity);
  return runner.track();
}
