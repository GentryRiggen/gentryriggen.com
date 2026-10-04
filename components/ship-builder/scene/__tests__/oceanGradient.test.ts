import {
  OCEAN_FAR_RADIUS,
  OCEAN_NEAR_RADIUS,
  oceanDepthMix,
} from "../oceanGradient";

describe("oceanDepthMix", () => {
  it("keeps the near colour around the ship", () => {
    expect(oceanDepthMix(0)).toBe(0);
    expect(oceanDepthMix(OCEAN_NEAR_RADIUS)).toBe(0);
  });

  it("reaches the deep colour toward the horizon", () => {
    expect(oceanDepthMix(OCEAN_FAR_RADIUS)).toBe(1);
    expect(oceanDepthMix(OCEAN_FAR_RADIUS * 3)).toBe(1);
  });

  it("deepens steadily in between", () => {
    const mid = (OCEAN_NEAR_RADIUS + OCEAN_FAR_RADIUS) / 2;
    expect(oceanDepthMix(mid)).toBeCloseTo(0.5);
    expect(oceanDepthMix(mid - 10)).toBeLessThan(oceanDepthMix(mid));
    expect(oceanDepthMix(mid + 10)).toBeGreaterThan(oceanDepthMix(mid));
  });
});
