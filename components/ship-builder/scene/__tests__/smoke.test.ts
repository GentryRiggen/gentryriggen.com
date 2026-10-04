import { lifePhase, slotNoise } from "../particles";
import {
  createPuffState,
  puffState,
  smokeCapacity,
  SMOKE_LIFE,
  SMOKE_MAX_PUFFS,
} from "../smoke";

describe("lifePhase", () => {
  it("advances with time and wraps at the end of a life", () => {
    expect(lifePhase(0, SMOKE_LIFE, 0)).toBe(0);
    expect(lifePhase(1.5, SMOKE_LIFE, 0)).toBeCloseTo(0.5);
    expect(lifePhase(SMOKE_LIFE, SMOKE_LIFE, 0)).toBeCloseTo(0);
    expect(lifePhase(0, SMOKE_LIFE, 1.25)).toBeCloseTo(0.25);
  });

  it("staggers slots by their offset so puffs are evenly spread", () => {
    const phases = [0, 1, 2, 3, 4].map((i) =>
      lifePhase(0.3, SMOKE_LIFE, i / 5)
    );
    expect(new Set(phases.map((p) => p.toFixed(3))).size).toBe(5);
  });
});

describe("puffState", () => {
  const out = createPuffState();

  it("starts small and invisible at the funnel top", () => {
    const born = { ...puffState(0, 1, out) };
    expect(born.rise).toBe(0);
    expect(born.drift).toBe(0);
    expect(born.alpha).toBe(0);
    expect(born.scale).toBeGreaterThan(0);
  });

  it("rises, drifts aft and grows as it ages", () => {
    const young = { ...puffState(0.2, 1, out) };
    const old = { ...puffState(0.8, 1, out) };
    expect(old.rise).toBeGreaterThan(young.rise);
    expect(old.drift).toBeGreaterThan(young.drift);
    expect(old.scale).toBeGreaterThan(young.scale);
  });

  it("is visible mid-life and fully faded at the end", () => {
    expect(puffState(0.3, 1, out).alpha).toBeGreaterThan(0.1);
    expect(puffState(1, 1, out).alpha).toBe(0);
  });

  it("makes large-funnel puffs bigger", () => {
    const small = puffState(0.5, 1, out).scale;
    expect(puffState(0.5, 1.5, out).scale).toBeCloseTo(small * 1.5);
  });
});

describe("smokeCapacity", () => {
  it("allots 5 puffs per small funnel and 8 per large one", () => {
    expect(smokeCapacity(2, 1)).toBe(18);
    expect(smokeCapacity(0, 0)).toBe(0);
  });

  it("is capped at the total puff limit", () => {
    expect(smokeCapacity(100, 100)).toBe(SMOKE_MAX_PUFFS);
  });
});

describe("slotNoise", () => {
  it("is deterministic and within [-1, 1)", () => {
    expect(slotNoise(3, 1)).toBe(slotNoise(3, 1));
    for (let slot = 0; slot < 50; slot++) {
      const n = slotNoise(slot, 2);
      expect(n).toBeGreaterThanOrEqual(-1);
      expect(n).toBeLessThan(1);
    }
  });
});
