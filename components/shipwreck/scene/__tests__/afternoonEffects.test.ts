import { Matrix4, Vector3 } from "three";
import { createTitanicModel } from "@/components/shipwreck/model/shipModel";
import { applyBodyPose } from "@/components/shipwreck/model/pose";
import {
  QUALITY_TIERS,
  createPlaybackStore,
  hitTimeS,
} from "@/lib/shipwreck/playback";
import { recipeFor } from "@/components/shipwreck/model/shipModel";
import { BRITANNIC_BOATS, britannic } from "@/lib/shipwreck/ships/britannic";
import { carpathia, CARPATHIA_BOATS } from "@/lib/shipwreck/ships/carpathia";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { buildHull } from "@/lib/shipwreck/sim/geometry";
import { simulate, torpedoHits, whatIfRealIds } from "@/lib/shipwreck/sim/run";
import { sampleTrack } from "@/lib/shipwreck/sim/track";
import {
  AfternoonEffects,
  boatWreckedAt,
  columnOpen,
  columnOpenAt,
  columnSideY,
  DAY_PARTICLES,
  DAY_ROCKET,
  dayRocketParticles,
  dayRocketShows,
  hasSecondExplosion,
  hitColumnTimes,
  MINE_BOAT_LOWER_S,
  MINE_BOAT_SWING_S,
  mineBoatAt,
  mineBoatHoldUntil,
  mineBoatPoseT,
  rocketFlash,
} from "../afternoonEffects";
import { hasTorpedoTrack } from "../Torpedo";

// jsdom has no 2d canvas: plain textures stand in for the model's.
jest.mock("@/components/shipwreck/model/textures", () => {
  const { Texture: T } = jest.requireActual("three");
  const shared = { plateNormal: new T(), weathering: new T(), planks: new T() };
  return {
    acquireShipTextures: () => ({ ...shared, names: new T(), dispose() {} }),
    releaseShipTextures: () => {},
  };
});

describe("the afternoon's particles per tier", () => {
  it("draws fewer and smaller at medium and low than at high", () => {
    const { high, medium, low } = DAY_PARTICLES;
    for (const tier of [medium, low]) {
      expect(tier.maxPx).toBeLessThan(high.maxPx);
      expect(tier.pool).toBeLessThan(high.pool);
      expect(tier.share).toBeLessThan(high.share);
    }
    expect(low.maxPx).toBeLessThanOrEqual(medium.maxPx);
    expect(low.pool).toBeLessThanOrEqual(medium.pool);
    // The iPad's tiers stay within the night's own cap (96 px).
    expect(medium.maxPx).toBeLessThanOrEqual(96);
    expect(low.maxPx).toBeLessThanOrEqual(96);
    // The high tier keeps the full look.
    expect(high).toEqual({ share: 1, pool: 1800, maxPx: 160 });
    for (const q of QUALITY_TIERS) expect(DAY_PARTICLES[q]).toBeDefined();
  });
});

describe("the torpedo columns' window", () => {
  it("one hit: the first column's 21 s, as before", () => {
    expect(columnOpen(-1, 1)).toBe(false);
    expect(columnOpen(0, 1)).toBe(true);
    expect(columnOpen(20.9, 1)).toBe(true);
    expect(columnOpen(21, 1)).toBe(false);
  });
  it.each([7, 12])("%i hits: the last hit still gets its column", (n) => {
    const last = hitTimeS(n - 1, n);
    expect(columnOpen(last + 20, n)).toBe(true);
    expect(columnOpen(last + 21, n)).toBe(false);
  });
  it("12 hits stretch well past the old 21 s gate", () => {
    expect(columnOpen(hitTimeS(11, 12) + 1, 12)).toBe(true);
    expect(hitTimeS(11, 12)).toBeGreaterThan(21);
  });
});

