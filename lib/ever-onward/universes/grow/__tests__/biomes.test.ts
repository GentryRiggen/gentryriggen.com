import type { RunState } from "../../../engine/types";
import { waterCapacity } from "../water";
import {
  BIOMES,
  bestBiome,
  biomePerk,
  biomeShare,
  greenMult,
  migrationSeedsMult,
  spreadActionId,
  type Biome,
} from "../biomes";
import { tickWater } from "../water";
import { runAtPhaseStart } from "./fixtures";

const world = (): RunState => runAtPhaseStart(2);

/** The world with these shares, this much of the tank and these upgrades. */
function state(
  shares: Partial<Record<Biome, number>>,
  tankFraction: number,
  owned: Record<string, number> = {}
): RunState {
  const base = world();
  const run: RunState = {
    ...base,
    owned: { ...base.owned, ...owned },
    resources: {
      ...base.resources,
      bmForest: shares.forest ?? 0,
      bmJungle: shares.jungle ?? 0,
      bmMeadow: shares.meadow ?? 0,
      bmWetland: shares.wetland ?? 0,
    },
  };
  run.resources.tank = waterCapacity(run) * tankFraction;
  return run;
}

describe("biomes", () => {
  it("names a spread action per biome", () =>
    expect(BIOMES.map(spreadActionId)).toEqual([
      "world-spread-forest",
      "world-spread-jungle",
      "world-spread-meadow",
      "world-spread-wetland",
    ]));

  it("gives each biome a different perk", () => {
    const only = (b: Biome) => state({ [b]: 0.4 }, 1);
    const none = state({}, 1);
    // forest: steady green
    expect(greenMult(only("forest"))).toBeGreaterThan(greenMult(none));
    // jungle: more green than forest at the same size
    expect(greenMult(only("jungle"))).toBeGreaterThan(
      greenMult(only("forest"))
    );
    // meadow: more migration seeds, hardly any green
    expect(migrationSeedsMult(only("meadow"))).toBeGreaterThan(1);
    expect(migrationSeedsMult(only("forest"))).toBe(1);
    expect(greenMult(only("meadow"))).toBeLessThan(greenMult(only("forest")));
    // wetland: a bigger tank
    expect(waterCapacity(only("wetland"))).toBeGreaterThan(waterCapacity(none));
    expect(waterCapacity(only("forest"))).toBe(waterCapacity(none));
    for (const b of BIOMES) expect(biomePerk(only(b), b)).toBeGreaterThan(0);
  });

  it("makes the jungle the thirstiest biome", () => {
    const drain = (b: Biome) => {
      const run = state({ [b]: 0.5 }, 0.5, { windbreak: 3 });
      run.resources.rainOutlook = 0;
      const before = run.resources.tank;
      tickWater(run, 10);
      return before - run.resources.tank;
    };
    expect(drain("jungle")).toBeGreaterThan(drain("forest"));
    expect(drain("jungle")).toBeGreaterThan(drain("meadow"));
  });

  it("makes every biome the best pick somewhere: each is bestBiome for some reachable state", () => {
    // a fresh, full map: the fast jungle
    expect(bestBiome(state({}, 1))).toBe("jungle");
    // a map with plenty of jungle and a full tank: the pollinators' meadow
    expect(bestBiome(state({ jungle: 0.5 }, 1))).toBe("meadow");
    // meadow and jungle both well grown: the steady forest
    expect(bestBiome(state({ jungle: 0.5, meadow: 0.6 }, 0.4))).toBe("forest");
    // a thirsty map: the wetland
    expect(bestBiome(state({ jungle: 0.5 }, 0.1))).toBe("wetland");
    for (const b of BIOMES)
      expect(biomeShare(state({ [b]: 0.2 }, 1), b)).toBe(0.2);
  });
});
