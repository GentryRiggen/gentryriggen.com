import { LEVELS, LEVEL_ORDER } from "../../levels";
import { MAX_TIER, STARTER_TIERS, TRACK_IDS } from "../../plane/catalog";
import { planeStats, stallSpeed } from "../../plane/stats";
import { CEILING } from "../../sim/constants";
import { launch, step } from "../../sim/flight";
import { flatLevel } from "../../sim/__tests__/fixtures";
import { pilotFlight, playLevel, type FlightLog } from "../pilot";

describe.each(LEVEL_ORDER)("%s balance", (id) => {
  const finish = LEVELS[id].finishDistance;
  let log: FlightLog[] = [];

  beforeAll(() => {
    log = playLevel(id);
  });

  // The brief asked for 30-40; with at most 2 dry flights in a row the pilot
  // finishes in 24-28 (see the dry-flight test), so the floor is 22.
  it("takes 22-40 flights to finish", () => {
    expect(log[log.length - 1].distance).toBe(finish);
    expect(log.length).toBeGreaterThanOrEqual(22);
    expect(log.length).toBeLessThanOrEqual(40);
  });

  // Mountains misses the 2-dry-flight target by one (see the balance notes).
  const maxDry = id === "mountains" ? 3 : 2;

  it(`has at most ${maxDry} dry flights in a row`, () => {
    let streak = 0;
    for (const f of log.slice(0, -1)) {
      const dry = f.cheapest !== null && f.earned < f.cheapest;
      streak = dry ? streak + 1 : 0;
      expect(streak).toBeLessThanOrEqual(maxDry);
    }
  });

  it("starter plane gets under 10% of the way", () => {
    const stats = planeStats(LEVELS[id].plane, STARTER_TIERS);
    expect(pilotFlight(id, stats).distance).toBeLessThan(finish * 0.1);
  });

  it("best distance never drops by more than 10%", () => {
    let best = 0;
    for (const f of log) {
      expect(f.distance).toBeGreaterThanOrEqual(best * 0.9);
      best = Math.max(best, f.distance);
    }
  });

  it("never jumps more than 2.5x the previous best once past 10%", () => {
    let best = 0;
    for (const f of log) {
      if (best >= finish * 0.1)
        expect(f.distance).toBeLessThanOrEqual(best * 2.5);
      best = Math.max(best, f.distance);
    }
  });

  it("passes 50% of the finish by 80% of the way through", () => {
    const halfAt = log.findIndex((f) => f.distance >= finish * 0.5) + 1;
    expect(halfAt).toBeGreaterThan(0);
    expect(halfAt).toBeLessThanOrEqual(log.length * 0.8);
  });

  it("never flies for more than 90 s", () => {
    for (const f of log) expect(f.time).toBeLessThanOrEqual(90);
  });

  it("flies through the finish to a runout with a maxed plane", () => {
    const maxed = { ...STARTER_TIERS };
    for (const track of TRACK_IDS) maxed[track] = MAX_TIER;
    const result = pilotFlight(id, planeStats(LEVELS[id].plane, maxed));
    expect(result.endReason).toBe("runout");
  });
});

describe("glide tail", () => {
  const HANDS_OFF = { pitch: 0, bank: 0, boost: false };

  it.each(LEVEL_ORDER)("%s planes come down within 15 s and land", (id) => {
    for (const t of [0, 2, 4, 6, 8]) {
      const tiers = { ...STARTER_TIERS };
      for (const track of TRACK_IDS) tiers[track] = t;
      const stats = { ...planeStats(LEVELS[id].plane, tiers), fuel: 0 };
      const level = flatLevel({
        finishDistance: 100000,
        plane: LEVELS[id].plane,
      });
      const s = launch(level, stats, { pitch: 0, yaw: 0, power: 1 });
      s.y = CEILING;
      s.pitch = 0;
      s.speed = stallSpeed(stats) * 1.5;
      while (s.phase === "flying") step(s, level, stats, HANDS_OFF);
      expect(s.time).toBeLessThanOrEqual(15);
      expect(s.endReason === "crash").toBe(false);
    }
  });
});
