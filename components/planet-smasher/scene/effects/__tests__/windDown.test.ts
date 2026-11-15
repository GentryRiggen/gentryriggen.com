import { WIND_DOWN, shouldWindDown, windDownFactor } from "../windDown";

describe("shouldWindDown", () => {
  it("is true once the phase has left playing", () => {
    expect(shouldWindDown("playing")).toBe(false);
    expect(shouldWindDown("ending")).toBe(true);
    expect(shouldWindDown("ended")).toBe(true);
  });
});

describe("windDownFactor", () => {
  it("goes from 1 to 0 within 0.4 s and stays at 0", () => {
    expect(WIND_DOWN).toBeLessThanOrEqual(0.4);
    expect(windDownFactor(0)).toBe(1);
    expect(windDownFactor(WIND_DOWN / 2)).toBeCloseTo(0.5);
    expect(windDownFactor(WIND_DOWN)).toBe(0);
    expect(windDownFactor(5)).toBe(0);
  });
  it("never goes up or below 0, even for a negative time", () => {
    expect(windDownFactor(-1)).toBe(1);
    let last = 1;
    for (let t = 0; t <= 0.5; t += 0.01) {
      const f = windDownFactor(t);
      expect(f).toBeLessThanOrEqual(last);
      expect(f).toBeGreaterThanOrEqual(0);
      last = f;
    }
  });
});
