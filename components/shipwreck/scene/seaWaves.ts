import type { StormSpec } from "@/lib/shipwreck/ships/types";
import { GRAV } from "@/lib/shipwreck/sim/constants";
import type { SimTrack } from "@/lib/shipwreck/sim/track";
import {
  GROUP_STRIDE,
  waveField,
  type WaveFieldArrays,
} from "@/lib/shipwreck/sim/waves";

/**
 * The storm's sea as the shader draws it: the sim's own wave field
 * (`waveField` of the track's storm, `SimTrack.storm` at `stormScale`)
 * evaluated as `boardingElevation` (the linear sea with Tayfun's
 * second-order crests: what her deck openings and deck water see). Pure,
 * so the tests check the shader's surface against the sim's.
 *
 * Precision (float32 on the GPU): she is 76–101 km from the origin by
 * evening, where float32 positions hold only centimetres and a phase
 * k·x of thousands of radians loses its fraction. So every frame the CPU
 * works out, in float64, each component's phase at the sea mesh's centre
 * (k·(x₀ cos θ + y₀ sin θ) − ω·t + φ, reduced to [0, 2π)) and the wave
 * groups' envelope there, and the shader adds only k·d for the vertex's
 * offset d from that centre (a few km at most). Time is folded in the same
 * way, so it never grows large in the shader either.
 */

/** Room in the shader's arrays (the Fitzgerald's storm has 24 and 1). */
export const SEA_MAX_WAVES = 32;
export const SEA_MAX_GROUPS = 2;
/** Past this many envelope widths a group adds nothing (as `waves.ts`). */
const GROUP_CUTOFF = 8;
const TWO_PI = 2 * Math.PI;

/** The shader's per-frame wave constants (uniform arrays). */
export interface SeaWaves {
  count: number;
  groupCount: number;
  /** Per component: amplitude (scaled, ramped), k·cos θ, k·sin θ, phase at the centre. */
  wave: Float32Array;
  /** Per group: half-height (scaled), k·cos θ, k·sin θ, carrier phase at the centre. */
  groupA: Float32Array;
  /** Per group: cos θ, sin θ, envelope offset at the centre (u₀), 1/L. */
  groupB: Float32Array;
  /**
   * Per group, the rogue wave's look (`rogueLookOf`; zeros for every
   * other group, so the Fitzgerald's sea draws as before): its crest
   * sharpening Q (Gerstner, k·a·Q capped), its crest's forward lean (m per
   * m of crest height), its breaking lip's foam (0–1), unused.
   */
  groupC: Float32Array;
  /** The components' mean wavenumber for the second-order crests. */
  meanK: number;
  /** The components' significant height now (m), for the foam. */
  hs: number;
}

export function createSeaWaves(): SeaWaves {
  return {
    count: 0,
    groupCount: 0,
    wave: new Float32Array(4 * SEA_MAX_WAVES),
    groupA: new Float32Array(4 * SEA_MAX_GROUPS),
    groupB: new Float32Array(4 * SEA_MAX_GROUPS),
    groupC: new Float32Array(4 * SEA_MAX_GROUPS),
    meanK: 0,
    hs: 0,
  };
}

let cacheStorm: SimTrack["storm"] | null = null;
let cacheScale = NaN;
let cacheField: WaveFieldArrays | null = null;

/**
 * The field the scene draws: `waveField(track.storm, track.stormScale)`,
 * kept while the track's storm is the same object (a re-lock or another
 * storm makes a new one). Null without a storm.
 */
export function seaFieldOf(
  track: Pick<SimTrack, "storm" | "stormScale"> | null
): WaveFieldArrays | null {
  const storm = track?.storm;
  if (!storm) return null;
  const scale = track.stormScale ?? 1;
  if (storm !== cacheStorm || scale !== cacheScale || !cacheField) {
    cacheStorm = storm;
    cacheScale = scale;
    cacheField = waveField(storm, scale);
  }
  return cacheField;
}

/** The ramp's factor at t from the packed field (as `rampAt`). */
function rampOf(field: WaveFieldArrays, t: number): number {
  const n = field.rampCount;
  const r = field.ramp;
  if (n === 0) return 1;
  if (t <= r[0]) return r[1];
  for (let i = 1; i < n; i += 1)
    if (t <= r[2 * i]) {
      const t0 = r[2 * i - 2];
      const f0 = r[2 * i - 1];
      return f0 + ((r[2 * i + 1] - f0) * (t - t0)) / (r[2 * i] - t0);
    }
  return r[2 * n - 1];
}

