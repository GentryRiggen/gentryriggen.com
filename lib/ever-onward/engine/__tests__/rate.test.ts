import {
  incomeRate,
  netRate,
  rateTrend,
  recordGain,
  recordReading,
  TREND_LOOKBACK_MS,
  upkeepRate,
  type GainSample,
  type RateReading,
} from "../rate";
import type { RunState, UniverseDef } from "../types";

describe("income rate", () => {
  it("ignores drops, so spending never reads as income", () => {
    let samples: GainSample[] = [];
    samples = recordGain(samples, 100, 40, 1000);
    expect(samples).toEqual([]);
    expect(incomeRate(samples, 1000, 0)).toBe(0);
  });

  it("averages gains over the window", () => {
    let samples: GainSample[] = [];
    let value = 0;
    for (let t = 100; t <= 3000; t += 100) {
      samples = recordGain(samples, value, value + 1, t);
      value += 1;
    }
    // 30 gained in 3 seconds
    expect(incomeRate(samples, 3000, 0)).toBeCloseTo(10, 5);
  });

  it("forgets gains older than the window", () => {
    const samples = recordGain([], 0, 50, 1000);
    expect(incomeRate(samples, 1000, 0)).toBeGreaterThan(0);
    expect(incomeRate(samples, 4500, 0)).toBe(0);
    expect(recordGain(samples, 50, 50, 4500)).toEqual([]);
  });

  it("does not spike when the window is young", () => {
    const samples = recordGain([], 0, 10, 100);
    // spread over at least a second
    expect(incomeRate(samples, 100, 0)).toBeCloseTo(10, 5);
  });

  it("skips the first reading and non-finite values", () => {
    expect(recordGain([], null, 500, 10)).toEqual([]);
    expect(recordGain([], 1, Number.NaN, 10)).toEqual([]);
  });
});

describe("net rate", () => {
  it("takes running costs off the gross income", () => {
    expect(netRate(10, 3)).toBe(7);
    expect(netRate(1, 3)).toBe(-2);
  });

  it("reads a universe's upkeep for one resource, ignoring junk", () => {
    const def = {
      upkeep: () => ({ coins: 2.5, oil: Number.NaN, power: -4 }),
    } as unknown as UniverseDef;
    const run = {} as RunState;
    expect(upkeepRate(def, run, "coins")).toBe(2.5);
    expect(upkeepRate(def, run, "oil")).toBe(0);
    expect(upkeepRate(def, run, "power")).toBe(0);
    expect(upkeepRate({} as UniverseDef, run, "coins")).toBe(0);
  });

  it("calls the rate rising once it beats the reading from a few seconds ago", () => {
    let history: RateReading[] = [];
    history = recordReading(history, { at: 0, rate: 10 });
    expect(rateTrend(history, 1000, 20)).toBe("flat");
    expect(rateTrend(history, TREND_LOOKBACK_MS, 20)).toBe("up");
    expect(rateTrend(history, TREND_LOOKBACK_MS, 4)).toBe("down");
    expect(rateTrend(history, TREND_LOOKBACK_MS, 10.1)).toBe("flat");
  });

  it("keeps only recent readings", () => {
    let history: RateReading[] = [];
    history = recordReading(history, { at: 0, rate: 1 });
    history = recordReading(history, { at: TREND_LOOKBACK_MS * 3, rate: 2 });
    expect(history).toHaveLength(1);
  });
});
