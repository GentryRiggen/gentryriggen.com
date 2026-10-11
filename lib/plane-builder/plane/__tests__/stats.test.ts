// lib/plane-builder/plane/__tests__/stats.test.ts
import {
  MAX_TIER,
  STARTER_TIERS,
  ladder,
  makeCatalog,
  tierPrice,
} from "../catalog";
import { planeStats } from "../stats";

const catalog = makeCatalog({
  launcher: { basePrice: 10, from: 10, to: 50 },
  wings: { basePrice: 10, from: 0.03, to: 0.15 },
  engine: { basePrice: 10, from: 0, to: 12 },
  fuel: { basePrice: 10, from: 3, to: 30 },
  body: { basePrice: 10, from: 0.01, to: 0.003 },
  multiplier: { basePrice: 10, from: 1, to: 3 },
  parts: {
    launcher: ["Twig sling"],
    wings: ["Stubs"],
    engine: ["None"],
    fuel: ["Cup"],
    body: ["Box"],
    multiplier: ["x1"],
  },
});

describe("catalog", () => {
  it("builds a 9-step ladder from start to end", () => {
    const values = ladder(0, 8);
    expect(values).toHaveLength(MAX_TIER + 1);
    expect(values[0]).toBe(0);
    expect(values[8]).toBe(8);
  });

  it("raises prices 1.5x per tier and stops at the top", () => {
    expect(tierPrice(catalog.engine, 0)).toBe(10);
    expect(tierPrice(catalog.engine, 1)).toBe(15);
    expect(tierPrice(catalog.engine, 2)).toBe(23);
    expect(tierPrice(catalog.engine, MAX_TIER)).toBeNull();
  });

  it("pads part names so every tier has one", () => {
    expect(catalog.wings.parts).toHaveLength(MAX_TIER + 1);
    expect(catalog.wings.parts[8]).toBe("Stubs 9");
  });
});

describe("planeStats", () => {
  it("gives starter values at tier 0", () => {
    expect(planeStats(catalog, STARTER_TIERS)).toEqual({
      launchSpeed: 10,
      lift: 0.03,
      thrust: 0,
      fuel: 3,
      drag: 0.01,
      shields: 0,
      multiplier: 1,
    });
  });

  it("reads each track at its tier, with shields from body", () => {
    const stats = planeStats(catalog, {
      ...STARTER_TIERS,
      engine: 8,
      body: 3,
    });
    expect(stats.thrust).toBe(12);
    expect(stats.shields).toBe(2);
  });
});
