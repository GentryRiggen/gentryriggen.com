import { Vector3, type Group } from "three";
import type { QualityTier } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { hullHalfBreadth, type HullModel } from "@/lib/shipwreck/sim/geometry";
import {
  sampleTrack,
  type BodyPose,
  type SimFrame,
  type SimTrack,
} from "@/lib/shipwreck/sim/track";
import type { WaveFieldArrays } from "@/lib/shipwreck/sim/waves";
import { shipToThreeInto, type V3 } from "./cameraMath";
import type { SceneRuntime } from "./runtime";
import { windOf } from "./seaWaves";
import {
  STORM_NIGHT_WHITE,
  STORM_PARTICLES,
  snowAt,
  stormLightAt,
} from "./storm";

/**
 * The storm's particles (the Fitzgerald), drawn into the blended points
 * buffer `Effects` owns: snow round the camera on the wind (the near
 * flakes streak along it; flakes too small on screen fade out instead of
 * becoming pinpoints: `STORM_MIN_PX`), a far curtain of snow in the
 * squalls (`snowAt`), spray where the sea reaches her deck edge (sampled
 * from the sim's own sea, `runtime.seaY`, along both sides and at her
 * stem, lingering a second after), her funnel's smoke torn forward by the
 * wind, and under the water a plume of grey clay where each of her parts
 * strikes the floor (`bow-lands`, `stern-lands`). Each count is tiered
 * (`STORM_PARTICLES`; iPads start at medium). White things keep a night
 * floor of light (`STORM_NIGHT_WHITE`) and catch her deck lamps
 * (`runtime.lamps`). Nothing allocates per frame.
 */

const G = 9.81;
/** Spray sample points along each side, and the stem's. */
const SIDE_POINTS = 14;
const EMITTERS = SIDE_POINTS * 2 + 1;
const KN = 0.514444;
/** The near snow round the camera, and the far squall curtain (m). */
const SNOW_BOX = 60;
const FAR_BOX = 520;
/**
 * Near flakes within this (m) streak along the wind (about 7% of the
 * near box; `STORM_PARTICLES[tier].streaks` caps them), STREAK_DOTS more
 * points each.
 */
const STREAK_M = 15;
export const STREAK_DOTS = 4;
/** The clay plume's life after a part lands (shown s). */
const PLUME_S = 45;
/** A wave ship's side spray stops past this roll (rad, 40°). */
const WAVE_SPRAY_ROLL = (40 * Math.PI) / 180;

