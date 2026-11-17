import { createPet } from "../actions";
import {
  advance,
  awakeHoursBetween,
  isAwake,
  isOut,
  moodOf,
  OUT_AFTER_MS,
} from "../sim";
import type { Pet } from "../types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

function fresh(at: number, patch: Partial<Pet> = {}): Pet {
  return {
    ...createPet({
      id: "p",
      name: "Pip",
      look: { colour: "ember", shape: "flame", eyes: "round" },
      now: at,
    }),
    fuel: 100,
    joy: 100,
    ...patch,
  };
}

describe.each(["America/Denver", "Europe/London", "Australia/Sydney"])(
  "sim in %s",
  (tz) => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = tz;
    });
    afterAll(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it("counts only 6:30 to 21:00 as awake", () => {
      expect(isAwake(local(2026, 11, 16, 6, 29))).toBe(false);
      expect(isAwake(local(2026, 11, 16, 6, 30))).toBe(true);
      expect(isAwake(local(2026, 11, 16, 20, 59))).toBe(true);
      expect(isAwake(local(2026, 11, 16, 21, 0))).toBe(false);
      expect(
        awakeHoursBetween(local(2026, 11, 16, 0), local(2026, 11, 17, 0))
      ).toBeCloseTo(14.5, 5);
    });

    it("drains nothing overnight", () => {
      const start = local(2026, 11, 16, 21, 0);
      const pet = fresh(start);
      const next = advance(pet, start, local(2026, 11, 17, 6, 30));
      expect(next.fuel).toBe(100);
      expect(next.joy).toBe(100);
      expect(next.ash).toBe(0);
    });

    it("drains fuel 100 to 0 over 16 awake hours and joy over 20", () => {
      const start = local(2026, 11, 16, 6, 30);
      const pet = fresh(start);
      const eight = advance(pet, start, start + 8 * HOUR);
      expect(eight.fuel).toBeCloseTo(50, 0);
      const day = advance(pet, start, local(2026, 11, 16, 21, 0));
      // Fed in the morning: about 100 - 14.5 * 6.25 = 9.4 by bedtime.
      expect(day.fuel).toBeCloseTo(100 - 14.5 * 6.25, 0);
      expect(day.joy).toBeLessThan(100 - 14.5 * 5 + 15);
    });

    it("adds an ash pile every 4 awake hours, up to 4", () => {
      const start = local(2026, 11, 16, 6, 30);
      const pet = fresh(start);
      expect(advance(pet, start, start + 3.9 * HOUR).ash).toBe(0);
      expect(advance(pet, start, start + 4.1 * HOUR).ash).toBe(1);
      expect(advance(pet, start, start + 12.1 * HOUR).ash).toBe(3);
      expect(advance(pet, start, start + 3 * DAY).ash).toBe(4);
    });

    it("drains joy 1.5x faster with two or more ash piles", () => {
      const start = local(2026, 11, 16, 6, 30);
      const clean = advance(fresh(start), start, start + 2 * HOUR);
      const messy = advance(fresh(start, { ash: 2 }), start, start + 2 * HOUR);
      expect(100 - messy.joy).toBeCloseTo((100 - clean.joy) * 1.5, 1);
    });

    it("fed in the morning and missed for about 2.5 days becomes an ember", () => {
      const start = local(2026, 11, 16, 6, 30);
      const pet = fresh(start);
      expect(advance(pet, start, local(2026, 11, 18, 21, 0)).state).toBe(
        "alive"
      );
      const gone = advance(pet, start, local(2026, 11, 19, 12, 0));
      expect(gone.state).toBe("ember");
      expect(gone.glow).toBe(0);
      expect(gone.emberAt).toBeGreaterThan(local(2026, 11, 19, 6, 29));
      expect(gone.emberAt).toBeLessThan(local(2026, 11, 19, 8, 0));
    });

    it("goes out for good about a week after being fed", () => {
      const start = local(2026, 11, 16, 6, 30);
      const ember = advance(fresh(start), start, start + 4 * DAY);
      expect(ember.state).toBe("ember");
      expect(isOut(ember, start + 6 * DAY)).toBe(false);
      expect(isOut(ember, start + 8.5 * DAY)).toBe(true);
      expect(isOut(ember, (ember.emberAt ?? 0) + OUT_AFTER_MS - 1)).toBe(false);
    });

    it("handles a multi-week gap in one call", () => {
      const start = local(2026, 11, 16, 6, 30);
      const next = advance(fresh(start), start, start + 40 * DAY);
      expect(next.state).toBe("ember");
      expect(next.tickedAt).toBe(start + 40 * DAY);
    });

    it("recovers glow while fed and happy, capped at 100", () => {
      const start = local(2026, 11, 16, 6, 30);
      const pet = fresh(start, { glow: 50, fuel: 100, joy: 100 });
      const next = advance(pet, start, start + 2 * HOUR);
      expect(next.glow).toBeCloseTo(70, 0);
      expect(advance(pet, start, start + 3 * HOUR).glow).toBeLessThanOrEqual(
        100
      );
    });

    it("does not recover glow when fuel is low", () => {
      const start = local(2026, 11, 16, 6, 30);
      const pet = fresh(start, { glow: 50, fuel: 20, joy: 100 });
      expect(advance(pet, start, start + HOUR).glow).toBe(50);
    });

    it("stands still when the clock goes backwards or an ember waits", () => {
      const start = local(2026, 11, 16, 12, 0);
      const pet = fresh(start);
      expect(advance(pet, start, start - HOUR).fuel).toBe(100);
      const ember = fresh(start, { state: "ember", emberAt: start, fuel: 0 });
      expect(advance(ember, start, start + DAY).state).toBe("ember");
    });

    it("splits into pieces and reaches the same place", () => {
      const start = local(2026, 11, 16, 6, 30);
      const pet = fresh(start);
      const whole = advance(pet, start, start + 2 * DAY);
      let piecewise = pet;
      for (let t = start; t < start + 2 * DAY; t += 7 * HOUR) {
        piecewise = advance(
          piecewise,
          t,
          Math.min(t + 7 * HOUR, start + 2 * DAY)
        );
      }
      expect(piecewise.fuel).toBeCloseTo(whole.fuel, 0);
      expect(piecewise.joy).toBeCloseTo(whole.joy, 0);
      expect(piecewise.ash).toBe(whole.ash);
    });
  }
);

describe("daylight saving time", () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it.each([
    ["America/New_York", [2026, 3, 8], [2026, 3, 9]],
    ["America/New_York", [2026, 11, 1], [2026, 11, 2]],
    ["Europe/Berlin", [2026, 3, 29], [2026, 3, 30]],
  ] as const)("keeps %s days at 14.5 awake hours", (tz, a, b) => {
    process.env.TZ = tz;
    expect(
      awakeHoursBetween(local(a[0], a[1], a[2]), local(b[0], b[1], b[2]))
    ).toBeCloseTo(14.5, 5);
  });
});

describe("moodOf", () => {
  const noon = local(2026, 11, 16, 12);
  it("reads needs and the clock", () => {
    expect(moodOf(fresh(noon), noon)).toBe("happy");
    expect(moodOf(fresh(noon, { fuel: 10 }), noon)).toBe("hungry");
    expect(moodOf(fresh(noon, { joy: 10 }), noon)).toBe("sad");
    expect(moodOf(fresh(noon), local(2026, 11, 16, 22))).toBe("asleep");
    expect(moodOf(fresh(noon, { state: "ember", emberAt: noon }), noon)).toBe(
      "ember"
    );
  });
});
