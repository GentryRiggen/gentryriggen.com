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
  hasSecondExplosion,
  hitColumnTimes,
  MINE_BOAT_LOWER_S,
  MINE_BOAT_SWING_S,
  mineBoatAt,
  mineBoatHoldUntil,
  mineBoatPoseT,
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
