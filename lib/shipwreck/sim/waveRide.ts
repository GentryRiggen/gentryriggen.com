import type { ShipSpec, StormSpec } from "../ships/types";
import { GRAV } from "./constants";
import { rampAt } from "./waves";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { abs, atan, cos, exp, sin, sqrt } = Math;

/**
 * How she rides the storm's waves: her quasi-static heave, pitch and roll
 * on the shared wave field (`waves.ts`), a kinematic offset on her
 * still-water pose. The sim's deck openings see the sea relative to it
 * (a crest under the stern lifts the stern; the bow, a wave further on,
 * dips into the trough before the next crest), and the scene draws her
 * riding by the same function, so the green water on screen is the sim's.
 * The rigid-body state (buoyancy, the water inside, the girder) stays on
 * the still-water pose: the ride is not fed back into the physics.
 *
 * The response is hydrostatic (Froude–Krylov) equilibrium on the wave,
 * the long-wave limit of strip theory: she settles on the plane her
 * waterplane feels. Linear waves add, so each component (and each wave
 * group's carrier) contributes on its own:
 *
 * - the pressure under her bottom, a draught T down, is the wave's times
 *   e^(−kT) (deep water: the wave's pressure dies away as e^(kz); the
 *   "Smith effect", Journée & Massie, Offshore Hydromechanics, TU Delft
 *   2001, ch. 5 and 6, the Froude–Krylov force on a wall-sided body);
 * - averaged over a rectangular waterplane L × B, cos(kx·x + ky·y + ψ)
 *   gives sinc(kx·L/2)·sinc(ky·B/2)·cos ψ (sinc u = sin u / u): heave;
 * - its least-squares slope along x is −kx·P(kx·L/2)·sinc(ky·B/2)·sin ψ,
 *   P(u) = 3(sin u − u cos u)/u³ (P → 1 as u → 0: a long wave's own
 *   slope): pitch; and the same across her beam for roll, where in place
 *   of e^(−kT) a ship's roll follows the wave's slope times the effective
 *   wave slope coefficient r = 0.73 + 0.6·OG/d (OG = KG − d, d her
 *   draught; IMO 2008 Intact Stability Code, Part A, 2.3, the severe wind
 *   and rolling criterion), clamped to [0, 1]: 0.52 for her, her weight
 *   carried low.
 *
 * That is the "response factor for a long ship in waves shorter than
 * her": a 189 m sea under her 217 m length nearly cancels in heave
 * (sinc 3.3 ≈ −0.06) and pitches her about a quarter of its own slope
 * (P(3.3) ≈ 0.25), while the longer swells in the spectrum lift her
 * nearly whole. Quasi-static holds where she meets the waves more slowly
 * than her own heave, pitch and roll periods (about 7–9 s for her: heave
 * 2π√((T·Cb/Cw)(1 + added mass)/g) ≈ 7.5 s; roll 2π·0.38B/√(g·GM) ≈ 9 s):
 * in her following sea the peak's encounter period is about 16 s, so the
 * dynamic magnification (1/(1 − (Te_n/Te)²) ≈ 1.3 undamped, less with
 * her damping) is left out, which keeps the ride on the gentle side.
 *
 * L is her LBP, B her beam and T her draught (still water: the ride
 * belongs to her floating whole and fades once her bow goes under:
 * `rideWeight`). Her yaw is taken as 0 (her heading is the ship frame's
 * +x, as the storm's directions are).
 *
 * Signs as `BodyPose`: heave + up, pitch + bow down, roll + starboard
 * down. A ship-frame point (x, y) of hers (x from midships, y + to port)
 * moves up by heave − x·pitch + y·roll (small angles: `rideDz`).
 */

/** Packed values per ride term (component or group carrier). */
const TERM = 7;
const TWO_PI = 2 * Math.PI;
const DEG = Math.PI / 180;
/** Past this many envelope widths a group adds nothing (as `waves.ts`). */
const GROUP_CUTOFF = 8;
const FWHM_SIGMAS = 2 * sqrt(2 * Math.LN2);

function sinc(u: number): number {
  return abs(u) < 1e-6 ? 1 - (u * u) / 6 : sin(u) / u;
}

/** The least-squares slope of cos(k·x) over [−L/2, L/2] per unit k (u = kL/2). */
function slopeFactor(u: number): number {
  if (abs(u) < 1e-3) return 1 - (u * u) / 10;
  return (3 * (sin(u) - u * cos(u))) / (u * u * u);
}

/** The effective wave slope coefficient for her roll (IMO; above). */
export function rollSlopeFactor(spec: ShipSpec): number {
  const r = 0.73 + (0.6 * (spec.kg - spec.draught)) / spec.draught;
  return r < 0 ? 0 : r > 1 ? 1 : r;
}

/**
 * Per storm and ship, the response terms: per component e^(−kT), the
 * heave factor (sinc·sinc), the pitch factor (−kx·P·sinc), the roll
 * factor (−ky·P·sinc·r), kx, ky, ω; then the same per group carrier.
 * Rebuilt only when the storm or ship changes (a group re-lock makes a
 * new storm).
 */
