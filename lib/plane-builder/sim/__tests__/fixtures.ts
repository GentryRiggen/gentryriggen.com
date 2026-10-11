// lib/plane-builder/sim/__tests__/fixtures.ts
import { makeCatalog } from "../../plane/catalog";
import type { PlaneStats } from "../../plane/stats";
import type { LevelDef } from "../../levels/types";

export function flatLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: "meadow",
    name: "Test",
    blurb: "",
    finishDistance: 2000,
    corridorHalfWidth: 50,
    payPerMeter: 1,
    minPayout: 0,
    terrain: { seed: 1, amplitude: 0, wavelength: 100, flatUntil: 0 },
    obstacles: [],
    coins: [],
    rings: [],
    winds: [],
    plane: makeCatalog({
      launcher: { basePrice: 1, from: 1, to: 1 },
      wings: { basePrice: 1, from: 1, to: 1 },
      engine: { basePrice: 1, from: 1, to: 1 },
      fuel: { basePrice: 1, from: 1, to: 1 },
      body: { basePrice: 1, from: 1, to: 1 },
      multiplier: { basePrice: 1, from: 1, to: 1 },
      parts: {
        launcher: ["a"],
        wings: ["a"],
        engine: ["a"],
        fuel: ["a"],
        body: ["a"],
        multiplier: ["a"],
      },
    }),
    palette: {
      sky: "#000",
      horizon: "#000",
      ground: "#000",
      hill: "#000",
      hard: "#000",
      soft: "#000",
      plane: "#000",
      trim: "#000",
    },
    ...overrides,
  };
}

export const GLIDER: PlaneStats = {
  launchSpeed: 20,
  lift: 0.06,
  thrust: 0,
  fuel: 0,
  drag: 0.008,
  shields: 0,
  multiplier: 1,
};

export const POWERED: PlaneStats = {
  ...GLIDER,
  thrust: 8,
  fuel: 20,
  lift: 0.1,
};
