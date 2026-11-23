import { Matrix4, Quaternion, Vector3, type Group } from "three";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import { swungOutY } from "@/components/shipwreck/model/titanicRecipe";
import { hitTimeS, type QualityTier } from "@/lib/shipwreck/playback";
import type { Opening, ShipSpec } from "@/lib/shipwreck/ships/types";
import type { SimTrack as Track } from "@/lib/shipwreck/sim/track";
import type { SimEvent } from "@/lib/shipwreck/sim/events";
import { hullHalfBreadth, type HullModel } from "@/lib/shipwreck/sim/geometry";
import {
  sampleTrack,
  type BodyPose,
  type SimFrame,
  type SimTrack,
} from "@/lib/shipwreck/sim/track";
import { shipToThree, shipToThreeInto, type V3 } from "./cameraMath";
import { torpedoHole } from "./Torpedo";

/**
 * The afternoon's effects (the Lusitania), apart from the night's: coal
 * smoke from four funnels thinning as her steam fails, white steam after
 * the second explosion, the hit's water column, the second explosion, and
 * her boats hanging plumb from their swung-out davits. Everything is drawn
 * into one blended `Points` buffer that `Effects` owns; nothing here
 * allocates per frame (the hit's places are worked out once per run).
 */

const G = 9.81;
/** Sim seconds to swing a boat out, then to lower it (as Effects). */
export const SWING_S = 20;
export const LOWER_S = 120;
const ROW_MPS = 0.7;
/** How far they were lowered for loading, to the Promenade deck (m). */
const LOAD_DROP_M = 2.85;
/** The davit heads stand this far over the boat deck (the model's arms). */
const HEAD_OVER_DECK_M = 4.0;
/** The column and its mist last this long (s); the second explosion's cloud. */
const COLUMN_S = 21;
const EXPLOSION_S = 40;

/**
 * A mine ship's boats (the Britannic's): stowed until their turn, swung
 * out over the side by their davits or gantry, lowered faster than the
 * Lusitania's crews could (calm weather, her boats not yet loaded at the
 * falls), and pulled away from her side and a little ahead.
 */
export const MINE_BOAT_SWING_S = 15;
export const MINE_BOAT_LOWER_S = 60;

/**
 * When each of `n` hits' columns goes up: a torpedo's at its hit (the
 * first at 0); a mine's at the sim's explosion (her blast), the rest of a
 * What-if's mines a few seconds apart after it. Once each.
 */
export function hitColumnTimes(
  cause: ShipSpec["cause"],
  events: Track["events"],
  n: number
): number[] {
  let from = 0;
  if (cause === "mine")
    for (const e of events)
      if (e.kind === "explosion") {
        from = e.t;
        break;
      }
  const out: number[] = [];
  for (let k = 0; k < n; k += 1) out.push(from + hitTimeS(k, n));
  return out;
}

/** The Lusitania's second explosion inside her; a mine has none. */
export function hasSecondExplosion(spec: Pick<ShipSpec, "cause">): boolean {
  return spec.cause !== "mine";
}

/**
 * Where a mine ship's boat is (three x, z into `out`) `age` s after it
 * touched the sea at (x, z): pulling out from her side (`side`) and a
 * little ahead of the beam (her heading as it touched, `yaw`, the sim's
 * earth yaw), never aft toward her turning screws (R15); she, still
 * moving ahead, leaves it astern and well out from her side. Stops
 * 150–400 m out.
 */
export function boatAwayAt(
  x: number,
  z: number,
  yaw: number,
  side: "port" | "starboard" | "centre",
  i: number,
  age: number,
  out: [number, number]
): [number, number] {
  const s = side === "port" ? 1 : -1;
  const ahead = 0.15 + 0.45 * hash(i, 3);
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  // Three axes: her heading (c, -sn), her port side (-sn, -c).
  const dx = Math.cos(ahead) * s * -sn + Math.sin(ahead) * c;
  const dz = Math.cos(ahead) * s * -c + Math.sin(ahead) * -sn;
  const d = Math.min(150 + hash(i, 7) * 250, Math.max(0, age) * ROW_MPS);
  out[0] = x + dx * d;
  out[1] = z + dz * d;
  return out;
}

