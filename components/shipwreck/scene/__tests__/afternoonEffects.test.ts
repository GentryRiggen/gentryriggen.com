import {
  QUALITY_TIERS,
  createPlaybackStore,
  hitTimeS,
} from "@/lib/shipwreck/playback";
import { recipeFor } from "@/components/shipwreck/model/shipModel";
import { BRITANNIC_BOATS, britannic } from "@/lib/shipwreck/ships/britannic";
import { carpathia, CARPATHIA_BOATS } from "@/lib/shipwreck/ships/carpathia";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { simulate, torpedoHits, whatIfRealIds } from "@/lib/shipwreck/sim/run";
import { sampleTrack } from "@/lib/shipwreck/sim/track";
import {
  boatAwayAt,
  boatWreckedAt,
  columnOpen,
  columnOpenAt,
  columnSideY,
  DAY_PARTICLES,
  hasSecondExplosion,
  hitColumnTimes,
  MINE_BOAT_LOWER_S,
  MINE_BOAT_SWING_S,
} from "../afternoonEffects";
import { shipToThree } from "../cameraMath";
import { hasTorpedoTrack } from "../Torpedo";

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
    const out: [number, number] = [0, 0];
    for (const e of lowered) {
      const i = e.index!;
      const boat = BRITANNIC_BOATS[i];
      const side = boat.side === "port" ? 1 : -1;
      const launchT = e.t + MINE_BOAT_SWING_S + MINE_BOAT_LOWER_S;
      const pose = sampleTrack(track, launchT).bodies[0];
      const launch = shipToThree(pose, [boat.x, side * 17, 0]);
      // Its own way at launch, in her ship frame: out and not aft.
      boatAwayAt(launch[0], launch[2], pose.yaw, boat.side, i, 0, out);
      const a0 = inShip(launchT, out);
      boatAwayAt(launch[0], launch[2], pose.yaw, boat.side, i, 10, out);
      const a1 = inShip(launchT, out);
      expect(a1.x - a0.x).toBeGreaterThanOrEqual(0);
      expect(side * (a1.y - a0.y)).toBeGreaterThan(5);
      // Every 10 s to the end: out on its own side, ever further from
      // her, and well clear of her side wherever her screws pass it.
      let lastAway = -Infinity;
      const end = track.frames[track.frames.length - 1].t;
      // (Until her bow strikes: then she rolls and her origin swings.)
      const under = track.events.find((x) => x.kind === "bow-lands")!.t;
      for (let t = launchT; t <= Math.min(end, under); t += 10) {
        boatAwayAt(
          launch[0],
          launch[2],
          pose.yaw,
          boat.side,
          i,
          t - launchT,
          out
        );
        const p = inShip(t, out);
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
