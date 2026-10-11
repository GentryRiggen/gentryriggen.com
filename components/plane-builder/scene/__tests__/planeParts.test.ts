import { LEVEL_ORDER } from "@/lib/plane-builder/levels";
import { STARTER_TIERS, type Tiers } from "@/lib/plane-builder/plane/catalog";
import { planeParts } from "../planeParts";

const withTier = (patch: Partial<Tiers>): Tiers => ({
  ...STARTER_TIERS,
  ...patch,
});
const MAXED: Tiers = {
  launcher: 8,
  wings: 8,
  engine: 8,
  fuel: 8,
  body: 8,
  multiplier: 8,
};

describe("planeParts", () => {
  it.each(LEVEL_ORDER)("%s looks different at tier 0 and tier 8", (id) => {
    expect(planeParts(id, MAXED)).not.toEqual(planeParts(id, STARTER_TIERS));
  });

  it("starts the meadow as a paper dart and nowhere else", () => {
    expect(planeParts("meadow", STARTER_TIERS).isDart).toBe(true);
    expect(planeParts("meadow", withTier({ body: 1 })).isDart).toBe(false);
    expect(planeParts("canyon", STARTER_TIERS).isDart).toBe(false);
  });

  it("grows the body and wings with their tiers", () => {
    const parts = planeParts("meadow", withTier({ body: 4, wings: 2 }));
    expect(parts.bodyLength).toBeCloseTo(2.6);
    expect(parts.wingSpan).toBeCloseTo(2.2);
  });

  it("makes the canyon plane a biplane from wings tier 4", () => {
    expect(planeParts("canyon", withTier({ wings: 3 })).hasBiplane).toBe(false);
    expect(planeParts("canyon", withTier({ wings: 4 })).hasBiplane).toBe(true);
    expect(planeParts("meadow", withTier({ wings: 8 })).hasBiplane).toBe(false);
  });

  it("sweeps the mountain wings back from wings tier 5", () => {
    expect(planeParts("mountains", withTier({ wings: 4 })).sweep).toBe(0);
    expect(planeParts("mountains", withTier({ wings: 5 })).sweep).toBeCloseTo(
      Math.PI / 6
    );
    expect(planeParts("canyon", withTier({ wings: 8 })).sweep).toBe(0);
  });

  it("chooses engines by level and tier", () => {
    expect(planeParts("meadow", withTier({ engine: 0 })).propellers).toBe(0);
    expect(planeParts("meadow", withTier({ engine: 8 })).propellers).toBe(1);
    expect(planeParts("canyon", withTier({ engine: 5 })).propellers).toBe(1);
    expect(planeParts("canyon", withTier({ engine: 6 })).propellers).toBe(2);
    const jet = planeParts("mountains", withTier({ engine: 1 }));
    expect(jet.hasNacelles).toBe(true);
    expect(jet.propellers).toBe(0);
    expect(planeParts("mountains", withTier({ engine: 0 })).hasNacelles).toBe(
      false
    );
  });

  it("lights the afterburner at engine tier 7", () => {
    const at = (id: "mountains" | "canyon", engine: number) =>
      planeParts(id, withTier({ engine })).hasAfterburner;
    expect(at("mountains", 6)).toBe(false);
    expect(at("mountains", 7)).toBe(true);
    expect(at("canyon", 8)).toBe(false);
  });

  it("hangs tanks from fuel tier 3", () => {
    expect(planeParts("meadow", withTier({ fuel: 2 })).hasTanks).toBe(false);
    expect(planeParts("meadow", withTier({ fuel: 3 })).hasTanks).toBe(true);
  });

  it("adds trim at multiplier 1 and gold at 8", () => {
    expect(planeParts("meadow", STARTER_TIERS).hasStripes).toBe(false);
    const one = planeParts("meadow", withTier({ multiplier: 1 }));
    expect(one.hasStripes).toBe(true);
    expect(one.isGold).toBe(false);
    expect(planeParts("meadow", withTier({ multiplier: 8 })).isGold).toBe(true);
  });
});
