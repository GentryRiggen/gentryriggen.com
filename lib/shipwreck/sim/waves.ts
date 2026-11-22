import type { ShipSpec, StormSpec, WaveComponent } from "../ships/types";
import { DRIFT_MPS, GRAV } from "./constants";
import { headwayRun } from "./headway";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { cos, exp, max, sin, sqrt } = Math;

/**
 * A storm's waves: one deterministic field (fixed spectrum, fixed phases)
 * that the sim samples at her deck openings and the sea shader draws, so
 * the waves on screen are the waves that flood her.
 *
 * Linear (Airy) waves in deep water: each component
 *   η = a·cos(k·(x·cos θ + y·sin θ) − ω·t + φ),  ω = 2π/T,  k = ω²/g,
 * θ the direction it travels toward (earth frame, + toward port). Deep
 * water holds where the sea is deeper than half a wavelength: a 10 s wave
 * is 156 m long, so 78 m of sea is enough (Lake Superior is 162 m where
 * the Fitzgerald lies).
 *
 * A wave group (the "three sisters") is a packet on top of the sea:
 *   η = A·exp(−½·((s − c_g·τ)/L)²)·cos(k₀·s − ω₀·τ),
 * s the distance along its direction from where its biggest crest passes
 * at its time, τ the time since then, A = height/2, c_g = g/(2ω₀) (deep
 * water: the crests run through the envelope at twice its speed), and L
 * such that `count` crests stand within the half-height width
 * (2.355·L = count·λ₀). The envelope does not spread (linear dispersion
 * would widen it slowly); it is meant for the minutes around its time.
 *
 * A storm's `ramp` scales the components through time (the sea building
 * as the hindcast has it), linear between its points; the groups keep
 * their own heights.
 *
 * Time is real seconds after the first event (shown time while she
 * floats).
 */

/** Packed values per wave group in `WaveFieldArrays.group`. */
export const GROUP_STRIDE = 10;
/** Group packet: the half-height width holds `count` crests. */
const FWHM_SIGMAS = 2 * sqrt(2 * Math.LN2);
/** Past this many envelope widths a group adds nothing (exp(−½·8²) ≈ 1e-14). */
const GROUP_CUTOFF = 8;

const TWO_PI = 2 * Math.PI;
const DEG = Math.PI / 180;

/** The storm's ramp factor on its components at time t (1 without one). */
export function rampAt(storm: StormSpec, t: number): number {
  const r = storm.ramp;
  if (!r || r.length === 0) return 1;
  if (t <= r[0][0]) return r[0][1];
  for (let i = 1; i < r.length; i += 1)
    if (t <= r[i][0]) {
      const a = r[i - 1];
      const b = r[i];
      return a[1] + ((b[1] - a[1]) * (t - a[0])) / (b[0] - a[0]);
    }
  return r[r.length - 1][1];
}

/** Elevation of the sea (m, + up) at earth (x, y) and real time t. */
export function waveElevation(
  storm: StormSpec,
  xEarth: number,
  yEarth: number,
  t: number,
  scale = 1
): number {
  let e = 0;
  const comps = storm.components;
  for (let i = 0; i < comps.length; i += 1) {
    const c = comps[i];
    const w = TWO_PI / c.periodS;
    const k = (w * w) / GRAV;
    const d = c.dirDeg * DEG;
    e +=
      c.amplitudeM *
      cos(k * (xEarth * cos(d) + yEarth * sin(d)) - w * t + c.phase);
  }
  if (storm.ramp) e *= rampAt(storm, t);
  const groups = storm.groups;
  if (groups)
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i];
      const w = TWO_PI / g.periodS;
      const k = (w * w) / GRAV;
      const d = g.dirDeg * DEG;
      const tau = t - g.t;
      const s = (xEarth - (g.x ?? 0)) * cos(d) + (yEarth - (g.y ?? 0)) * sin(d);
      const len = (g.count * (TWO_PI / k)) / FWHM_SIGMAS;
      const u = (s - (GRAV / (2 * w)) * tau) / len;
      if (u > GROUP_CUTOFF || u < -GROUP_CUTOFF) continue;
      e += (g.heightM / 2) * exp(-0.5 * u * u) * cos(k * s - w * tau);
    }
  return e * scale;
}