/** True while any of `n` hits' columns can still be showing at `t`. */
export function columnOpen(t: number, n: number): boolean {
  return n > 0 && t >= hitTimeS(0, n) && t < hitTimeS(n - 1, n) + COLUMN_S;
}
/** Smoke eases to its new strength at this rate (1/s). */
const SMOKE_RATE = 3;

/**
 * The afternoon's particles per quality tier: how many (a share of each
 * effect's count, and a hard pool), and how big one may be on screen
 * (framebuffer px, like the night's 96).
 * Overlapping soft smoke is fill-rate bound, so the tiers an iPad runs at
 * (touch iPads start at medium) draw fewer, smaller ones; the high tier
 * keeps the full look.
 */
export const DAY_PARTICLES: Record<
  QualityTier,
  { share: number; pool: number; maxPx: number }
> = {
  high: { share: 1, pool: 1800, maxPx: 160 },
  medium: { share: 0.55, pool: 1000, maxPx: 96 },
  low: { share: 0.35, pool: 640, maxPx: 64 },
};

function hash(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** What `update` needs each frame (filled in place by the caller). */
export interface AfternoonFrame {
  track: SimTrack;
  frame: SimFrame;
  openings: readonly Opening[];
  /** Each torpedo's hit (ship x, aft first); missing: the first hole's. */
  hits?: readonly number[];
  t: number;
  wall: number;
  dt: number;
  /** True on the frame after a seek (smoke snaps to its strength). */
  snapped: boolean;
  models: readonly TitanicHandles[];
  visible: TitanicHandles | null;
  /** Each funnel's fall time and each boat's lowering time (events). */
  fell: ReadonlyMap<number, number>;
  lowered: ReadonlyMap<number, number>;
  /** Her wake: heading (three x, z) and 0..1 of her starting speed. */
  wakeDx: number;
  wakeDz: number;
  wakeAmount: number;
  /** The render tier (how many particles, see DAY_PARTICLES). */
  quality: QualityTier;
}

interface HitPlace {
  h: V3;
  ox: number;
  oz: number;
}

export class AfternoonEffects {
  /** Particles written this frame. */
  n = 0;
  /** This frame's share of each effect's particles, and the pool. */
  private share = 1;
  private pool = 0;
  private readonly smoke = [1, 1, 1, 1];
  private readonly launchAt = new Map<number, Vector3>();
  private launchTrack: SimTrack | null = null;
  private hitKey: unknown = null;
  private hitAt: HitPlace[] = [];
  private exKey: unknown = null;
  private exAt: (HitPlace & { deck: V3; t: number }) | null = null;
  private readonly holders = new Map<
    Group,
    { qInv: Quaternion; down: Vector3; yaw: number }
  >();
  private readonly spare: {
    qInv: Quaternion;
    down: Vector3;
    yaw: number;
  }[] = [];
  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly head = new Vector3();
  private readonly fwd = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly one = new Vector3(1, 1, 1);
  private readonly q = new Quaternion();
  private readonly qPart = new Quaternion();
  private readonly qBoat = new Quaternion();
  private readonly m = new Matrix4();
  private readonly away: [number, number] = [0, 0];
  private readonly awayEnd: [number, number] = [0, 0];
  /** A mine ship (the Britannic): her boats stowed until lowered. */
  private readonly mine: boolean;
  private readonly swingS: number;
  private readonly lowerS: number;

  constructor(
    private readonly spec: ShipSpec,
    private readonly hull: HullModel,
    private readonly pos: Float32Array,
    private readonly col: Float32Array,
    private readonly size: Float32Array
  ) {
    this.mine = spec.cause === "mine";
    this.swingS = this.mine ? MINE_BOAT_SWING_S : SWING_S;
    this.lowerS = this.mine ? MINE_BOAT_LOWER_S : LOWER_S;
  }

  /** Draws this frame's afternoon; returns the particle count. */
  update(f: AfternoonFrame): number {
    this.n = 0;
    const tier = DAY_PARTICLES[f.quality] ?? DAY_PARTICLES.high;
    this.share = tier.share;
    this.pool = Math.min(tier.pool, this.size.length);
    if (this.launchTrack !== f.track) {
      this.launchTrack = f.track;
      this.launchAt.clear();
    }
    for (const mdl of f.models) this.hangBoats(f, mdl);
    if (f.visible) this.funnelSmoke(f, f.visible);
    if (f.openings.length > 0) this.theHit(f);
    return this.n;
  }

  /** A daylight particle: colour (linear), opacity, size (m). */
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
    if (n >= this.pool || a <= 0.004) return;
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

  /** Earth-down and her heading in a part's own axes, once per frame. */
  private holderFrame(holder: Group) {
    let h = this.holders.get(holder);
    if (h) return h;
    h = this.spare.pop() ?? {
      qInv: new Quaternion(),
      down: new Vector3(),
      yaw: 0,
    };
    holder.getWorldQuaternion(this.qPart);
    h.qInv.copy(this.qPart).invert();
    h.down.set(0, -1, 0).applyQuaternion(h.qInv);
    this.fwd.set(1, 0, 0).applyQuaternion(this.qPart);
    h.yaw = Math.atan2(-this.fwd.z, this.fwd.x);
    this.holders.set(holder, h);
    return h;
  }

  /**
   * Each boat with davits hangs from its swung-out davit heads, plumb
   * (earth-down) as she lists: the starboard boats swing far out from her
   * side, the port boats swing in against the hull. After the hit the crews
   * lowered them to the Promenade deck to load; the six that got away go
   * down to the sea and pull clear. A boat gone under with her is back in
   * its chocks (no falls to hang from).
   */
  private hangBoats(f: AfternoonFrame, mdl: TitanicHandles) {
    const hit = f.openings.length > 0;
    const t = f.t;
    // The parts' matrices once per model (not per boat).
    mdl.root.updateMatrixWorld();
    for (const h of this.holders.values()) this.spare.push(h);
    this.holders.clear();
    let order = 0;
    const swingS = this.swingS;
    const lowerS = this.lowerS;
    for (let i = 0; i < mdl.boats.count; i += 1) {
      const info = mdl.boats.info(i);
      const tb = f.lowered.get(i);
      const age = tb === undefined ? -1 : t - tb;
      // A mine ship's boats wait in their chocks (or gantry) until their
      // turn; a gantry swings its boats out as a davit would.
      if (
        this.mine
          ? age < 0 || (!info.hasDavits && info.gantry === undefined)
          : !info.hasDavits
      ) {
        mdl.boats.stow(i);
        continue;
      }
      if (tb !== undefined && age >= swingS + lowerS) {
        this.floatAway(f, mdl, i, tb, age);
        continue;
      }
      const holder = mdl.boats.holderOf(i);
      const hf = this.holderFrame(holder);
      const side = info.side === "port" ? 1 : -1;
      const headZ = info.deckZ + HEAD_OVER_DECK_M;
      this.head.set(info.x, headZ, -swungOutY(info));
      // Lowered to the Promenade deck to load, from a minute after the hit.
      const k = order++ % 11;
      const load =
        hit && !this.mine
          ? LOAD_DROP_M * Math.min(1, Math.max(0, (t - 70 - k * 18) / 60))
          : 0;
      let fall = headZ - info.z + load;
      if (tb !== undefined && age >= 0) {
        // Down the falls to the sea.
        this.v.copy(this.head).addScaledVector(hf.down, fall);
        this.w.copy(this.v).applyMatrix4(holder.matrixWorld);
        const toSea = Math.max(0, this.w.y + 0.35);
        fall += toSea * Math.max(0, (age - swingS) / lowerS);
      }
      this.v.copy(this.head).addScaledVector(hf.down, fall);
      if (this.mine && age < swingS) {
        // Swinging out from where it was stowed.
        const u = age / swingS;
        const e = u * u * (3 - 2 * u);
        this.v.set(
          info.x + (this.v.x - info.x) * e,
          info.z + (this.v.y - info.z) * e,
          -info.y + (this.v.z + info.y) * e
        );
      }
      this.w.copy(this.v).applyMatrix4(holder.matrixWorld);
      if (this.w.y < -2) {
        mdl.boats.stow(i);
        continue;
      }
      // Against her side, never into it (ship frame y = -three z).
      const z = this.v.y;
      const sheer = this.spec.sheerZ(info.x);
      const sideY =
        Math.max(
          Math.abs(info.edgeY) + 0.15,
          hullHalfBreadth(this.hull, info.x, Math.min(z, sheer))
        ) +
        info.beam / 2 +
        0.1;
      let against = false;
      if (side * -this.v.z < sideY) {
        this.v.z = -side * sideY;
        against = true;
      }
      // Level with the sea, turned with her heading; pressed to her side,
      // a boat leans with her a little.
      this.qBoat.setFromAxisAngle(this.up, hf.yaw);
      this.q.copy(hf.qInv).multiply(this.qBoat);
      if (against) this.q.slerp(this.qBoat.identity(), 0.5);
      mdl.boats.hang(i, this.v, this.q);
    }
  }

  /** A boat that got away: where it touched the sea, then pulling clear. */
  private floatAway(
    f: AfternoonFrame,
    mdl: TitanicHandles,
    i: number,
    tb: number,
    age: number
  ) {
    const info = mdl.boats.info(i);
    let start = this.launchAt.get(i);
    if (!start) {
      const at = sampleTrack(f.track, tb + this.swingS + this.lowerS).bodies[0];
      const w = shipToThree(at, [info.x, swungOutY(info) * 1.15, info.z]);
      // (w carries her yaw then in its fourth slot for a mine ship's boat.)
      start = new Vector3(w[0], at.yaw, w[2]);
      this.launchAt.set(i, start);
    }
    if (this.mine) {
      // Out from her side and a little ahead, never toward her screws.
      const age2 = age - this.swingS - this.lowerS;
      const p = boatAwayAt(
        start.x,
        start.z,
        start.y,
        info.side,
        i,
        age2,
        this.away
      );
      const q = boatAwayAt(
        start.x,
        start.z,
        start.y,
        info.side,
        i,
        1e6,
        this.awayEnd
      );
      const bob = Math.sin(f.wall * 0.9 + i) * 0.05;
      this.q.setFromAxisAngle(
        this.up,
        Math.atan2(-(q[1] - start.z), q[0] - start.x)
      );
      this.m.compose(this.v.set(p[0], -0.35 + bob, p[1]), this.q, this.one);
      mdl.boats.float(i, this.m);
      return;
    }
    const sideZ = info.side === "port" ? -1 : 1;
    const fan = (hash(i, 3) - 0.5) * 1.2;
    const dir = this.w
      .set(Math.sin(fan) * 0.6 - 0.3, 0, sideZ * Math.cos(fan))
      .normalize();
    const far = 150 + hash(i, 7) * 250;
    const d = Math.min(far, (age - SWING_S - LOWER_S) * ROW_MPS);
    const bob = Math.sin(f.wall * 0.9 + i) * 0.05;
    this.q.setFromAxisAngle(this.up, Math.atan2(-dir.z, dir.x));
    this.m.compose(
      this.v.set(start.x + dir.x * d, -0.35 + bob, start.z + dir.z * d),
      this.q,
      this.one
    );
    mdl.boats.float(i, this.m);
  }

  /**
   * Coal smoke from all four funnels, trailing aft on the wind of her way
   * and thinning as her steam fails (her headway's half-life); white steam
   * blowing off after the second explosion. Stops as each funnel falls or
   * goes under.
   */
  private funnelSmoke(f: AfternoonFrame, mdl: TitanicHandles) {
    const t = f.t;
    const hit = f.openings.length > 0;
    const half = this.spec.headway?.halfLifeS ?? 300;
    // A ship on a speed profile (the Britannic): her smoke thins with her
    // speed (her track's, the sim's `speedAt`), the fires still lit.
    const steamFails = this.spec.headway?.profile
      ? 0.25 + 0.75 * f.wakeAmount
      : hit && t > 0
        ? 0.18 + 0.82 * Math.exp((-t * Math.LN2) / half)
        : 1;
    const rel = 1.5 + 9.3 * f.wakeAmount;
    const ease = f.snapped ? 1 : 1 - Math.exp(-f.dt * SMOKE_RATE);
    let ex: number | undefined;
    for (const e of f.track.events)
      if (e.kind === "explosion") {
        ex = e.t;
        break;
      }
    const wall = f.wall;
    for (let i = 0; i < mdl.funnels.length; i += 1) {
      const fg = mdl.funnels[i];
      const data = this.spec.funnels[i];
      if (!fg || !data) continue;
      const fallen = f.fell.has(i) && t >= (f.fell.get(i) ?? 0);
      // (Its matrix is current: hangBoats updated the model this frame.)
      const top = this.v.set(-0.6, data.topZ - data.baseZ - 0.3, 0);
      fg.localToWorld(top);
      const alive = !fallen && top.y > 0.5 && !data.dummy;
      const target = alive ? steamFails : 0;
      this.smoke[i] += (target - this.smoke[i]) * ease;
      const strength = this.smoke[i];
      if (strength < 0.01) continue;
      const LIFE = 22;
      const smokeN = Math.round(70 * this.share);
      for (let k = 0; k < smokeN; k += 1) {
        const a = (((wall / LIFE + hash(k, i + 40)) % 1) + 1) % 1;
        const age = a * LIFE;
        const spread = 1.2 + age * 0.9;
        const ang = hash(k, i + 49) * Math.PI * 2;
        const rr = Math.sqrt(hash(k, i + 57)) * spread;
        const back = rel * age;
        const fade = Math.pow(1 - a, 1.3) * Math.min(1, a * 45);
        const lit = Math.min(1, age / 14);
        this.emit(
          top.x - f.wakeDx * back + Math.cos(ang) * rr,
          top.y + 2.4 * Math.pow(age, 0.72) + Math.sin(ang) * rr * 0.5,
          top.z - f.wakeDz * back + Math.sin(ang) * rr - age * 0.25,
          0.05 + 0.22 * lit,
          0.047 + 0.22 * lit,
          0.045 + 0.23 * lit,
          0.7 * fade * strength,
          3 + age * 1.5
        );
      }
      // Steam blowing off (after the second explosion), white.
      if (!hit || ex === undefined || t < ex || !alive || this.mine) continue;
      const steam = Math.exp(-(t - ex) / 200);
      const steamN = Math.round(24 * this.share);
      for (let k = 0; k < steamN && steam > 0.02; k += 1) {
        const a = (((wall / 6 + hash(k, i + 70)) % 1) + 1) % 1;
        const age = a * 6;
        this.emit(
          top.x + 2.2 - f.wakeDx * rel * age * 0.6 + (hash(k, i + 3) - 0.5) * 3,
          top.y + 1 + age * 6 * (1 - a * 0.4),
          top.z - f.wakeDz * rel * age * 0.6 + (hash(k, i) - 0.5) * age * 2,
          0.9,
          0.9,
          0.92,
          0.3 * (1 - a) * Math.min(1, a * 20) * steam,
          3 + age * 2.6
        );
      }
    }
  }

  /** Where a hole was on the sea at time `at` (three), and out from her. */
  private placeAt(track: SimTrack, at: number, x: number): HitPlace {
    const pose: BodyPose = sampleTrack(track, at).bodies[0];
    // A mine at her starboard side at the waterline (the Lusitania's 1.1
    // numbers otherwise).
    const y = this.mine ? -(this.spec.beam / 2 + 0.3) : -13.6;
    const z = this.mine ? this.spec.draught : 9.3;
    const h = shipToThree(pose, [x, y, z]);
    const o = shipToThree(pose, [x, y - 1, z]);
    const ol = Math.hypot(o[0] - h[0], o[2] - h[2]) || 1;
    return { h, ox: (o[0] - h[0]) / ol, oz: (o[2] - h[2]) / ol };
  }

  /**
   * The hit, at the first moment, where the torpedo struck: a column of
   * white water and coal-black spray higher than her funnels, falling back
   * as she steams on (more than one hit: a column each, the first at the
   * hit and the rest a few seconds after it as the sim opens them, each
   * where her side was then, sharing the particles); then,
   * moments later, the second explosion lower down inside her, a wider
   * burst at her side and a cloud of coal dust and steam out of her
   * forward decks (its cause is not shown). Only while they last; their
   * places are worked out once per run.
   */
  private theHit(f: AfternoonFrame) {
    const t = f.t;
    const track = f.track;
    const hole = f.hits && f.hits.length > 0 ? null : torpedoHole(f.openings);
    const hits = f.hits && f.hits.length > 0 ? f.hits : hole ? [hole.x] : [];
    const n = hits.length;
    if (this.mine) this.mineColumns(f, hits);
    else if (columnOpen(t, n)) {
      const key = track.frames[0];
      if (this.hitKey !== key || this.hitAt.length !== n) {
        // Each where her side was as it struck (kept once the track has
        // reached the last hit).
        const last = track.frames[track.frames.length - 1].t;
        this.hitKey = last >= hitTimeS(n - 1, n) ? key : null;
        this.hitAt = hits.map((x, k) => this.placeAt(track, hitTimeS(k, n), x));
      }
      // One hit: the 1.1 column; more share them.
      const count = Math.round(460 / Math.sqrt(n));
      for (let k = 0; k < n; k += 1)
        this.burst(
          this.hitAt[k],
          t - hitTimeS(k, n),
          count,
          22,
          16,
          2,
          7,
          0.14,
          1
        );
    }
    if (!hasSecondExplosion(this.spec)) return;
    let ex: SimEvent | undefined;
    for (const e of track.events)
      if (e.kind === "explosion") {
        ex = e;
        break;
      }
    if (!ex || t < ex.t || t - ex.t >= EXPLOSION_S) return;
    let inside: Opening | undefined;
    for (const op of f.openings)
      if ((op.t ?? 0) > 0) {
        inside = op;
        break;
      }
    if (!inside) return;
    const key = track.frames[0];
    if (this.exKey !== key || !this.exAt || this.exAt.t !== ex.t) {
      this.exKey = key;
      const p = this.placeAt(track, ex.t, inside.x);
      const pose = sampleTrack(track, ex.t).bodies[0];
      this.exAt = {
        ...p,
        deck: shipToThree(pose, [inside.x - 4, 0, 24]),
        t: ex.t,
      };
    }
    const at = this.exAt;
    const age = t - ex.t;
    this.burst(at, age, 300, 9, 12, 4, 7, 0.3, 1.4);
    // Coal dust and steam boiling up out of her forward decks.
    const p = at.deck;
    const cloudN = Math.round(190 * this.share);
    for (let k = 0; k < cloudN; k += 1) {
      const a2 = age - hash(k, 81) * 3;
      if (a2 < 0) continue;
      const life = 22 + hash(k, 82) * 14;
      if (a2 > life) continue;
      const u = a2 / life;
      const ang = hash(k, 83) * Math.PI * 2;
      const r = (2 + a2 * 1.1) * Math.sqrt(hash(k, 84));
      const rise = 30 * (1 - Math.exp(-a2 / 4)) + a2 * 0.8;
      const steamy = hash(k, 85) < 0.4;
      const c = steamy ? 0.82 : 0.07 + 0.18 * u;
      this.emit(
        p[0] + Math.cos(ang) * r - a2 * 0.8,
        p[1] + rise * (0.6 + 0.8 * hash(k, 86)),
        p[2] + Math.sin(ang) * r,
        c,
        c,
        c * (steamy ? 1.03 : 0.95),
        (steamy ? 0.45 : 0.65) * (1 - u) * Math.min(1, a2 * 3),
        4 + a2 * 1.2
      );
    }
    // A brief flash low at her side (bright enough to bloom).
    if (age < 0.5) {
      const fl = 1 - age / 0.5;
      for (let k = 0; k < 20; k += 1)
        this.emit(
          at.h[0] + (hash(k, 91) - 0.5) * 8,
          1 + hash(k, 92) * 6,
          at.h[2] + hash(k, 93) * 4,
          9,
          5,
          2,
          fl,
          4
        );
    }
  }

  /**
   * A mine's column at her starboard bow: white water thrown higher than
   * her funnels and a drifting mist, once per mine (`hitColumnTimes`), no
   * track and no second explosion. Its place is worked out once per run.
   */
  private mineColumns(f: AfternoonFrame, hits: readonly number[]) {
    const n = hits.length;
    if (n === 0) return;
    const times = this.mineTimes(f.track, n);
    const t = f.t;
    if (t < times[0] || t >= times[n - 1] + COLUMN_S) return;
    // Each at her starboard side by its hole as she is now: the column
    // rides with her while it stands (a look: thrown up at 20 knots, the
    // real spray fell astern of the hole), so it reads where the mine hit.
    while (this.mineAtNow.length < n)
      this.mineAtNow.push({ h: [0, 0, 0], ox: 0, oz: 0 });
    const pose = f.frame.bodies[0];
    const y = -(this.spec.beam / 2 + 0.3);
    const z = this.spec.draught;
    const count = Math.round(560 / Math.sqrt(n));
    for (let k = 0; k < n; k += 1) {
      const at = this.mineAtNow[k];
      this.pt[0] = hits[k];
      this.pt[1] = y;
      this.pt[2] = z;
      shipToThreeInto(pose, this.pt, at.h);
      this.pt[1] = y - 1;
      shipToThreeInto(pose, this.pt, this.ptOut);
      const ol =
        Math.hypot(this.ptOut[0] - at.h[0], this.ptOut[2] - at.h[2]) || 1;
      at.ox = (this.ptOut[0] - at.h[0]) / ol;
      at.oz = (this.ptOut[2] - at.h[2]) / ol;
      this.burst(at, t - times[k], count, 26, 20, 3, 8, 0.05, 1.3);
    }
  }

  private readonly mineAtNow: HitPlace[] = [];
  private readonly pt: [number, number, number] = [0, 0, 0];
  private readonly ptOut: V3 = [0, 0, 0];
  private mineKey: unknown = null;
  private mineN = 0;
  private mineAt: number[] = [];
  /** `hitColumnTimes` for a mine, kept per track (no allocation per frame). */
  private mineTimes(track: SimTrack, n: number): number[] {
    if (this.mineKey !== track.events || this.mineN !== n) {
      this.mineKey = track.events;
      this.mineN = n;
      this.mineAt = hitColumnTimes("mine", track.events, n);
    }
    return this.mineAt;
  }

  /** A column of water thrown up at a hole, `age` s ago. */
  private burst(
    at: HitPlace,
    age: number,
    count: number,
    up0: number,
    upVar: number,
    out0: number,
    outVar: number,
    darkShare: number,
    mist: number
  ) {
    if (age < 0 || age > COLUMN_S) return;
    const { h, ox, oz } = at;
    const sprayN = Math.round(count * this.share);
    for (let k = 0; k < sprayN; k += 1) {
      const a = age - hash(k, 11) * 0.35;
      if (a < 0) continue;
      const vy = up0 + upVar * hash(k, 12);
      const vo = out0 + outVar * hash(k, 13);
      const va = (hash(k, 14) - 0.5) * 6;
      const drag = (1 - Math.exp(-a * 0.8)) / 0.8;
      const y = vy * drag - 0.5 * G * a * a * 0.85;
      if (y < -0.5) continue;
      const dark = hash(k, 15) < darkShare;
      const c = dark ? 0.12 : 0.9;
      this.emit(
        h[0] + ox * vo * drag + va * drag * 0.4,
        Math.max(0.2, y),
        h[2] + oz * vo * drag + va * drag * 0.4,
        c,
        c,
        c * 1.02,
        Math.min(1, 6 - a) * 0.85,
        (dark ? 1.4 : 2.2 + 2.5 * hash(k, 16)) * (1 + a * 0.35)
      );
    }
    // The spray hanging and drifting after the column falls.
    const mistN = Math.round(110 * this.share);
    for (let k = 0; k < mistN; k += 1) {
      const a = age - 0.8 - hash(k, 17) * 1.5;
      if (a < 0) continue;
      const u = a / 18;
      if (u > 1) continue;
      const ang = hash(k, 18) * Math.PI * 2;
      const r = (4 + a * 1.6) * Math.sqrt(hash(k, 19));
      const y = (up0 + upVar * 0.5) * 1.3 * hash(k, 20) * (1 - u * 0.5);
      this.emit(
        h[0] + Math.cos(ang) * r + ox * a * 0.8,
        Math.max(1, y),
        h[2] + Math.sin(ang) * r + oz * a * 0.8,
        0.88,
        0.9,
        0.92,
        0.32 * mist * (1 - u) * Math.min(1, a * 2),
        8 + a * 2.2
      );
    }
  }
}