describe("the Carpathia's hits (Task 6)", () => {
  const real = torpedoHits(carpathia, whatIfRealIds(carpathia));

  it("raises a column at each hit's own time: 9:15 AM twice, 10:50 AM", () => {
    const times = real.map((h) => h.t);
    expect(columnOpenAt(-1, times)).toBe(false);
    expect(columnOpenAt(0, times)).toBe(true);
    expect(columnOpenAt(8 + 20.9, times)).toBe(true);
    expect(columnOpenAt(8 + 21, times)).toBe(false);
    expect(columnOpenAt(3000, times)).toBe(false);
    expect(columnOpenAt(5699, times)).toBe(false);
    expect(columnOpenAt(5700, times)).toBe(true);
    expect(columnOpenAt(5720.9, times)).toBe(true);
    expect(columnOpenAt(5721, times)).toBe(false);
  });

  it("on the side each struck: her port side, the Lusitania's starboard as 1.1", () => {
    expect(columnSideY(carpathia, "port")).toBeCloseTo(10.1, 6);
    expect(columnSideY(lusitania, "starboard")).toBe(-13.6);
  });

  it("wrecks port boats 8 and 10 at the engine-room hit, and only then", () => {
    const flagged = CARPATHIA_BOATS.filter((b) => b.wreckedAtT !== undefined);
    expect(flagged.map((b) => b.label).sort()).toEqual(["10", "8"]);
    // The model's boats carry the flag through to the scene.
    const boats = recipeFor(carpathia).boats;
    const wrecked = boats.filter((b) => boatWreckedAt(b, real) !== null);
    expect(wrecked.map((b) => b.label).sort()).toEqual(["10", "8"]);
    for (const b of wrecked) expect(boatWreckedAt(b, real)).toBe(8);
    // A What if that spares the engine room spares them.
    const boilerOnly = torpedoHits(carpathia, ["boiler"]);
    expect(boats.some((b) => boatWreckedAt(b, boilerOnly) !== null)).toBe(
      false
    );
    // Other ships' boats are never wrecked.
    for (const b of recipeFor(lusitania).boats)
      expect(boatWreckedAt(b, real)).toBeNull();
  });
});

describe("the Britannic's mine (1.4)", () => {
  const track = simulate(britannic, britannic.realNight, {
    portholesOpen: true,
  });
  const blast = track.events.find((e) => e.kind === "explosion")!.t;

  it("is a column at each mine's moment from the explosion, never a torpedo's track", () => {
    expect(hasTorpedoTrack(britannic)).toBe(false);
    expect(hasTorpedoTrack(lusitania)).toBe(true);
    // One mine: one column, at the explosion; nothing before it.
    expect(hitColumnTimes("mine", track.events, 1)).toEqual([blast]);
    // Several What-if mines: each a few seconds after the first.
    expect(hitColumnTimes("mine", track.events, 3)).toEqual([
      blast,
      blast + hitTimeS(1, 3),
      blast + hitTimeS(2, 3),
    ]);
    // The torpedo's are as 1.3 had them (from the hit at 0).
    expect(hitColumnTimes("torpedo", track.events, 2)).toEqual([
      0,
      hitTimeS(1, 2),
    ]);
    // A mine sets off no second explosion inside her.
    expect(hasSecondExplosion(britannic)).toBe(false);
    expect(hasSecondExplosion(lusitania)).toBe(true);
  });

  it("keeps the mine's hits on the playback so the HUD can count them", () => {
    const store = createPlaybackStore({
      createRunner: () =>
        ({
          pump: () => false,
          track: () => track,
          done: () => true,
          progress: () => 1,
        }) as never,
    });
    store.getState().start(britannic, britannic.realNight, { hits: [60, 70] });
    expect(store.getState().hits).toEqual([60, 70]);
    store.getState().start(britannic, britannic.realNight);
    expect(store.getState().hits).toEqual([britannic.realNight[0].x]);
  });
});