/**
 * The sea's surface for boarding: the linear field η with Tayfun's
 * narrow-band second-order correction, η + (k_m/2)(η² − ζ²), ζ the
 * Hilbert transform of η (each component's a·sin of its phase) and k_m
 * the components' mean wavenumber Σa²k/Σa² (Tayfun, "Narrow-band
 * nonlinear sea waves", J. Geophys. Res. 85(C3), 1980, 1548–1552). For one
 * wave it is Stokes' second order, a·cos θ + (k·a²/2)·cos 2θ: crests
 * higher and sharper, troughs flatter, the mean unchanged. The deck
 * openings and the green water on her deck see this; the scene draws the
 * same (`waveField` packs `meanK`). A group adds to η and ζ as its
 * carrier. Allocates nothing.
 */
export function boardingElevation(
  storm: StormSpec,
  xEarth: number,
  yEarth: number,
  t: number,
  scale = 1
): number {
  let e = 0;
  let h = 0;
  let aa = 0;
  let aak = 0;
  const comps = storm.components;
  for (let i = 0; i < comps.length; i += 1) {
    const c = comps[i];
    const w = TWO_PI / c.periodS;
    const k = (w * w) / GRAV;
    const d = c.dirDeg * DEG;
    const p = k * (xEarth * cos(d) + yEarth * sin(d)) - w * t + c.phase;
    const a = c.amplitudeM;
    e += a * cos(p);
    h += a * sin(p);
    aa += a * a;
    aak += a * a * k;
  }
  if (storm.ramp) {
    const f = rampAt(storm, t);
    e *= f;
    h *= f;
  }
  const groups = storm.groups;
  if (groups)
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i];
      const w = TWO_PI / g.periodS;
      const k = (w * w) / GRAV;
      const d = g.dirDeg * DEG;
      const tau = t - g.t;
      const s = (xEarth - (g.x ?? 0)) * cos(d) + (yEarth - (g.y ?? 0)) * sin(d);
      const len = (g.count * (TWO_PI / k)) / FWHM_SIGMAS;
      const u = (s - (GRAV / (2 * w)) * tau) / len;
      if (u > GROUP_CUTOFF || u < -GROUP_CUTOFF) continue;
      const env = (g.heightM / 2) * exp(-0.5 * u * u);
      const p = k * s - w * tau;
      e += env * cos(p);
      h += env * sin(p);
    }
  e *= scale;
  h *= scale;
  const km = aa > 0 ? aak / aa : 0;
  return e + 0.5 * km * (e * e - h * h);
}

/**
 * `boardingElevation` at n points along a line (earth x0 + i·dx,
 * y0 + i·dy), written to out[0..n−1]; `scratch` (n long) holds the
 * Hilbert parts. Each component's phase steps along the line by rotation
 * (no trigonometry per point), so a row of deck bays costs about one
 * point. Allocates nothing.
 */
export function boardingRow(
  storm: StormSpec,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  n: number,
  t: number,
  scale: number,
  out: Float64Array,
  scratch: Float64Array
): void {
  for (let j = 0; j < n; j += 1) {
    out[j] = 0;
    scratch[j] = 0;
  }
  let aa = 0;
  let aak = 0;
  const f = storm.ramp ? rampAt(storm, t) : 1;
  const comps = storm.components;
  for (let i = 0; i < comps.length; i += 1) {
    const c = comps[i];
    const w = TWO_PI / c.periodS;
    const k = (w * w) / GRAV;
    const d = c.dirDeg * DEG;
    const cd = cos(d);
    const sd = sin(d);
    const p = k * (x0 * cd + y0 * sd) - w * t + c.phase;
    const step = k * (dx * cd + dy * sd);
    const cs = cos(step);
    const ss = sin(step);
    const a = c.amplitudeM * f;
    let co = cos(p);
    let si = sin(p);
    for (let j = 0; j < n; j += 1) {
      out[j] += a * co;
      scratch[j] += a * si;
      const nc = co * cs - si * ss;
      si = si * cs + co * ss;
      co = nc;
    }
    aa += c.amplitudeM * c.amplitudeM;
    aak += c.amplitudeM * c.amplitudeM * k;
  }
  const groups = storm.groups;
  if (groups)
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i];
      const w = TWO_PI / g.periodS;
      const k = (w * w) / GRAV;
      const d = g.dirDeg * DEG;
      const tau = t - g.t;
      const len = (g.count * (TWO_PI / k)) / FWHM_SIGMAS;
      for (let j = 0; j < n; j += 1) {
        const s =
          (x0 + j * dx - (g.x ?? 0)) * cos(d) +
          (y0 + j * dy - (g.y ?? 0)) * sin(d);
        const u = (s - (GRAV / (2 * w)) * tau) / len;
        if (u > GROUP_CUTOFF || u < -GROUP_CUTOFF) continue;
        const env = (g.heightM / 2) * exp(-0.5 * u * u);
        const p = k * s - w * tau;
        out[j] += env * cos(p);
        scratch[j] += env * sin(p);
      }
    }
  const km = aa > 0 ? aak / aa : 0;
  for (let j = 0; j < n; j += 1) {
    const e = out[j] * scale;
    const h = scratch[j] * scale;
    out[j] = e + 0.5 * km * (e * e - h * h);
  }
}

