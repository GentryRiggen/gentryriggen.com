import { Matrix4, Quaternion, Vector3, type Group } from "three";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import { swungOutY } from "@/components/shipwreck/model/titanicRecipe";
import type { Opening, ShipSpec } from "@/lib/shipwreck/ships/types";
import type { SimEvent } from "@/lib/shipwreck/sim/events";
import { hullHalfBreadth, type HullModel } from "@/lib/shipwreck/sim/geometry";
import {
  sampleTrack,
  type BodyPose,
  type SimFrame,
  type SimTrack,
} from "@/lib/shipwreck/sim/track";
import { shipToThree, type V3 } from "./cameraMath";
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
/** Smoke eases to its new strength at this rate (1/s). */
const SMOKE_RATE = 3;

function hash(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** What `update` needs each frame (filled in place by the caller). */
export interface AfternoonFrame {
  track: SimTrack;
  frame: SimFrame;
  openings: readonly Opening[];
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
}

interface HitPlace {
  h: V3;
  ox: number;
  oz: number;
}

export class AfternoonEffects {
  /** Particles written this frame. */
  n = 0;
  private readonly smoke = [1, 1, 1, 1];
  private readonly launchAt = new Map<number, Vector3>();
  private launchTrack: SimTrack | null = null;
  private hitKey: unknown = null;
  private hitAt: HitPlace | null = null;
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

  constructor(
    private readonly spec: ShipSpec,
    private readonly hull: HullModel,
    private readonly pos: Float32Array,
    private readonly col: Float32Array,
    private readonly size: Float32Array
  ) {}

  /** Draws this frame's afternoon; returns the particle count. */
  update(f: AfternoonFrame): number {
    this.n = 0;
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
    if (n * 4 >= this.col.length || a <= 0.004) return;
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
    for (let i = 0; i < mdl.boats.count; i += 1) {
      const info = mdl.boats.info(i);
      if (!info.hasDavits) {
        mdl.boats.stow(i);
        continue;
      }
      const tb = f.lowered.get(i);
      const age = tb === undefined ? -1 : t - tb;
      if (tb !== undefined && age >= SWING_S + LOWER_S) {
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
      const load = hit
        ? LOAD_DROP_M * Math.min(1, Math.max(0, (t - 70 - k * 18) / 60))
        : 0;
      let fall = headZ - info.z + load;
      if (tb !== undefined && age >= 0) {
        // Down the falls to the sea.
        this.v.copy(this.head).addScaledVector(hf.down, fall);
        this.w.copy(this.v).applyMatrix4(holder.matrixWorld);
        const toSea = Math.max(0, this.w.y + 0.35);
        fall += toSea * Math.max(0, (age - SWING_S) / LOWER_S);
      }
      this.v.copy(this.head).addScaledVector(hf.down, fall);
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
      const at = sampleTrack(f.track, tb + SWING_S + LOWER_S).bodies[0];
      const w = shipToThree(at, [info.x, swungOutY(info) * 1.15, info.z]);
      start = new Vector3(w[0], -0.35, w[2]);
      this.launchAt.set(i, start);
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
    const steamFails =
      hit && t > 0 ? 0.18 + 0.82 * Math.exp((-t * Math.LN2) / half) : 1;
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
      fg.updateMatrixWorld();
      const top = this.v.set(-0.6, data.topZ - data.baseZ - 0.3, 0);
      fg.localToWorld(top);
      const alive = !fallen && top.y > 0.5 && !data.dummy;
      const target = alive ? steamFails : 0;
      this.smoke[i] += (target - this.smoke[i]) * ease;
      const strength = this.smoke[i];
      if (strength < 0.01) continue;
      const LIFE = 22;
      for (let k = 0; k < 70; k += 1) {
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
      if (!hit || ex === undefined || t < ex || !alive) continue;
      const steam = Math.exp(-(t - ex) / 200);
      for (let k = 0; k < 24 && steam > 0.02; k += 1) {
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
    const h = shipToThree(pose, [x, -13.6, 9.3]);
    const o = shipToThree(pose, [x, -14.6, 9.3]);
    const ol = Math.hypot(o[0] - h[0], o[2] - h[2]) || 1;
    return { h, ox: (o[0] - h[0]) / ol, oz: (o[2] - h[2]) / ol };
  }

  /**
   * The hit, at the first moment, where the torpedo struck: a column of
   * white water and coal-black spray higher than her funnels, falling back
   * as she steams on; then, moments later, the second explosion lower down
   * inside her, a wider burst at her side and a cloud of coal dust and
   * steam out of her forward decks (its cause is not shown). Only while
   * they last; their places are worked out once per run.
   */
  private theHit(f: AfternoonFrame) {
    const t = f.t;
    const track = f.track;
    if (t >= 0 && t < COLUMN_S) {
      const hole = torpedoHole(f.openings);
      const key = track.frames[0];
      if (hole && (this.hitKey !== key || !this.hitAt)) {
        this.hitKey = key;
        this.hitAt = this.placeAt(track, 0, hole.x);
      }
      if (hole && this.hitAt)
        this.burst(this.hitAt, t, 460, 22, 16, 2, 7, 0.14, 1);
    }
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
    for (let k = 0; k < 190; k += 1) {
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
    for (let k = 0; k < count; k += 1) {
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
    for (let k = 0; k < 110; k += 1) {
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
