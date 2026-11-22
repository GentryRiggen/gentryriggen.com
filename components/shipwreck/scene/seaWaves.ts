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

/**
 * Fills `out` for real time t about the mesh's centre (earth x₀, y₀).
 * No allocation.
 */
export function packSeaWaves(
  field: WaveFieldArrays,
  t: number,
  x0: number,
  y0: number,
  out: SeaWaves
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