describe("the Britannic's boats leaving (R15)", () => {
  const track = simulate(britannic, britannic.realNight, {
    portholesOpen: true,
  });
  const sternX = Math.min(...britannic.stations.map((s) => s.x));
  const lowered = track.events.filter((e) => e.kind === "boat-lowered");

  /** A three.js point in her ship frame at time t (yaw, no list). */
  const inShip = (t: number, p: [number, number]) => {
    const b = sampleTrack(track, t).bodies[0];
    const ex = p[0] - b.x;
    const ey = -p[1] - b.y;
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    return { x: c * ex + s * ey, y: -s * ex + c * ey };
  };

  it("pull out from her side and a little ahead, never aft toward her turning screws", () => {
    expect(lowered.length).toBe(35);
    // They lie off her until she stops at 8:50, then where they are.
    const hold = mineBoatHoldUntil(britannic, track.events);
    expect(hold).toBe((50 - 12) * 60);
    // No profile: at once. A profile that never stops: until the bow lands.
    expect(mineBoatHoldUntil({}, track.events)).toBe(-Infinity);
    const never = { headway: { profile: [[0, 5]] } } as never;
    const bow = track.events.find((e) => e.kind === "bow-lands");
    expect(mineBoatHoldUntil(never, track.events)).toBe(bow?.t);
    expect(mineBoatHoldUntil(never, [])).toBe(Infinity);
    const out: [number, number, number] = [0, 0, 0];
    /** Boat i afloat at t (three x, z), as the scene places it. */
    const place = (i: number, launchT: number, t: number, seenAt = t) => {
      const boat = BRITANNIC_BOATS[i];
      const side = boat.side === "port" ? 1 : -1;
      const slot = BRITANNIC_BOATS.filter(
        (o) => o.index < i && o.x === boat.x && o.side === boat.side
      ).length;
      const pose = sampleTrack(track, mineBoatPoseT(launchT, hold, t))
        .bodies[0];
      mineBoatAt(pose, boat.x, side * 17, boat.side, slot, i, t - launchT, out);
      return inShip(seenAt, [out[0], out[1]]);
    };
    for (const e of lowered) {
      const i = e.index!;
      const side = BRITANNIC_BOATS[i].side === "port" ? 1 : -1;
      const launchT = e.t + MINE_BOAT_SWING_S + MINE_BOAT_LOWER_S;
      // Its own way at launch, in her ship frame: out and not aft.
      const a0 = place(i, launchT, launchT);
      const a1 = place(i, launchT, launchT + 10, launchT);
      expect(a1.x - a0.x).toBeGreaterThanOrEqual(0);
      expect(side * (a1.y - a0.y)).toBeGreaterThan(5);
      // Heading out on its own side, a little ahead.
      const p0 = sampleTrack(track, launchT).bodies[0];
      const rel = out[2] - p0.yaw;
      expect(Math.cos(rel)).toBeGreaterThan(0);
      expect(side * Math.sin(rel)).toBeGreaterThan(0.7);
      // Every 10 s to the end: out on its own side, ever further from
      // her, and well clear of her side wherever her screws pass it.
      let lastAway = -Infinity;
      const end = track.frames[track.frames.length - 1].t;
      // (Until her bow strikes: then she rolls and her origin swings.)
      const under = track.events.find((x) => x.kind === "bow-lands")!.t;
      for (let t = launchT; t <= Math.min(end, under); t += 10) {
        const p = place(i, launchT, t);
        const away = side * p.y;
        expect(away).toBeGreaterThan(britannic.beam / 2);
        // (Her keel, the origin, shifts as she settles and lists: 3 m.)
        expect(away).toBeGreaterThanOrEqual(lastAway - 3);
        lastAway = away;
        if (p.x < sternX + 40) expect(away).toBeGreaterThan(40);
      }
    }
  });
});

