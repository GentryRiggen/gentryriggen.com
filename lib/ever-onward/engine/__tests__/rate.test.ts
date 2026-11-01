import { incomeRate, recordGain, type GainSample } from "../rate";

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