/**
 * Significant height of the field's components: 4·√(Σa²/2), m; at time t
 * if given (the ramp's factor then), else at its full height.
 */
export function significantHeight(
  storm: StormSpec,
  scale = 1,
  t?: number
): number {
  let v = 0;
  for (const c of storm.components) v += (c.amplitudeM * c.amplitudeM) / 2;
  return 4 * sqrt(v) * scale * (t === undefined ? 1 : rampAt(storm, t));
}

/** The field packed for the sea shader (one source of truth with the sim). */
export interface WaveFieldArrays {
  count: number;
  amplitude: Float32Array;
  k: Float32Array;
  dirCos: Float32Array;
  dirSin: Float32Array;
  omega: Float32Array;
  phase: Float32Array;
  groupCount: number;
  /**
   * GROUP_STRIDE values per group: amplitude (scaled), k, dir cos, dir sin,
   * ω, t, x, y, envelope length L, group speed c_g (see the module note).
   */
  group: Float32Array;
  /** The ramp's points as (t, factor) pairs (`rampCount` of them): the
   *  components' amplitudes times the factor at t, linear between. */
  rampCount: number;
  ramp: Float32Array;
  /** The components' mean wavenumber Σa²k/Σa² for the second-order
   *  crests (`boardingElevation`): η + (meanK/2)(η² − ζ²), ζ the Hilbert
   *  part (each a·sin of the phase). */
  meanK: number;
}

export function waveField(storm: StormSpec, scale = 1): WaveFieldArrays {
  const n = storm.components.length;
  const out: WaveFieldArrays = {
    count: n,
    amplitude: new Float32Array(n),
    k: new Float32Array(n),
    dirCos: new Float32Array(n),
    dirSin: new Float32Array(n),
    omega: new Float32Array(n),
    phase: new Float32Array(n),
    groupCount: storm.groups?.length ?? 0,
    group: new Float32Array((storm.groups?.length ?? 0) * GROUP_STRIDE),
    rampCount: storm.ramp?.length ?? 0,
    ramp: new Float32Array((storm.ramp ?? []).flatMap(([t, f]) => [t, f])),
    meanK: 0,
  };
  let aa = 0;
  let aak = 0;
  for (const c of storm.components) {
    const w = TWO_PI / c.periodS;
    aa += c.amplitudeM * c.amplitudeM;
    aak += (c.amplitudeM * c.amplitudeM * w * w) / GRAV;
  }
  out.meanK = aa > 0 ? aak / aa : 0;
  storm.components.forEach((c, i) => {
    const w = TWO_PI / c.periodS;
    out.amplitude[i] = c.amplitudeM * scale;
    out.k[i] = (w * w) / GRAV;
    out.dirCos[i] = cos(c.dirDeg * DEG);
    out.dirSin[i] = sin(c.dirDeg * DEG);
    out.omega[i] = w;
    out.phase[i] = c.phase;
  });
  (storm.groups ?? []).forEach((g, i) => {
    const w = TWO_PI / g.periodS;
    const k = (w * w) / GRAV;
    out.group.set(
      [
        (g.heightM / 2) * scale,
        k,
        cos(g.dirDeg * DEG),
        sin(g.dirDeg * DEG),
        w,
        g.t,
        g.x ?? 0,
        g.y ?? 0,
        (g.count * (TWO_PI / k)) / FWHM_SIGMAS,
        GRAV / (2 * w),
      ],
      i * GROUP_STRIDE
    );
  });
  return out;
}

/** Search step for the sea's crest under a group (s). */
const LOCK_STEP_S = 0.05;

/** Where a ship is (earth x, y) at real time t. */
export type ShipPath = (t: number) => readonly [x: number, y: number];

/**
 * Each wave group moved onto the sea's own highest crest within half its
 * period of its time: its biggest wave rides on that crest (otherwise the
 * sea's phases alone decide whether it lands on a crest or in a trough,
 * and a 4 m group could even lower the waves there). With a `path` (a
 * group with no place of its own: the ship's) the sea is sampled where she
 * is at each candidate time and the group is placed there, so the crest
 * comes under her as she moves; without one, at the group's fixed place.
 */