describe("the Britannic's boats on the water", () => {
  const track = simulate(britannic, britannic.realNight, {
    portholesOpen: true,
  });
  const lowered = new Map<number, number>();
  for (const e of track.events)
    if (e.kind === "boat-lowered" && e.index !== undefined)
      lowered.set(e.index, e.t);
  const at = (m: number) => (m - 12) * 60;

  /** Every boat afloat at `t` (three x, y, z), playing the morning to it. */
  function afloatAt(t: number) {
    const { handles: h } = createTitanicModel(britannic, {
      quality: "high",
      breakX: null,
    });
    const fx = new AfternoonEffects(
      britannic,
      buildHull(britannic),
      new Float32Array(3 * 2000),
      new Float32Array(4 * 2000),
      new Float32Array(2000)
    );
    const afloat = new Map<number, Vector3>();
    const float = h.boats.float;
    h.boats.float = (i: number, m: Matrix4) => {
      afloat.set(i, new Vector3().setFromMatrixPosition(m));
      float(i, m);
    };
    const frameAt = (tt: number) => {
      const frame = sampleTrack(track, tt);
      applyBodyPose(h.whole, frame.bodies[0]);
      afloat.clear();
      fx.update({
        track,
        frame,
        openings: britannic.realNight,
        t: tt,
        wall: tt,
        dt: 1 / 60,
        snapped: false,
        models: [h],
        visible: h,
        fell: new Map(),
        lowered,
        wakeDx: 1,
        wakeDz: 0,
        wakeAmount: 0.1,
        quality: "high",
      });
      return frame;
    };
    // Played through (each boat seen as it touches the sea), then at t.
    for (let tt = at(25); tt < t; tt += 15) frameAt(tt);
    const frame = frameAt(t);
    return { afloat, pose: frame.bodies[0] };
  }

  it("at 8:45 every boat down by then is afloat, apart, clear of her and near her", () => {
    const t = at(45);
    const { afloat, pose } = afloatAt(t);
    const down = [...lowered].filter(
      ([, tb]) => tb + MINE_BOAT_SWING_S + MINE_BOAT_LOWER_S <= t
    );
    expect(down.length).toBeGreaterThanOrEqual(25);
    // Every launched boat that is down (the inboard Welin boats too).
    expect([...afloat.keys()].sort((a, b) => a - b)).toEqual(
      down.map(([i]) => i).sort((a, b) => a - b)
    );
    const c = Math.cos(pose.yaw);
    const s = Math.sin(pose.yaw);
    const list = [...afloat.values()];
    for (const p of list) {
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
      expect(Math.abs(p.y + 0.35)).toBeLessThan(0.2);
      // In her frame: off her side, and near enough to be in her shots
      // (the boats camera stands 165 m off her side).
      const ex = p.x - pose.x;
      const ey = -p.z - pose.y;
      const sx = c * ex + s * ey;
      const sy = -s * ex + c * ey;
      expect(Math.abs(sy)).toBeGreaterThan(britannic.beam / 2 + 2);
      expect(Math.abs(sy)).toBeLessThan(200);
      expect(Math.abs(sx)).toBeLessThan(220);
    }
    for (let a = 0; a < list.length; a += 1)
      for (let b = a + 1; b < list.length; b += 1)
        expect(
          Math.hypot(list[a].x - list[b].x, list[a].z - list[b].z)
        ).toBeGreaterThan(4);
  });
});

