import {
  BOW_DESCENT_PITCH,
  BOW_GLIDE,
  BOW_BEDDED_M,
  BOW_PLOUGH_M,
  PLOUGH_TIME_S,
  DRAG_CD,
  GRAV,
  RHO,
  STEEL_BUOYANCY,
  STERN_CRUSH_M,
  STERN_GLIDE,
  STERN_SPIN,
  STERN_TUMBLE,
} from "./constants";
import { type Body, earthOf, placeAbout, upOf, updateBounds } from "./body";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, asin, cos, exp, max, min, sin } = Math;

/**
 * The way down. Once a body is wholly under, it is flooded: it falls under
 * its lightship weight less the water its steel displaces, against drag on
 * the area it shows the flow, carrying the water inside it. The bow keeps
 * its nose down and glides forward; the stern tumbles slowly and spins.
 * At the floor the bow ploughs into the mud nose first and settles
 * upright; the stern lands hard and settles.
 */

function envelope(b: Body): { vol: number; plan: number; section: number } {
  let vol = 0;
  let plan = 0;
  let section = 0;
  for (const c of b.cells) {
    vol += c.cap;
    plan += c.footprint / 0.8;
    for (let i = 0; i < c.slice.n; i += 1)
      section = max(section, c.slice.fullA[i]);
  }
  for (const c of b.boxes) vol += c.cap;
  return { vol, plan, section };
}

function relax(v: number, target: number, dt: number, tau: number): number {
  return target + (v - target) * exp(-dt / tau);
}

/** Centre of mass of a flooded body, ship frame. */
function floodedCentre(b: Body): [number, number, number] {
  let m = b.lightMass;
  let mx = b.lightMass * b.lightCx;
  const my = b.lightMass * b.lightCy;
  let mz = b.lightMass * b.lightCz;
  for (const c of b.all) {
    const w = RHO * c.cap;
    m += w;
    mx += w * c.slice.cx;
    mz += w * c.slice.cz;
  }
  return [mx / m, my / m, mz / m];
}

/** The body's lowest point now: ship frame. */
function lowestPoint(b: Body): [number, number, number] {
  const [nx, ny, nz] = upOf(b);
  let best = Infinity;
  let p: [number, number, number] = [b.gx, 0, 0];
  for (const c of b.cells) {
    const s = c.slice;
    for (let i = 0; i < s.n; i += 1) {
      if (s.fullA[i] <= 0) continue;
      for (let v = 0; v < s.nv; v += 1) {
        const k = i * s.nv + v;
        const z = nx * s.xs[i] + ny * s.ys[k] + nz * s.zs[k];
        if (z < best) {
          best = z;
          p = [s.xs[i], s.ys[k], s.zs[k]];
        }
      }
    }
  }
  return p;
}

/**
 * One step of the fall. The body turns about its own centre of mass, which
 * falls and glides. Returns true at the moment it touches the floor.
 */
export function stepFall(b: Body, dt: number, floorZ: number): boolean {
  // Flooded: every cell full.
  for (const c of b.all) c.water = c.cap;
  // Already on the floor (it grounded while afloat): it settles from where
  // it lies, its contact as deep in the mud as it already is.
  const onFloor = b.grounded;
  if (!onFloor && !fall(b, dt, floorZ)) return false;
  return touch(b, floorZ, onFloor);
}

/** One step of the fall itself; true once it reaches the floor. */
function fall(b: Body, dt: number, floorZ: number): boolean {
  const env = envelope(b);
  const g = floodedCentre(b);
  const ge = earthOf(b, g[0], g[1], g[2]);
  const weight = b.lightMass * GRAV * (1 - STEEL_BUOYANCY);
  const mEff = b.lightMass + RHO * env.vol * 1.2;
  const shown = env.plan * abs(cos(b.pitch)) + env.section * abs(sin(b.pitch));
  const drag = 0.5 * RHO * DRAG_CD * shown * abs(b.vz);
  b.vz = (mEff * b.vz - weight * dt) / (mEff + drag * dt);
  const down = abs(b.vz);
  if (b.part === "stern") {
    // A slow, damped tumble toward level, and a spin.
    const k = STERN_TUMBLE * STERN_TUMBLE;
    b.wp += (-k * b.pitch - 2 * 0.3 * STERN_TUMBLE * b.wp) * dt;
    b.pitch += b.wp * dt;
    b.wy = relax(b.wy, STERN_SPIN, dt, 20);
    b.yaw += b.wy * dt;
    b.roll = relax(b.roll, 0.08, dt, 40);
    b.vx = -down * STERN_GLIDE;
  } else {
    b.pitch = relax(b.pitch, BOW_DESCENT_PITCH, dt, 25);
    b.wp = 0;
    b.roll = relax(b.roll, 0, dt, 40);
    b.vx = down * BOW_GLIDE;
  }
  ge[0] += b.vx * dt;
  ge[2] += b.vz * dt;
  b.gx = g[0];
  b.gy = g[1];
  b.gz = g[2];
  placeAbout(b, g, ge);
  updateBounds(b);
  if (b.bottom > floorZ) return false;
  b.z += floorZ - b.bottom;
  return true;
}

/** Touched: from here it turns about the point in the mud. */
function touch(b: Body, floorZ: number, onFloor: boolean): boolean {
  b.mode = "landing";
  const p = lowestPoint(b);
  const e = earthOf(b, p[0], p[1], p[2]);
  b.contactP = p;
  b.contactE = [e[0], e[1], floorZ];
  b.contactD0 = onFloor ? max(0, floorZ - e[2]) : 0;
  b.contactT = 0;
  b.contactPitch = b.pitch;
  // A ship whose wreck lies as she came down (spec.wreckKeepsList) keeps
  // the list she lands with; else she rights (the 1.0 rest).
  b.restRoll = b.keepsList ? b.roll : b.part === "stern" ? 0.05 : 0;
  if (b.part === "stern") b.restPitch = -0.02;
  else {
    // Nose deep in the mud, the after end bedded: a slight bow-down rest.
    const lever = max(20, abs(p[0] - b.xFrom));
    b.restPitch = asin(min(0.3, (BOW_PLOUGH_M - BOW_BEDDED_M) / lever));
  }
  updateBounds(b);
  return true;
}

/**
 * Settling on the floor about the contact point, which ploughs (bow) or
 * crushes (stern) into the mud over a second or two and then stays put
 * while the rest of the body comes down. Returns true once at rest.
 */
export function stepLanding(b: Body, dt: number): boolean {
  const bow = b.part !== "stern";
  const restRoll = b.restRoll;
  const tau = bow ? 5 : 2.5;
  b.contactT += dt;
  b.pitch = relax(b.pitch, b.restPitch, dt, tau);
  b.roll = relax(b.roll, restRoll, dt, tau);
  b.wy = relax(b.wy, 0, dt, 1.5);
  b.yaw += b.wy * dt;
  b.vx = 0;
  b.vz = 0;
  b.wp = 0;
  const depth = max(
    b.contactD0,
    (bow ? BOW_PLOUGH_M : STERN_CRUSH_M) *
      (1 - exp(-b.contactT / PLOUGH_TIME_S))
  );
  placeAbout(b, b.contactP, [
    b.contactE[0],
    b.contactE[1],
    b.contactE[2] - depth,
  ]);
  updateBounds(b);
  const rest =
    b.contactT > 5 * PLOUGH_TIME_S &&
    abs(b.pitch - b.restPitch) < 0.004 &&
    abs(b.roll - restRoll) < 0.004 &&
    abs(b.wy) < 0.002;
  if (rest) b.mode = "landed";
  return rest;
}
