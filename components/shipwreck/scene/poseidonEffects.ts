import type { QualityTier } from "@/lib/shipwreck/playback";
import type { Opening, ShipSpec } from "@/lib/shipwreck/ships/types";
import { hullHalfBreadth, type HullModel } from "@/lib/shipwreck/sim/geometry";
import type { SimEvent } from "@/lib/shipwreck/sim/events";
import {
  sampleTrack,
  type BodyPose,
  type SimFrame,
  type SimTrack,
} from "@/lib/shipwreck/sim/track";
import { shipToThreeInto, type V3 } from "./cameraMath";
import type { SceneRuntime } from "./runtime";

/**
 * The rogue wave's effects on the Poseidon (spec "The wave on screen",
 * looks only, R10), drawn into the blended points buffer `Effects` owns
 * after the storm's own (`StormEffects`): a sheet of spray thrown up over
 * her as the breaking crest hits her port side (`collision`, once, a few
 * seconds), white water on the sea where she rolled over
 * (`runtime.foamPatch`, which the storm's sea draws), and keel up, air
 * bubbling out of the openings the wave smashed and rising to the
 * surface (from `capsized` until she is under, and a little after). Points
 * in a buffer already drawn: no draw call of their own. Tiered counts;
 * nothing allocates per frame (her collision pose is sampled once a
 * track). Pure of three.js, so the tests run it.
 */

const G = 9.81;

/** How long the spray sheet lives after the hit (shown s). */
export const WAVE_SPRAY_S = 6;
/** The sheet's particles are thrown over this span (s): the crest's run along her. */
const SPRAY_LAUNCH_S = 1.6;

/**
 * Each tier's points: the spray sheet and the rising bubbles (iPads start
 * at medium). The sheet takes the storm spray's own counts (it fires
 * only before her side spray matters).
 */
export const POSEIDON_PARTICLES: Record<
  QualityTier,
  { spray: number; bubbles: number }
> = {
  high: { spray: 2200, bubbles: 420 },
  medium: { spray: 1300, bubbles: 240 },
  low: { spray: 650, bubbles: 120 },
};

/** The rolled-over white water: radius (m) from the hit and its growth. */
const PATCH_R0 = 90;
const PATCH_GROW_MPS = 1.2;
const PATCH_R_MAX = 260;