export function lockGroups(storm: StormSpec, path?: ShipPath): StormSpec {
  if (!storm.groups) return storm;
  const sea: StormSpec = { ...storm, groups: undefined };
  return {
    ...storm,
    groups: storm.groups.map((g) => {
      const follow = path && (g.x === undefined || g.y === undefined);
      const at = (t: number): readonly [number, number] =>
        follow ? (path as ShipPath)(t) : [g.x ?? 0, g.y ?? 0];
      let best = g.t;
      let top = -Infinity;
      const n = Math.round(g.periodS / LOCK_STEP_S);
      for (let i = 0; i <= n; i += 1) {
        const t = g.t - g.periodS / 2 + i * LOCK_STEP_S;
        const [x, y] = at(t);
        const e = waveElevation(sea, x, y, t);
        if (e > top) {
          top = e;
          best = t;
        }
      }
      const [x, y] = at(best);
      return { ...g, t: best, x, y };
    }),
  };
}

/** Her predicted path while she floats: her headway along x, the drift along y. */
export function predictedPath(spec: ShipSpec): ShipPath {
  return (t) => [headwayRun(spec.headway, 0, t), DRIFT_MPS * t];
}

/**
 * The ship's storm as it is known before a run: every wave group without
 * a place of its own locked onto the sea's crest along her predicted path
 * (`predictedPath`: her headway and the sim's drift; `lockGroups`).
 * Undefined without a storm. The sim re-locks each such group on her own
 * path, surge and all, `GROUP_RELOCK_S` before it (`SimTrack.storm` is the
 * field as it ran: the scene draws that).
 */
export function stormOf(spec: ShipSpec): StormSpec | undefined {
  const storm = spec.storm;
  if (!storm || !storm.groups) return storm;
  return lockGroups(storm, predictedPath(spec));
}

/**
 * The sim re-locks a group this long (real s) before its time, on where
 * she really is then. Its envelope at her that early is under 0.2% of its
 * height (the group overtakes her at about 3 m/s; L is about 240 m), so
 * the re-lock moves the waves she has already met by millimetres.
 */
export const GROUP_RELOCK_S = 300;

/** A fixed hash of an integer to [0, 1) (no Math.random). */
function hash01(k: number): number {
  return (((k * 2654435761) >>> 0) % 100000) / 100000;
}

/**
 * Components for a wind sea of significant height `hsM` around the peak
 * period: a JONSWAP spectrum (γ 3.3, the fetch-limited sea of a big lake)
 * cut into `count` bins from 0.65 to 2.2 times the peak frequency, each
 * bin's frequency jittered inside it (equal spacing would make the record
 * repeat every 1/Δf, about 150 s), directions spread ±`spreadDeg` about
 * `dirDeg`, phases from a fixed hash of `seed` and the bin. The amplitudes
 * are then scaled so that 4·√(Σa²/2) is exactly `hsM`.
 */
export function stormComponents(o: {
  hsM: number;
  peakPeriodS: number;
  dirDeg: number;
  spreadDeg?: number;
  count?: number;
  gamma?: number;
  seed?: number;
}): WaveComponent[] {
  const count = o.count ?? 24;
  const spread = o.spreadDeg ?? 30;
  const gamma = o.gamma ?? 3.3;
  const seed = o.seed ?? 1;
  const fp = 1 / o.peakPeriodS;
  const f0 = 0.65 * fp;
  const f1 = 2.2 * fp;
  const df = (f1 - f0) / count;
  const spectrum = (f: number) => {
    const sigma = f <= fp ? 0.07 : 0.09;
    const r = exp(-((f - fp) ** 2) / (2 * sigma * sigma * fp * fp));
    return f ** -5 * exp(-1.25 * (fp / f) ** 4) * gamma ** r;
  };
  const out: WaveComponent[] = [];
  let v = 0;
  for (let i = 0; i < count; i += 1) {
    const f = f0 + (i + 0.5 + 0.8 * (hash01(seed * 7919 + i) - 0.5)) * df;
    const a = sqrt(2 * spectrum(f) * df);
    v += (a * a) / 2;
    // A golden-ratio walk over [-1, 1): every part of the spread is used.
    const u = ((i * 0.6180339887498949 + hash01(seed)) % 1) * 2 - 1;
    out.push({
      amplitudeM: a,
      periodS: 1 / f,
      dirDeg: o.dirDeg + spread * u,
      phase: TWO_PI * hash01(seed * 104729 + i * 31 + 17),
    });
  }
  const fit = o.hsM / (4 * sqrt(max(v, 1e-30)));
  for (const c of out) c.amplitudeM *= fit;
  return out;
}
