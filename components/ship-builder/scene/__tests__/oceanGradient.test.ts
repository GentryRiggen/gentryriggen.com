import {
  OCEAN_FAR_RADIUS,
  OCEAN_NEAR_RADIUS,
  OCEAN_SEGMENTS,
  OCEAN_SIZE,
  oceanAxisCoordinate,
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

describe("oceanAxisCoordinate", () => {
  it("spans the ocean and is symmetric", () => {
    expect(oceanAxisCoordinate(0)).toBe(0);
    expect(oceanAxisCoordinate(1)).toBeCloseTo(OCEAN_SIZE / 2);
    expect(oceanAxisCoordinate(-0.4)).toBeCloseTo(-oceanAxisCoordinate(0.4));
  });

  it("keeps vertices under 0.7 units apart within 7 units of the ship", () => {
    const step = 2 / OCEAN_SEGMENTS;
    for (let t = 0; oceanAxisCoordinate(t) < 7; t += step) {
      expect(
        oceanAxisCoordinate(t + step) - oceanAxisCoordinate(t)
      ).toBeLessThan(0.7);
    }
  });
});
