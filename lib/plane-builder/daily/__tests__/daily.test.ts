import { LEVEL_ORDER } from "../../levels";
import { LEVELS } from "../../levels";
import { STARTER_TIERS } from "../../plane/catalog";
import { planeStats } from "../../plane/stats";
import { launch, step } from "../../sim/flight";
import {
  DAILY_TWISTS,
  coinMultiplierFor,
  dailyFor,
  formatCountdown,
  isDateKey,
  modsFor,
  msUntilNextUtcDay,
  utcDateKey,
} from "../daily";

const at = (iso: string) => Date.parse(iso);

describe("utcDateKey", () => {
  it("uses the UTC day, not the local one", () => {
    expect(utcDateKey(at("2026-10-30T23:59:59Z"))).toBe("2026-10-30");
    expect(utcDateKey(at("2026-10-31T00:00:00Z"))).toBe("2026-10-31");
    expect(utcDateKey(at("2027-01-05T03:00:00-08:00"))).toBe("2027-01-05");
  });
});

describe("isDateKey", () => {
  it("accepts yyyy-mm-dd only", () => {
    expect(isDateKey("2026-10-30")).toBe(true);
    expect(isDateKey("2026-1-30")).toBe(false);
    expect(isDateKey(20261030)).toBe(false);
  });
});

describe("msUntilNextUtcDay", () => {
  it("counts down to UTC midnight", () => {
    expect(msUntilNextUtcDay(at("2026-10-30T23:00:00Z"))).toBe(3_600_000);
    expect(msUntilNextUtcDay(at("2026-10-30T00:00:00Z"))).toBe(86_400_000);
  });
});

describe("formatCountdown", () => {
  it("shows h:mm:ss", () => {
    expect(formatCountdown(3_725_000)).toBe("1:02:05");
    expect(formatCountdown(0)).toBe("0:00:00");
    expect(formatCountdown(-5)).toBe("0:00:00");
  });
});

describe("dailyFor", () => {
  it("is the same for the same date", () => {
    expect(dailyFor("2026-10-30")).toEqual(dailyFor("2026-10-30"));
  });

  it("only picks real worlds and twists", () => {
    for (let day = 0; day < 400; day += 1) {
      const d = dailyFor(utcDateKey(at("2026-01-01T00:00:00Z") + day * 864e5));
      expect(LEVEL_ORDER).toContain(d.world);
      expect(DAILY_TWISTS).toContain(d.twist);
    }
  });

  it("covers every world and twist over a year and changes day to day", () => {
    const worlds = new Set<string>();
    const twists = new Set<string>();
    let repeats = 0;
    let previous = "";
    for (let day = 0; day < 365; day += 1) {
      const d = dailyFor(utcDateKey(at("2026-01-01T00:00:00Z") + day * 864e5));
      worlds.add(d.world);
      twists.add(d.twist);
      if (d.world === previous) repeats += 1;
      previous = d.world;
    }
    expect(worlds.size).toBe(LEVEL_ORDER.length);
    expect(twists.size).toBe(DAILY_TWISTS.length);
    expect(repeats).toBeLessThan(60);
  });
});

describe("twists", () => {
  const level = LEVELS.meadow;
  const stats = planeStats(level.plane, { ...STARTER_TIERS, launcher: 4 });
  const flyFor = (twist: Parameters<typeof modsFor>[0]) => {
    const s = launch(level, stats, { pitch: 0.3, yaw: 0, power: 1 });
    const mods = modsFor(twist);
    while (s.phase !== "done" && s.time < 6) {
      step(s, level, stats, { pitch: 0, bank: 0, boost: false }, mods);
    }
    return s.maxX;
  };

  it("a tailwind carries further than a headwind", () => {
    expect(flyFor("tailwind")).toBeGreaterThan(flyFor("headwind"));
  });

  it("only double coins doubles coins", () => {
    expect(coinMultiplierFor("doubleCoins")).toBe(2);
    expect(coinMultiplierFor("tailwind")).toBe(1);
  });

  it("no boost turns boost off", () => {
    const engine = planeStats(level.plane, {
      ...STARTER_TIERS,
      engine: 3,
      fuel: 3,
    });
    const run = (mods: ReturnType<typeof modsFor>) => {
      const s = launch(level, engine, { pitch: 0.2, yaw: 0, power: 1 });
      for (let i = 0; i < 120; i += 1) {
        step(s, level, engine, { pitch: 0, bank: 0, boost: true }, mods);
      }
      return s.fuel;
    };
    expect(run(modsFor("noBoost"))).toBeGreaterThan(run({}));
  });
});
