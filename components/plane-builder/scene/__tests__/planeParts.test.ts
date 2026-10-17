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

  describe("the newer worlds' planes", () => {
    it("gives the beach a seaplane with floats and a high wing", () => {
      for (const tiers of [STARTER_TIERS, MAXED]) {
        const parts = planeParts("beach", tiers);
        expect(parts.look).toBe("seaplane");
        expect(parts.gear).toBe("floats");
        expect(parts.wingHeight).toBeGreaterThan(0);
        expect(parts.hasWingStruts).toBe(true);
      }
      expect(planeParts("beach", MAXED).bodyLength).toBeGreaterThan(
        planeParts("beach", STARTER_TIERS).bodyLength
      );
    });

    it("gives the jungle a stubby bush plane on big tyres", () => {
      for (const tiers of [STARTER_TIERS, MAXED]) {
        const parts = planeParts("jungle", tiers);
        expect(parts.gear).toBe("tyres");
        expect(parts.hasWingStruts).toBe(true);
        expect(parts.girth).toBeGreaterThan(1.2);
        expect(parts.bodyLength).toBeLessThan(
          planeParts("meadow", tiers).bodyLength
        );
      }
      expect(planeParts("jungle", withTier({ engine: 1 })).propellers).toBe(1);
    });

    it("gives the city a swept jet with no propeller and a tail that glows", () => {
      for (const tiers of [STARTER_TIERS, MAXED]) {
        const parts = planeParts("city", tiers);
        expect(parts.propellers).toBe(0);
        expect(parts.sweep).toBeGreaterThan(0);
        expect(parts.hasJetTail).toBe(true);
        expect(parts.hasIntakes).toBe(true);
      }
      const glow = (engine: number) =>
        planeParts("city", withTier({ engine })).exhaustGlow;
      expect(glow(0)).toBe(0);
      expect(glow(1)).toBe(1);
      expect(glow(4)).toBe(2);
      expect(glow(8)).toBe(3);
      expect(planeParts("city", MAXED).engineScale).toBeGreaterThan(
        planeParts("city", STARTER_TIERS).engineScale
      );
    });

    it("gives the glacier a boxy ski plane", () => {
      for (const tiers of [STARTER_TIERS, MAXED]) {
        const parts = planeParts("glacier", tiers);
        expect(parts.gear).toBe("skis");
        expect(parts.hasCabin).toBe(true);
        expect(parts.wingHeight).toBeGreaterThan(0);
        expect(parts.hasWingStruts).toBe(true);
      }
    });

    it("gives the volcano a thick twin with pods that gain propellers", () => {
      const start = planeParts("volcano", STARTER_TIERS);
      const max = planeParts("volcano", MAXED);
      expect(start.enginePods).toBe(2);
      expect(max.enginePods).toBe(2);
      expect(start.girth).toBeGreaterThan(1.3);
      expect(start.hasPodPropellers).toBe(false);
      expect(max.hasPodPropellers).toBe(true);
      expect(max.propellers).toBe(0);
      expect(max.engineScale).toBeGreaterThan(start.engineScale);
    });

    it("gives the storm twin booms and a pusher propeller", () => {
      for (const tiers of [STARTER_TIERS, MAXED]) {
        expect(planeParts("storm", tiers).hasTwinBooms).toBe(true);
      }
      expect(planeParts("storm", STARTER_TIERS).propellers).toBe(0);
      expect(planeParts("storm", MAXED).propellers).toBe(1);
    });

    it("gives the islands a glowing glider with long thin wings", () => {
      const start = planeParts("islands", STARTER_TIERS);
      const max = planeParts("islands", MAXED);
      for (const parts of [start, max]) {
        expect(parts.hasGlowTrim).toBe(true);
        expect(parts.hasPointedNose).toBe(true);
        expect(parts.wingChord).toBeLessThan(0.6);
        expect(parts.propellers).toBe(0);
      }
      expect(start.hasWinglets).toBe(false);
      expect(max.hasWinglets).toBe(true);
      expect(max.girth).toBeLessThan(start.girth);
      expect(max.wingSpan / max.wingChord).toBeGreaterThan(
        planeParts("meadow", MAXED).wingSpan
      );
    });

    it("leaves the three original looks plain", () => {
      for (const id of ["meadow", "canyon", "mountains"] as const) {
        const parts = planeParts(id, MAXED);
        expect(parts.girth).toBe(1);
        expect(parts.wingHeight).toBe(0);
        expect(parts.wingChord).toBe(1);
        expect(parts.gear).toBe("none");
        expect(parts.enginePods).toBe(0);
        expect(parts.hasJetTail).toBe(false);
        expect(parts.engineScale).toBe(1);
      }
    });

    it("never repeats a look between worlds", () => {
      const looks = LEVEL_ORDER.map((id) => planeParts(id, STARTER_TIERS).look);
      expect(new Set(looks).size).toBe(LEVEL_ORDER.length);
    });
  });
});
