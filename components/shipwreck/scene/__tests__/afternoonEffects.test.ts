import { QUALITY_TIERS } from "@/lib/shipwreck/playback";
import { hitTimeS } from "@/lib/shipwreck/playback";
import { columnOpen, DAY_PARTICLES } from "../afternoonEffects";

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