let cacheStorm: StormSpec | null = null;
let cacheSpec: ShipSpec | null = null;
let terms = new Float64Array(0);

function termsFor(storm: StormSpec, spec: ShipSpec): Float64Array {
  if (storm === cacheStorm && spec === cacheSpec) return terms;
  const comps = storm.components;
  const groups = storm.groups ?? [];
  const n = comps.length + groups.length;
  if (terms.length < n * TERM) terms = new Float64Array(n * TERM);
  const halfL = spec.lbp / 2;
  const halfB = spec.beam / 2;
  const T = spec.draught;
  const r = rollSlopeFactor(spec);
  const fill = (i: number, periodS: number, dirDeg: number) => {
    const w = TWO_PI / periodS;
    const k = (w * w) / GRAV;
    const kx = k * cos(dirDeg * DEG);
    const ky = k * sin(dirDeg * DEG);
    const sx = sinc(kx * halfL);
    const sy = sinc(ky * halfB);
    const o = i * TERM;
    terms[o] = exp(-k * T);
    terms[o + 1] = sx * sy;
    terms[o + 2] = -kx * slopeFactor(kx * halfL) * sy;
    terms[o + 3] = -ky * slopeFactor(ky * halfB) * sx * r;
    terms[o + 4] = kx;
    terms[o + 5] = ky;
    terms[o + 6] = w;
  };
  for (let i = 0; i < comps.length; i += 1)
    fill(i, comps[i].periodS, comps[i].dirDeg);
  for (let i = 0; i < groups.length; i += 1)
    fill(comps.length + i, groups[i].periodS, groups[i].dirDeg);
  cacheStorm = storm;
  cacheSpec = spec;
  return terms;
}

/**
 * Her ride on the storm at real time t, her ship-frame origin (midships)
 * at earth (x, y): writes heave (m, + up), pitch (rad, + bow down) and
 * roll (rad, + starboard down) into out[0..2]. `scale` is the run's
 * STORM_SCALE. No allocation (the response terms are cached per storm).
 */
export function waveRide(
  storm: StormSpec,
  scale: number,
  x: number,
  y: number,
  spec: ShipSpec,
  t: number,
  out: Float64Array
): void {
  const tr = termsFor(storm, spec);
  const comps = storm.components;
  const ramp = storm.ramp ? rampAt(storm, t) : 1;
  let heave = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < comps.length; i += 1) {
    const c = comps[i];
    const o = i * TERM;
    const psi = tr[o + 4] * x + tr[o + 5] * y - tr[o + 6] * t + c.phase;
    const a = c.amplitudeM * ramp;
    const s = a * sin(psi);
    heave += a * tr[o] * tr[o + 1] * cos(psi);
    sx += s * tr[o] * tr[o + 2];
    sy += s * tr[o + 3];
  }
  const groups = storm.groups;
  if (groups)
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i];
      const o = (comps.length + i) * TERM;
      const w = TWO_PI / g.periodS;
      const k = (w * w) / GRAV;
      const d = g.dirDeg * DEG;
      const tau = t - g.t;
      const s = (x - (g.x ?? 0)) * cos(d) + (y - (g.y ?? 0)) * sin(d);
      const len = (g.count * (TWO_PI / k)) / FWHM_SIGMAS;
      const u = (s - (GRAV / (2 * w)) * tau) / len;
      if (u > GROUP_CUTOFF || u < -GROUP_CUTOFF) continue;
      // The carrier under the envelope at her middle (the envelope is
      // longer than she is: about 240 m against her 217 m).
      const a = (g.heightM / 2) * exp(-0.5 * u * u);
      const psi = k * s - w * tau;
      const sn = a * sin(psi);
      heave += a * tr[o] * tr[o + 1] * cos(psi);
      sx += sn * tr[o] * tr[o + 2];
      sy += sn * tr[o + 3];
    }
  out[0] = heave * scale;
  // The surface rising toward the bow lifts the bow (pitch < 0); rising
  // to port lifts port (roll > 0: starboard down).
  out[1] = -atan(sx * scale);
  out[2] = atan(sy * scale);
}

/** How far a ship-frame point (x from midships, y + to port) rides up (m). */
export function rideDz(ride: Float64Array, x: number, y: number): number {
  return ride[0] - x * ride[1] + y * ride[2];
}

/**
 * The ride fades out over this long (real s) once her bow is under: her
 * waterplane is going and she no longer floats on the wave.
 */
export const RIDE_FADE_S = 10;

/**
 * The share of the ride she has at real time t: 1 while she floats with
 * her bow up, easing to 0 over RIDE_FADE_S from when her bow went under
 * (`bowUnderRealT`, null while it has not).
 */
export function rideWeight(t: number, bowUnderRealT: number | null): number {
  if (bowUnderRealT === null || t <= bowUnderRealT) return 1;
  const u = (t - bowUnderRealT) / RIDE_FADE_S;
  return u >= 1 ? 0 : 1 - u;
}