function wrap(p: number): number {
  const q = p % TWO_PI;
  return q < 0 ? q + TWO_PI : q;
}

// --- The rogue wave's look (the Poseidon's; spec "The wave on screen",
// R10). The sim's packet is linear: on screen a smooth 30 m hill, not a
// breaking wall. So a group left out of her ride (`ride: false`, her rogue
// wave) is drawn with three looks the sim never sees: its crests pulled
// together (a Gerstner-style horizontal displacement), its crest leaning
// forward, and a white lip of foam along it for its last ~150 m before
// her. A look only: her ride, her flooding and every camera and spray
// height read the sim's sea (`boardingElevation`).

/**
 * The cap on a crest's sharpening: k·a·Q at the crest. At 1 the Gerstner
 * surface folds (a loop: NaN-free but a cusp); 0.75 leaves the slope
 * finite (1 / (1 − 0.75) = 4× steeper at the crest).
 */
export const ROGUE_SHARPEN_MAX = 0.75;
/** The crest's forward lean at its top (m forward per m of height). */
export const ROGUE_LEAN = 0.35;
/**
 * The breaking lip: from this many seconds before the group's time to
 * when the crest passes her (its phase speed g/ω, about 23 m/s for her
 * 15 s wave, so ~150 m in 6.5 s), full white, then thinning as it breaks
 * over her and runs on.
 */
export const ROGUE_LIP_S: readonly [rise: number, full: number, gone: number] =
  [-8, -4, 10];

/**
 * The look of each group of a storm (GROUP_STRIDE order), 4 values each:
 * [Q, lean, lip strength at t = group time (1 or 0), 0]: Q so that the
 * crest's k·a·Q is ROGUE_SHARPEN_MAX for a group with `ride: false`, and
 * 0 (with no lean and no lip) for every other group. Pure.
 */
export function rogueLookOf(
  storm: Pick<StormSpec, "groups"> | null | undefined,
  out = new Float32Array(4 * SEA_MAX_GROUPS)
): Float32Array {
  out.fill(0);
  const groups = storm?.groups ?? [];
  const m = Math.min(groups.length, SEA_MAX_GROUPS);
  for (let i = 0; i < m; i += 1) {
    const g = groups[i];
    if (g.ride !== false) continue;
    const w = TWO_PI / g.periodS;
    const k = (w * w) / GRAV;
    const ka = k * (g.heightM / 2);
    out[4 * i] = ka > 0 ? ROGUE_SHARPEN_MAX / ka : 0;
    out[4 * i + 1] = ROGUE_LEAN;
    out[4 * i + 2] = 1;
  }
  return out;
}

/** The breaking lip's strength (0–1) `tau` s after a group's time. */
export function rogueLipAt(tau: number): number {
  const [a, b, c] = ROGUE_LIP_S;
  return smoothstep(a, b, tau) * (1 - smoothstep(b, c, tau));
}

/**
 * Fills `out` for real time t about the mesh's centre (earth x₀, y₀).
 * `look` (`rogueLookOf` of the same storm) adds the rogue wave's look
 * per group; without it (or zeros) every group draws plain. No
 * allocation.
 */
export function packSeaWaves(
  field: WaveFieldArrays,
  t: number,
  x0: number,
  y0: number,
  out: SeaWaves,
  look?: Float32Array
): void {
  const ramp = rampOf(field, t);
  const n = Math.min(field.count, SEA_MAX_WAVES);
  let v = 0;
  for (let i = 0; i < n; i += 1) {
    const k = field.k[i];
    const c = field.dirCos[i];
    const s = field.dirSin[i];
    const a = field.amplitude[i] * ramp;
    v += (a * a) / 2;
    const o = 4 * i;
    out.wave[o] = a;
    out.wave[o + 1] = k * c;
    out.wave[o + 2] = k * s;
    out.wave[o + 3] = wrap(
      k * (x0 * c + y0 * s) - field.omega[i] * t + field.phase[i]
    );
  }
  out.count = n;
  out.hs = 4 * Math.sqrt(v);
  out.meanK = field.meanK;
  const g = field.group;
  const m = Math.min(field.groupCount, SEA_MAX_GROUPS);
  for (let i = 0; i < m; i += 1) {
    const b = i * GROUP_STRIDE;
    const A = g[b];
    const k = g[b + 1];
    const c = g[b + 2];
    const s = g[b + 3];
    const w = g[b + 4];
    const tau = t - g[b + 5];
    const s0 = (x0 - g[b + 6]) * c + (y0 - g[b + 7]) * s;
    const L = g[b + 8];
    const u0 = (s0 - g[b + 9] * tau) / L;
    const o = 4 * i;
    out.groupA[o] = A;
    out.groupA[o + 1] = k * c;
    out.groupA[o + 2] = k * s;
    out.groupA[o + 3] = wrap(k * s0 - w * tau);
    out.groupB[o] = c;
    out.groupB[o + 1] = s;
    // Far from her (more than the mesh's reach past the cutoff): none.
    out.groupB[o + 2] = Math.max(-1e4, Math.min(1e4, u0));
    out.groupB[o + 3] = 1 / L;
    if (look && look[o] > 0) {
      out.groupC[o] = look[o];
      out.groupC[o + 1] = look[o + 1];
      out.groupC[o + 2] = look[o + 2] * rogueLipAt(tau);
      out.groupC[o + 3] = 0;
    } else {
      out.groupC[o] = 0;
      out.groupC[o + 1] = 0;
      out.groupC[o + 2] = 0;
      out.groupC[o + 3] = 0;
    }
  }
  out.groupCount = m;
}