function hash(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** v wrapped into [-B/2, B/2). */
function wrapBox(v: number, B: number): number {
  return (((v % B) + B) % B) - B / 2;
}

/** What `update` needs each frame (filled in place by the caller). */
export interface StormFrame {
  track: SimTrack;
  frame: SimFrame;
  /** Shown time and wall-clock seconds. */
  t: number;
  wall: number;
  dt: number;
  quality: QualityTier;
  /** Her funnel's group (the model's), or null. */
  funnel: Group | null;
  /** The camera (three.js). */
  camX: number;
  camY: number;
  camZ: number;
  /** The camera is under the sea's surface. */
  under: boolean;
  /** Her fires are out (her bow is under): no smoke. */
  firesOut: boolean;
}

export class StormEffects {
  n = 0;
  /** This frame's points by kind (for the tests and the report). */
  readonly counts = { snow: 0, snowFar: 0, spray: 0, smoke: 0, plume: 0 };
  private pool = 0;
  /** Each spray emitter's strength, easing off after the sea falls back. */
  private readonly spray = new Float32Array(EMITTERS);
  private readonly ex = new Float32Array(EMITTERS);
  private readonly ey = new Float32Array(EMITTERS);
  private readonly ez = new Float32Array(EMITTERS);
  private readonly out = new Float32Array(EMITTERS);
  private readonly sx: number[] = [];
  private readonly sy: number[] = [];
  private readonly sz: number[] = [];
  private readonly p: V3 = [0, 0, 0];
  private readonly q: V3 = [0, 0, 0];
  private readonly pt = [0, 0, 0];
  private readonly v = new Vector3();
  /** The wind (three x, z unit), worked out again for another field. */
  private readonly wind = { x: 1, y: 0 };
  private windField: WaveFieldArrays | null = null;
  /** Where each part struck the floor (three x, z) and when, per track. */
  private plumeKey: unknown = null;
  private readonly plumes: { x: number; z: number; t: number }[] = [];

  constructor(
    private readonly spec: ShipSpec,
    hull: HullModel,
    private readonly runtime: SceneRuntime,
    private readonly pos: Float32Array,
    private readonly col: Float32Array,
    private readonly size: Float32Array,
    /**
     * `snow`: the storm's snow (the Fitzgerald's; a clear night has none).
     * `wave`: a wave ship (the Poseidon): her side spray only while she is
     * upright enough for the sea to reach her deck edge from outside (not
     * on her side or keel up, where every edge is under it), and her
     * funnel's smoke only until her lights go out (her diesels stop).
     */
    private readonly opts: { snow: boolean; wave: boolean } = {
      snow: true,
      wave: false,
    }
  ) {
    // Her deck edge each side (ship frame), and her stem.
    const xs = spec.stations.map((s) => s.x);
    const lo = Math.min(...xs) + 6;
    const hi = Math.max(...xs) - 6;
    for (let i = 0; i < SIDE_POINTS; i += 1) {
      const x = lo + ((hi - lo) * (i + 0.5)) / SIDE_POINTS;
      const z = spec.sheerZ(x);
      const y = hullHalfBreadth(hull, x, z - 0.05);
      for (const side of [1, -1]) {
        this.sx.push(x);
        this.sy.push(side * y);
        this.sz.push(z);
      }
    }
    this.sx.push(Math.max(...xs));
    this.sy.push(0);
    this.sz.push(spec.sheerZ(Math.max(...xs)) + 1);
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
    if (n >= this.pool || a < 0.004) return;
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

  /** Her deck lamps' light at a point (0..). */
  private lampAt(x: number, y: number, z: number): number {
    const rt = this.runtime;
    const L = rt.lamps;
    const p = rt.lampPower;
    if (p <= 0) return 0;
    let s = 0;
    for (let i = 0; i < rt.lampCount; i += 1) {
      const dx = x - L[i * 3];
      const dy = y - L[i * 3 + 1];
      const dz = z - L[i * 3 + 2];
      s += 1 / (1 + (dx * dx + dy * dy + dz * dz) / 500);
    }
    return s * p;
  }

  /**
   * Soft particles fade out close to the lens (they would fill it): fully
   * shown from 12 m or five times their size, gone at a third of that.
   */
  private near(
    f: StormFrame,
    x: number,
    y: number,
    z: number,
    size = 0
  ): number {
    const dx = x - f.camX;
    const dy = y - f.camY;
    const dz = z - f.camZ;
    const far = Math.max(12, 5 * size);
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return d >= far ? 1 : d <= far / 3 ? 0 : (d - far / 3) / ((2 * far) / 3);
  }

  /** Draws this frame's storm; returns the particle count. */
  update(f: StormFrame): number {
    this.n = 0;
    const c = this.counts;
    c.snow = c.snowFar = c.spray = c.smoke = c.plume = 0;
    const tier = STORM_PARTICLES[f.quality] ?? STORM_PARTICLES.high;
    this.pool = Math.min(tier.pool, this.size.length);
    const sea = this.runtime.sea;
    const field = sea.field;
    if (!field) return 0;
    if (this.windField !== field) {
      windOf(field, this.wind);
      this.windField = field;
    }
    this.plume(f, tier.plume);
    if (f.under) return this.n;
    const windMs = (sea.storm?.windKn ?? 40) * KN * sea.scale;
    const d = stormLightAt(this.runtime, f.t);
    const light = 0.03 + 0.97 * d;
    // White things keep a floor of light at night (a look: README).
    const white = Math.max(light, STORM_NIGHT_WHITE);
    const body = f.frame.bodies[0];
    // The wind over her: the wind less her way (she runs before it).
    const way =
      f.frame.bodies.length === 1 ? (this.spec.headway?.startMs ?? 0) : 0;
    const relX = this.wind.x * windMs - Math.cos(body.yaw) * way;
    const relZ = this.wind.y * windMs + Math.sin(body.yaw) * way;

    // Spray and smoke first: the snow (thickest in the squall the big
    // seas come in) takes what the pool has left, never their share.
    let n0 = this.n;
    if (
      f.frame.bodies.length === 1 &&
      (!this.opts.wave || Math.abs(body.roll) < WAVE_SPRAY_ROLL)
    )
      this.sprayAt(f, tier.spray, white, relX, relZ);
    c.spray = this.n - n0;
    n0 = this.n;
    this.smoke(f, tier.smoke, light, relX, relZ);
    c.smoke = this.n - n0;
    n0 = this.n;
    if (this.opts.snow)
      this.snow(f, tier.snow, tier.snowFar, tier.streaks, white, windMs);
    c.snow = this.n - n0 - c.snowFar;
    return this.n;
  }

  /**
   * Snow on the wind: soft flakes in a box round the camera (the near ones
   * streak along the wind: motion blur), and in a squall a far curtain of
   * snow, faint and large, so a squall reads in the wide shots.
   */
  private snow(
    f: StormFrame,
    most: number,
    far: number,
    streaks: number,
    white: number,
    windMs: number
  ) {
    let streaked = 0;
    const thick = snowAt(f.t);
    const n = Math.round(most * (0.25 + 0.75 * thick));
    const B = SNOW_BOX;
    const vx = this.wind.x * windMs * 0.55;
    const vz = this.wind.y * windMs * 0.55;
    // A streak covers about a frame's travel (1/30 s) behind the flake.
    const sx = -vx / 60 / 6;
    const sz = -vz / 60 / 6;
    const w = f.wall;
    for (let k = 0; k < n; k += 1) {
      const gust = Math.sin(w * 1.3 + k * 0.7) * 2.5;
      const x = f.camX + wrapBox(hash(k, 41) * B - f.camX + w * vx + gust, B);
      const y =
        f.camY + wrapBox(hash(k, 42) * B - f.camY - w * (1.2 + hash(k, 44)), B);
      const z =
        f.camZ + wrapBox(hash(k, 43) * B - f.camZ + w * vz - gust * 0.5, B);
      const dx = x - f.camX;
      const dy = y - f.camY;
      const dz = z - f.camZ;
      const d2 = dx * dx + dy * dy + dz * dz;
      // Not right on the lens.
      if (d2 < 9) continue;
      const b = 0.45 * white + 1.1 * this.lampAt(x, y, z);
      const size = 0.05 + hash(k, 45) * 0.04;
      this.emit(x, y, z, b, b, b * 1.04, 0.8, size);
      // The nearest flakes streak (within STREAK_M, at most `streaks` of
      // them: each costs four more points).
      if (d2 < STREAK_M * STREAK_M && streaked < streaks) {
        streaked += 1;
        for (let j = 1; j <= STREAK_DOTS; j += 1)
          this.emit(
            x + sx * j,
            y + 0.006 * j,
            z + sz * j,
            b,
            b,
            b * 1.04,
            0.8 * (1 - j / 5),
            size * (1 - j * 0.1)
          );
      }
    }
    // The squall's far curtain: large, faint, only in the snow.
    const farFrom = this.n;
    const m = Math.round(far * Math.min(1, Math.max(0, (thick - 0.2) / 0.6)));
    const F = FAR_BOX;
    for (let k = 0; k < m; k += 1) {
      const x = f.camX + wrapBox(hash(k, 51) * F - f.camX + w * vx, F);
      const y = Math.max(1, f.camY + wrapBox(hash(k, 52) * 120 - w * 1.5, 120));
      const z = f.camZ + wrapBox(hash(k, 53) * F - f.camZ + w * vz, F);
      const dx = x - f.camX;
      const dz = z - f.camZ;
      if (dx * dx + dz * dz < 45 * 45) continue;
      const b = 0.4 * white + 0.6 * this.lampAt(x, y, z);
      this.emit(x, y, z, b, b, b * 1.04, 0.09, 1.4 + hash(k, 54) * 1.4);
    }
    this.counts.snowFar = this.n - farFrom;
  }

  /**
   * Spray where the sea meets her deck edge: each emitter's strength from
   * the sea's height over the edge now (it lingers about a second), a
   * burst thrown up and out and carried down the wind over her.
   */
  private sprayAt(
    f: StormFrame,
    most: number,
    white: number,
    relX: number,
    relZ: number
  ) {
    const body = f.frame.bodies[0];
    const rt = this.runtime;
    const decay = Math.min(1, f.dt / 1.2);
    for (let e = 0; e < EMITTERS; e += 1) {
      this.pt[0] = this.sx[e];
      this.pt[1] = this.sy[e];
      this.pt[2] = this.sz[e];
      shipToThreeInto(body, this.pt, this.p);
      // Just outboard of the edge: where the sea meets her side.
      this.pt[1] = this.sy[e] * 1.08;
      this.pt[2] = this.sz[e] - 1.5;
      shipToThreeInto(body, this.pt, this.q);
      const over = rt.seaY(this.p[0], this.p[2]) - this.p[1];
      const s = Math.min(1, Math.max(0, (over + 1.6) / 2.2));
      this.spray[e] = Math.max(s, this.spray[e] - decay);
      this.ex[e] = this.p[0];
      this.ey[e] = this.p[1];
      this.ez[e] = this.p[2];
      // Outward, across her (three x, z).
      const ox = this.q[0] - this.p[0];
      const oz = this.q[2] - this.p[2];
      const ol = Math.hypot(ox, oz) || 1;
      this.out[e] = Math.atan2(oz / ol, ox / ol);
    }
    const per = Math.floor(most / EMITTERS);
    const life = 1.7;
    for (let e = 0; e < EMITTERS; e += 1) {
      const s = this.spray[e];
      if (s <= 0.02) continue;
      const lamp = this.lampAt(this.ex[e], this.ey[e], this.ez[e]);
      const b = 0.75 * white + 1.2 * lamp;
      const oa = this.out[e];
      for (let k = 0; k < per; k += 1) {
        const ph = (((f.wall / life + hash(k, e + 3)) % 1) + 1) % 1;
        const age = ph * life;
        const up = 3 + 6 * hash(k, e + 7);
        const outV = (1 + 4 * hash(k, e + 11)) * (e === EMITTERS - 1 ? 0.3 : 1);
        const spread = (hash(k, e + 13) - 0.5) * 6;
        const drift = 0.45 * age;
        const x =
          this.ex[e] +
          Math.cos(oa) * outV * age +
          relX * drift +
          spread * Math.sin(oa);
        const y = this.ey[e] - 1 + up * age - 0.5 * G * age * age;
        const z =
          this.ez[e] +
          Math.sin(oa) * outV * age +
          relZ * drift -
          spread * Math.cos(oa);
        const size = 0.9 + age * 1.4;
        const a =
          s * (1 - ph) * (1 - ph) * 0.42 * this.near(f, x, y, z, size * 2);
        this.emit(x, y, z, b, b * 1.02, b * 1.04, a, size);
      }
    }
  }

  /** Her funnel's smoke, torn forward and down by the wind. */
  private smoke(
    f: StormFrame,
    most: number,
    light: number,
    relX: number,
    relZ: number
  ) {
    const funnel = f.funnel;
    if (!funnel || f.firesOut) return;
    const spec = this.spec.funnels[0];
    if (!spec) return;
    funnel.updateMatrixWorld();
    const top = this.v.set(0, spec.topZ - spec.baseZ, 0);
    funnel.localToWorld(top);
    if (top.y < this.runtime.seaY(top.x, top.z) + 0.5) return;
    const life = 3.2;
    const lamp = this.lampAt(top.x, top.y, top.z);
    for (let k = 0; k < most; k += 1) {
      const ph = (((f.wall / life + hash(k, 77)) % 1) + 1) % 1;
      const age = ph * life;
      const spread = 0.6 + age * 1.8;
      const ang = hash(k, 78) * Math.PI * 2;
      const rr = Math.sqrt(hash(k, 79)) * spread;
      const x = top.x + relX * age * 0.75 + Math.cos(ang) * rr;
      const y = top.y + age * (1.4 - age * 0.35) + Math.sin(ang) * rr * 0.4;
      const z = top.z + relZ * age * 0.75 + Math.sin(ang) * rr;
      const fade = (1 - ph) * Math.min(1, ph * 10);
      const b = 0.05 * light + 0.15 * lamp;
      const size = 1.6 + age * 2.6;
      const a = 0.5 * fade * this.near(f, x, y, z, size);
      this.emit(x, y, z, b, b, b * 1.05, a, size);
    }
  }

  /** Where her parts struck the floor, worked out once per track. */
  private landings(track: SimTrack): void {
    const last = track.frames[track.frames.length - 1];
    if (this.plumeKey === last) return;
    this.plumeKey = last;
    this.plumes.length = 0;
    const floor = -this.spec.seaDepthM;
    const xs = this.spec.stations.map((s) => s.x);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    for (const e of track.events) {
      if (e.kind !== "bow-lands" && e.kind !== "stern-lands") continue;
      const part = e.kind === "bow-lands" ? "bow" : "stern";
      const at = sampleTrack(track, e.t);
      const body: BodyPose =
        at.bodies.find((b) => b.part === part) ?? at.bodies[0];
      // Its lowest point (keel or deck: the stern lands upside down).
      let best: V3 | null = null;
      for (let i = 0; i <= 8; i += 1) {
        const x = lo + ((hi - lo) * i) / 8;
        if (track.breakX !== null && (part === "bow") !== x > track.breakX)
          continue;
        for (const z of [0, this.spec.sheerZ(x)]) {
          const w = shipToThreeInto(body, [x, 0, z], [0, 0, 0]);
          if (!best || w[1] < best[1]) best = w;
        }
      }
      if (best && best[1] < floor + 12)
        this.plumes.push({ x: best[0], z: best[2], t: e.t });
    }
  }

  /** A plume of grey clay rising and spreading where each part landed. */
  private plume(f: StormFrame, most: number) {
    if (!f.under) return;
    this.landings(f.track);
    const floor = -this.spec.seaDepthM;
    for (const p of this.plumes) {
      const age = f.t - p.t;
      if (age < 0 || age > PLUME_S) continue;
      const u = age / PLUME_S;
      const grow = 1 - Math.exp(-age / 5);
      const fade = Math.min(1, age / 0.4) * (1 - u) * (1 - u);
      for (let k = 0; k < most / 2; k += 1) {
        const ang = hash(k, 91) * Math.PI * 2;
        const r = Math.sqrt(hash(k, 92)) * (6 + 34 * grow);
        const x = p.x + Math.cos(ang) * r;
        const z = p.z + Math.sin(ang) * r;
        const y = floor + 0.5 + hash(k, 93) * (2 + 12 * grow);
        const b = 0.2 + 0.9 * this.lampUnder(f, x, y, z);
        this.emit(
          x,
          y,
          z,
          b * 0.36,
          b * 0.34,
          b * 0.3,
          0.32 * fade * this.near(f, x, y, z),
          3 + hash(k, 94) * 5 + 4 * grow
        );
      }
    }
  }

  /** The submersible lamp's light on a point (it rides on the camera). */
  private lampUnder(f: StormFrame, x: number, y: number, z: number): number {
    const dx = x - f.camX;
    const dy = y - f.camY;
    const dz = z - f.camZ;
    return 1 / (1 + (dx * dx + dy * dy + dz * dz) / 6000);
  }
}