describe("a distress rocket by day (the Carpathia's)", () => {
  function draw(age: number, share = 1, index = 0) {
    const smoke: { y: number; c: number; a: number; size: number }[] = [];
    const pops: { b: number }[] = [];
    dayRocketParticles(age, index, -1.5, -0.25, share, {
      smoke: (_x, y, _z, c, a, size) => smoke.push({ y, c, a, size }),
      pop: (_x, _y, _z, b) => pops.push({ b }),
    });
    return { smoke, pops };
  }
  const top = (ps: { y: number }[]) => Math.max(...ps.map((p) => p.y));

  it("lays a thin smoke trail that climbs as it rises", () => {
    const early = draw(1);
    const at2 = draw(2);
    expect(at2.smoke.length).toBeGreaterThan(early.smoke.length);
    expect(top(at2.smoke)).toBeGreaterThan(top(early.smoke));
    expect(top(at2.smoke)).toBeGreaterThan(100);
    expect(top(at2.smoke)).toBeLessThan(DAY_ROCKET.heightM);
    // Thin and pale grey-white: never dark, never a glowing light.
    for (const p of at2.smoke) {
      expect(p.size).toBeLessThan(5);
      expect(p.c).toBeGreaterThan(0.5);
      expect(p.c).toBeLessThanOrEqual(1);
    }
    expect(at2.pops).toHaveLength(0);
  });

  it("lays the trail close enough to read as one streak at every tier", () => {
    for (const share of [1, 0.55, 0.35]) {
      const heights = draw(3.9, share)
        .smoke.map((p) => p.y)
        .sort((a, b) => a - b);
      // The trail's bits (under the puff's), from the ground up.
      const trail = heights.filter((y) => y < DAY_ROCKET.heightM - 25);
      let widest = 0;
      for (let i = 1; i < trail.length; i += 1)
        widest = Math.max(widest, trail[i] - trail[i - 1]);
      // Under the particles' 3.5 m size: they overlap, no beads.
      expect(widest).toBeLessThan(2.5);
    }
  });

  it("pops briefly at the top, then a puff spreads and fades", () => {
    const pop = draw(4.1);
    expect(pop.pops.length).toBeGreaterThan(0);
    expect(pop.pops.length).toBeLessThanOrEqual(DAY_ROCKET.popN);
    expect(draw(4 + DAY_ROCKET.popS + 0.01).pops).toHaveLength(0);
    expect(DAY_ROCKET.popS).toBeLessThan(0.3);
    // The puff, at the top, with the trail still under it.
    const puff = pop.smoke.filter((p) => p.y > DAY_ROCKET.heightM - 20);
    expect(puff.length).toBeGreaterThan(50);
    const later = draw(12).smoke.filter((p) => p.size > 5);
    expect(later.length).toBeGreaterThan(0);
    const alpha = (age: number) =>
      draw(age).smoke.reduce((sum, p) => sum + p.a, 0);
    expect(alpha(20)).toBeLessThan(alpha(8));
  });

  it("is gone by 25 s, and draws nothing before launch", () => {
    expect(draw(25)).toEqual({ smoke: [], pops: [] });
    expect(draw(-0.1)).toEqual({ smoke: [], pops: [] });
    expect(dayRocketShows(25)).toBe(false);
  });

  it("draws fewer particles at the iPad's tiers", () => {
    const high = draw(6, DAY_PARTICLES.high.share).smoke.length;
    const medium = draw(6, DAY_PARTICLES.medium.share).smoke.length;
    const low = draw(6, DAY_PARTICLES.low.share).smoke.length;
    expect(medium).toBeLessThan(high);
    expect(low).toBeLessThan(medium);
    // Within the medium tier's pool beside her funnel smoke.
    expect(medium).toBeLessThan(DAY_PARTICLES.medium.pool / 4);
  });

  it("never flashes the scene by day; the night's flash is unchanged", () => {
    for (const age of [0, 2, 4, 4.1, 5, 10, 20])
      expect(rocketFlash(age, true)).toBe(0);
    expect(rocketFlash(3.9, false)).toBe(0);
    expect(rocketFlash(4, false)).toBe(1);
    expect(rocketFlash(5, false)).toBeCloseTo(Math.exp(-2.2), 10);
  });
});

describe("riding a davit-less boat by day (the Titanic's collapsibles)", () => {
  const track = simulate(titanic, titanic.realNight);
  /** Collapsible D: no davits of its own. */
  const D = 19;

  function floatsAfter(ride: boolean) {
    const { handles: h } = createTitanicModel(titanic, {
      quality: "low",
      breakX: null,
    });
    expect(h.boats.info(D).hasDavits).toBe(false);
    const fx = new AfternoonEffects(
      titanic,
      buildHull(titanic),
      new Float32Array(3 * 2000),
      new Float32Array(4 * 2000),
      new Float32Array(2000)
    );
    let floated = false;
    const float = h.boats.float;
    h.boats.float = (i: number, m: Matrix4) => {
      if (i === D) floated = true;
      float(i, m);
    };
    const t0 = 3000;
    const lowered = new Map([[D, t0]]);
    for (let t = t0; t <= t0 + 400; t += 20) {
      const frame = sampleTrack(track, t);
      applyBodyPose(h.whole, frame.bodies[0]);
      fx.update({
        track,
        frame,
        openings: titanic.realNight,
        t,
        wall: t,
        dt: 1 / 60,
        snapped: false,
        models: [h],
        visible: h,
        fell: new Map(),
        lowered,
        wakeDx: 1,
        wakeDz: 0,
        wakeAmount: 0,
        quality: "low",
        rideIndex: ride ? D : -1,
      });
    }
    return floated;
  }

  it("the ridden one goes down to the sea and away", () => {
    expect(floatsAfter(true)).toBe(true);
  });

  it("one not ridden stays in its chocks, as before", () => {
    expect(floatsAfter(false)).toBe(false);
  });
});