/**
 * The shader's wave function (GLSL): (E, ∂E/∂x, ∂E/∂y) at earth offset d
 * (m) from the mesh's centre. `spacing` is the mesh's vertex spacing there
 * (m): a component too short for it fades out (it would alias). The
 * group's envelope slope is left out of the slope (small: 1/(k·L)).
 * `seaElevationOf` / `seaSlopeOf` are its mirror.
 */
export const SEA_WAVES_GLSL = /* glsl */ `
  uniform vec4 uWave[${SEA_MAX_WAVES}];
  uniform vec4 uGroupA[${SEA_MAX_GROUPS}];
  uniform vec4 uGroupB[${SEA_MAX_GROUPS}];
  uniform int uWaveCount;
  uniform int uGroupCount;
  uniform float uMeanK;
  vec3 seaWave(vec2 d, float spacing) {
    float e = 0.0;
    float h = 0.0;
    vec2 de = vec2(0.0);
    vec2 dh = vec2(0.0);
    for (int i = 0; i < ${SEA_MAX_WAVES}; i++) {
      if (i >= uWaveCount) break;
      vec4 w = uWave[i];
      float fade = 1.0 - smoothstep(1.4, 2.6, length(w.yz) * spacing);
      float a = w.x * fade;
      float p = w.w + dot(w.yz, d);
      float c = cos(p);
      float s = sin(p);
      e += a * c;
      h += a * s;
      de -= a * s * w.yz;
      dh += a * c * w.yz;
    }
    for (int i = 0; i < ${SEA_MAX_GROUPS}; i++) {
      if (i >= uGroupCount) break;
      vec4 ga = uGroupA[i];
      vec4 gb = uGroupB[i];
      float u = gb.z + dot(gb.xy, d) * gb.w;
      if (abs(u) > ${GROUP_CUTOFF.toFixed(1)}) continue;
      float a = ga.x * exp(-0.5 * u * u);
      float p = ga.w + dot(ga.yz, d);
      float c = cos(p);
      float s = sin(p);
      e += a * c;
      h += a * s;
      de -= a * s * ga.yz;
      dh += a * c * ga.yz;
    }
    float E = e + 0.5 * uMeanK * (e * e - h * h);
    vec2 dE = de + uMeanK * (e * de - h * dh);
    return vec3(E, dE);
  }
  // The rogue wave's look (rogueLookOf): for a group with uGroupC.x
  // (its sharpening Q) > 0, the vertex's horizontal shift toward its crest
  // (Gerstner: -k^ Q a sin p) and its crest leaning forward (k^ lean a
  // cos^2 p over the crest), the white lip along the crest, and the
  // surface's squeeze along k^ there (1 - Q k a cos p, never under 0.25:
  // k a Q is capped at ${ROGUE_SHARPEN_MAX}). (0, 0, 0, 1) for every
  // other group: the Fitzgerald's sea is drawn as before. rogueE: its
  // own (linear) height, which the whitecaps leave out (a dark wall).
  uniform vec4 uGroupC[${SEA_MAX_GROUPS}];
  vec4 seaRogue(vec2 d, out float rogueE) {
    vec2 shift = vec2(0.0);
    float lip = 0.0;
    float squeeze = 1.0;
    rogueE = 0.0;
    for (int i = 0; i < ${SEA_MAX_GROUPS}; i++) {
      if (i >= uGroupCount) break;
      vec4 gc = uGroupC[i];
      if (gc.x <= 0.0) continue;
      vec4 ga = uGroupA[i];
      vec4 gb = uGroupB[i];
      float u = gb.z + dot(gb.xy, d) * gb.w;
      if (abs(u) > ${GROUP_CUTOFF.toFixed(1)}) continue;
      float env = exp(-0.5 * u * u);
      float a = ga.x * env;
      float k = length(ga.yz);
      vec2 kh = ga.yz / max(k, 1e-6);
      float p = ga.w + dot(ga.yz, d);
      float c = cos(p);
      float s = sin(p);
      float over = max(c, 0.0);
      rogueE += a * c;
      shift += kh * (gc.y * a * over * over - gc.x * a * s);
      squeeze = min(squeeze, 1.0 - gc.x * k * a * c);
      lip = max(lip, gc.z * env * smoothstep(0.9, 0.99, c) * (0.45 + 0.55 * smoothstep(-0.2, 0.35, s)));
    }
    return vec4(shift, lip, max(squeeze, 0.25));
  }
`;