function hash(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothstep(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

function firstT(events: readonly SimEvent[], kind: string): number | null {
  for (const e of events) if (e.kind === kind) return e.t;
  return null;
}

/**
 * The spray sheet's strength at shown time t (0–1): from the wave's hit
 * (`collision`) for WAVE_SPRAY_S, once; 0 before it, after it, and for a
 * run without one.
 */
export function waveSprayAt(events: readonly SimEvent[], t: number): number {
  const c = firstT(events, "collision");
  if (c === null) return 0;
  const age = t - c;
  if (age < 0 || age > WAVE_SPRAY_S) return 0;
  return smoothstep(0, 0.25, age) * (1 - smoothstep(3.5, WAVE_SPRAY_S, age));
}

/**
 * The white water where she rolled (0–1) at shown time t: from the hit,
 * strong while the wave breaks over her and she rolls, then a churn that
 * thins over the minutes she floats keel up (her air escaping), gone a
 * minute after she is under.
 */
export function rolledFoamAt(events: readonly SimEvent[], t: number): number {
  const c = firstT(events, "collision");
  if (c === null || t < c) return 0;
  const age = t - c;
  const under = firstT(events, "stern-under");
  const gone = under === null ? 1 : 1 - smoothstep(under, under + 60, t);
  return smoothstep(0, 4, age) * (0.3 + 0.7 * Math.exp(-age / 60)) * gone;
}

/** When air bubbles from her openings: from `capsized` to after she is under. */
export function bubblesAt(events: readonly SimEvent[], t: number): number {
  const cap = firstT(events, "capsized");
  if (cap === null || t < cap) return 0;
  const under = firstT(events, "stern-under");
  const fade = under === null ? 1 : 1 - smoothstep(under, under + 40, t);
  return smoothstep(cap, cap + 3, t) * fade;
}

/** What `update` needs each frame (filled in place by the caller). */
export interface PoseidonFrame {
  track: SimTrack;
  frame: SimFrame;
  openings: readonly Opening[];
  t: number;
  wall: number;
  quality: QualityTier;
  camX: number;
  camY: number;
  camZ: number;
  under: boolean;
  /** White things' light now (the storm's, with its night floor). */
  white: number;
  /** Her deck lights' strength now (0 out): the spray catches them. */
  lamps: number;
}

export class PoseidonEffects {
  n = 0;
  /** This frame's points by kind (for the tests and the report). */
  readonly counts = { spray: 0, bubbles: 0 };
  private keyTrack: SimTrack | null = null;
  private hitPose: BodyPose | null = null;
  private hitT = 0;
  private readonly p: V3 = [0, 0, 0];
  private readonly q: V3 = [0, 0, 0];
  private readonly pt = [0, 0, 0];
  private readonly sternX: number;
  private readonly stemX: number;

  constructor(
    private readonly spec: ShipSpec,
    private readonly hull: HullModel,
    private readonly runtime: SceneRuntime,
    private readonly pos: Float32Array,
    private readonly col: Float32Array,
    private readonly size: Float32Array
  ) {
    const xs = spec.stations.map((s) => s.x);
    this.sternX = Math.min(...xs);
    this.stemX = Math.max(...xs);
  }

  private emit(
    x: number,
    y: number,
    z: number,
    r: number,
    g: number,
    b: number,
    a: number,
    size: number
  ) {
    const n = this.n;
    if (n >= this.size.length || a < 0.004) return;
    this.pos[n * 3] = x;
    this.pos[n * 3 + 1] = y;
    this.pos[n * 3 + 2] = z;
    this.col[n * 4] = r;
    this.col[n * 4 + 1] = g;
    this.col[n * 4 + 2] = b;
    this.col[n * 4 + 3] = a;
    this.size[n] = size;
    this.n = n + 1;
  }

  /** Her half-breadth at x, z (the hull's, or her half beam above it). */
  private halfAt(x: number, z: number): number {
    const hb =
      z < this.spec.depth
        ? hullHalfBreadth(this.hull, x, z)
        : this.spec.beam / 2;
    return hb > 0 ? hb : this.spec.beam / 2;
  }

  /**
   * Draws this frame's points from `start` in the buffer; returns the new
   * end. Writes `runtime.foamPatch` (zero strength without a wave).
   */
  update(f: PoseidonFrame, start: number): number {
    this.n = start;
    this.counts.spray = this.counts.bubbles = 0;
    const events = f.track.events;
    if (this.keyTrack !== f.track) {
      this.keyTrack = f.track;
      const c = firstT(events, "collision");
      this.hitT = c ?? 0;
      this.hitPose =
        c === null ? null : { ...sampleTrack(f.track, c).bodies[0] };
    }
    const tier = POSEIDON_PARTICLES[f.quality] ?? POSEIDON_PARTICLES.high;
    const body = f.frame.bodies[0];

    // The white water where she rolled: round her, spreading.
    const fp = this.runtime.foamPatch;
    const foam = rolledFoamAt(events, f.t);
    if (foam > 0 && body) {
      this.pt[0] = 0;
      this.pt[1] = 0;
      this.pt[2] = 0;
      shipToThreeInto(body, this.pt, this.p);
      fp[0] = this.p[0];
      fp[1] = this.p[2];
      fp[2] = Math.min(
        PATCH_R_MAX,
        PATCH_R0 + PATCH_GROW_MPS * (f.t - this.hitT)
      );
      fp[3] = foam;
    } else fp[3] = 0;

    const n0 = this.n;
    if (!f.under) this.spray(f, tier.spray);
    this.counts.spray = this.n - n0;
    const n1 = this.n;
    this.bubbles(f, tier.bubbles);
    this.counts.bubbles = this.n - n1;
    return this.n;
  }

  /**
   * The sheet of spray: the breaking crest running along her port side
   * throws water up her side (to her top decks and over them) and across
   * her to starboard, where the wave goes. Each drop from her port side
   * at the waterline where she was at the hit (earth-fixed: she rolls
   * away under it), ballistic, fading as it falls.
   */
  private spray(f: PoseidonFrame, most: number) {
    const amount = waveSprayAt(f.track.events, f.t);
    const pose = this.hitPose;
    if (amount <= 0 || !pose) return;
    const age = f.t - this.hitT;
    const lo = this.sternX + 8;
    const hi = this.stemX - 12;
    const zw = this.spec.draught + 1;
    for (let k = 0; k < most; k += 1) {
      const born = hash(k, 1) * SPRAY_LAUNCH_S;
      const tau = age - born;
      if (tau < 0) continue;
      const x = lo + (hi - lo) * hash(k, 2);
      const hb = this.halfAt(x, Math.min(zw, this.spec.depth - 0.5));
      // Her port side (ship y +) at the waterline, and across her.
      this.pt[0] = x;
      this.pt[1] = hb + 2;
      this.pt[2] = zw;
      shipToThreeInto(pose, this.pt, this.p);
      this.pt[1] = -hb;
      shipToThreeInto(pose, this.pt, this.q);
      let ax = this.q[0] - this.p[0];
      let az = this.q[2] - this.p[2];
      const l = Math.hypot(ax, az) || 1;
      ax /= l;
      az /= l;
      // Up her side to her top decks (some over them), across to starboard.
      const up = 16 + 22 * hash(k, 3);
      const across = 4 + 14 * hash(k, 4);
      const along = (hash(k, 5) - 0.5) * 6;
      const y = this.p[1] + up * tau - 0.5 * G * tau * tau;
      if (y < this.p[1] - 4) continue;
      const px = this.p[0] + ax * across * tau - az * along * tau;
      const pz = this.p[2] + az * across * tau + ax * along * tau;
      const life = Math.max(0, 1 - tau / (WAVE_SPRAY_S - born));
      const b = (f.white + 0.7 * f.lamps) * (0.9 + 0.3 * hash(k, 6));
      const size = 0.6 + tau * 1.1 + 0.9 * hash(k, 7);
      this.emit(
        px,
        y,
        pz,
        b,
        b * 1.02,
        b * 1.05,
        0.45 * amount * life * this.near(f, px, y, pz, size),
        size
      );
    }
  }

  /**
   * Air bubbling out of the openings the wave smashed, keel up: from each
   * one under the sea, a wobbling column of bubbles rising to the
   * surface; from above the sea, only the fizz where they break it.
   */
  private bubbles(f: PoseidonFrame, most: number) {
    const k0 = bubblesAt(f.track.events, f.t);
    const body = f.frame.bodies[0];
    const ops = f.openings;
    if (k0 <= 0 || !body || ops.length === 0) return;
    const per = Math.max(1, Math.floor(most / ops.length));
    const rt = this.runtime;
    for (let i = 0; i < ops.length; i += 1) {
      const o = ops[i];
      const z = (o.zLow + o.zHigh) / 2;
      const side = o.side === "port" ? 1 : -1;
      this.pt[0] = o.x;
      this.pt[1] = side * this.halfAt(o.x, z);
      this.pt[2] = z;
      shipToThreeInto(body, this.pt, this.p);
      const sx = this.p[0];
      const sy = this.p[1];
      const sz = this.p[2];
      const surf = rt.seaY(sx, sz);
      const depth = surf - sy;
      if (depth <= 0.5) continue;
      // A bubble rises about a metre a second (a look, for a column).
      const life = Math.min(60, depth / 1.0);
      for (let k = 0; k < per; k += 1) {
        const ph = (((f.wall / life + hash(k, i + 61)) % 1) + 1) % 1;
        const y = sy + ph * depth;
        const wob = 0.6 + 1.6 * ph;
        const a = f.wall * 2.1 + k * 1.7;
        const x =
          sx +
          Math.cos(a) * wob * hash(k, i + 62) +
          (hash(k, i + 63) - 0.5) * 3;
        const zz =
          sz +
          Math.sin(a) * wob * hash(k, i + 64) +
          (hash(k, i + 65) - 0.5) * 3;
        const top = y > surf - 1.2;
        if (!f.under && !top) continue;
        const b = top
          ? f.white * 1.4
          : 0.22 + 0.5 * this.lampUnder(f, x, y, zz);
        const size = top
          ? 1.2 + hash(k, i + 66)
          : 0.18 + 0.25 * hash(k, i + 66);
        this.emit(
          x,
          top ? surf + 0.1 : y,
          zz,
          b * 0.85,
          b * 0.95,
          b,
          (top ? 0.5 : 0.6) * k0 * this.near(f, x, y, zz, size),
          size
        );
      }
    }
  }

  /** Close to the lens points fade (they would fill it). */
  private near(
    f: PoseidonFrame,
    x: number,
    y: number,
    z: number,
    size: number
  ): number {
    const far = Math.max(6, 5 * size);
    const d = Math.hypot(x - f.camX, y - f.camY, z - f.camZ);
    return d >= far ? 1 : d <= far / 3 ? 0 : (d - far / 3) / ((2 * far) / 3);
  }

  /** The submersible lamp's light on a point (it rides on the camera). */
  private lampUnder(f: PoseidonFrame, x: number, y: number, z: number): number {
    const dx = x - f.camX;
    const dy = y - f.camY;
    const dz = z - f.camZ;
    return 1 / (1 + (dx * dx + dy * dy + dz * dz) / 6000);
  }
}