const f32 = Math.fround;

/** The mirror's sums: e, h and their slopes. */
const acc = new Float64Array(6);

/** GLSL's smoothstep. */
function smoothstep(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/**
 * The shader's fade of a component too short for the mesh's spacing
 * there: 1 − smoothstep(1.4, 2.6, k·spacing) (it would alias).
 */
export function spacingFade(k: number, spacing: number): number {
  return 1 - smoothstep(1.4, 2.6, k * spacing);
}

function sums(w: SeaWaves, dx: number, dy: number, spacing: number): void {
  let e = 0;
  let h = 0;
  let ex = 0;
  let ey = 0;
  let hx = 0;
  let hy = 0;
  const x = f32(dx);
  const y = f32(dy);
  for (let i = 0; i < w.count; i += 1) {
    const o = 4 * i;
    const kx = w.wave[o + 1];
    const ky = w.wave[o + 2];
    const a = w.wave[o] * spacingFade(Math.hypot(kx, ky), spacing);
    const p = f32(w.wave[o + 3] + f32(kx * x + ky * y));
    const c = Math.cos(p);
    const s = Math.sin(p);
    e += a * c;
    h += a * s;
    ex -= a * s * kx;
    ey -= a * s * ky;
    hx += a * c * kx;
    hy += a * c * ky;
  }
  for (let i = 0; i < w.groupCount; i += 1) {
    const o = 4 * i;
    const u =
      w.groupB[o + 2] +
      (w.groupB[o] * x + w.groupB[o + 1] * y) * w.groupB[o + 3];
    if (Math.abs(u) > GROUP_CUTOFF) continue;
    const a = w.groupA[o] * Math.exp(-0.5 * u * u);
    const kx = w.groupA[o + 1];
    const ky = w.groupA[o + 2];
    const p = f32(w.groupA[o + 3] + f32(kx * x + ky * y));
    const c = Math.cos(p);
    const s = Math.sin(p);
    e += a * c;
    h += a * s;
    ex -= a * s * kx;
    ey -= a * s * ky;
    hx += a * c * kx;
    hy += a * c * ky;
  }
  acc[0] = e;
  acc[1] = h;
  acc[2] = ex;
  acc[3] = ey;
  acc[4] = hx;
  acc[5] = hy;
}

/**
 * The shader's surface height (m) at earth offset (dx, dy) from the
 * centre, where the mesh's vertex spacing is `spacing` (m; 0: no fade).
 */
export function seaElevationOf(
  w: SeaWaves,
  dx: number,
  dy: number,
  spacing = 0
): number {
  sums(w, dx, dy, spacing);
  const e = acc[0];
  const h = acc[1];
  return e + 0.5 * w.meanK * (e * e - h * h);
}

/** The shader's surface slope (∂E/∂x, ∂E/∂y) at earth offset (dx, dy). */
export function seaSlopeOf(
  w: SeaWaves,
  dx: number,
  dy: number
): [number, number] {
  sums(w, dx, dy, 0);
  const [e, h, ex, ey, hx, hy] = acc;
  return [ex + w.meanK * (e * ex - h * hx), ey + w.meanK * (e * ey - h * hy)];
}

/**
 * The wind's way on the scene's sea (three x, z unit), into `out`: the
 * components' a²-weighted mean direction (the sea runs before the wind).
 */
export function windOf(
  field: WaveFieldArrays,
  out: { x: number; y: number }
): void {
  let wx = 0;
  let wy = 0;
  for (let i = 0; i < field.count; i += 1) {
    const a2 = field.amplitude[i] * field.amplitude[i];
    wx += a2 * field.dirCos[i];
    wy += a2 * field.dirSin[i];
  }
  const l = Math.hypot(wx, wy) || 1;
  out.x = wx / l;
  out.y = -wy / l;
}
