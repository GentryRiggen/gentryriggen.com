import { performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { waterCapacity, tickWater } from "../water";
import {
  BIOMES,
  MAX_POINTS,
  MIX_ACTION_IDS,
  biomePerk,
  biomeShare,
  blightOf,
  blightedBiome,
  blightsSoFar,
  canNudge,
  greenMult,
  healsSoFar,
  justHealed,
  lessActionId,
  mixResultLine,
  moreActionId,
  pointsOf,
  spreadRate,
  targetShare,
  tickBiomes,
  worldCover,
  type Biome,
} from "../biomes";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

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

/** The world with these slider points, and the green already reached. */
function mixed(points: Record<Biome, number>, cover = 1): RunState {
  const run = world();
  BIOMES.forEach((b, i) => {
    run.resources[`bmWant${i}`] = points[b];
  });
  run.resources.bmCover = cover;
  return run;
}

const run = (start: RunState, seconds: number): RunState => {
  let now = start;
  for (let t = 0; t < seconds; t += 1) now = tick(def, now, 1);
  return now;
};

describe("the mix", () => {
  it("names a more and a less action per biome", () => {
    expect(MIX_ACTION_IDS).toHaveLength(8);
    expect(moreActionId("jungle")).toBe("world-more-jungle");
    expect(lessActionId("wetland")).toBe("world-less-wetland");
  });

  it("starts with a mix that asks for something of every biome", () => {
    const start = world();
    for (const b of BIOMES) expect(pointsOf(start, b)).toBeGreaterThan(0);
    const total = BIOMES.reduce((sum, b) => sum + targetShare(start, b), 0);
    expect(total).toBeCloseTo(1);
  });

  it("moves a slider one point at a time, within 0 to the top", () => {
    const start = world();
    const before = pointsOf(start, "jungle");
    const up = performAction(def, start, moreActionId("jungle"));
    expect(pointsOf(up, "jungle")).toBe(before + 1);
    const down = performAction(def, start, lessActionId("jungle"));
    expect(pointsOf(down, "jungle")).toBe(before - 1);
    const full = mixed({
      forest: 3,
      jungle: MAX_POINTS,
      meadow: 2,
      wetland: 2,
    });
    expect(canNudge(full, "jungle", 1)).toBe(false);
    const empty = mixed({ forest: 3, jungle: 0, meadow: 2, wetland: 2 });
    expect(canNudge(empty, "jungle", -1)).toBe(false);
  });

  it("never lets the last point go", () => {
    const one = mixed({ forest: 1, jungle: 0, meadow: 0, wetland: 0 });
    expect(canNudge(one, "forest", -1)).toBe(false);
    expect(performAction(def, one, lessActionId("forest"))).toBe(one);
  });

  it("changing your mind takes time: shares drift toward the mix, they do not jump", () => {
    const start = mixed({ forest: 0, jungle: 10, meadow: 0, wetland: 0 }, 0.5);
    start.resources.bmForest = 0.5;
    const soon = run(start, 20);
    expect(biomeShare(soon, "forest")).toBeLessThan(0.5);
    expect(biomeShare(soon, "forest")).toBeGreaterThan(0.3);
    expect(biomeShare(soon, "jungle")).toBeGreaterThan(0);
    expect(biomeShare(soon, "jungle")).toBeLessThan(0.15);
    const later = run(start, 200);
    expect(biomeShare(later, "forest")).toBeLessThan(0.05);
    expect(biomeShare(later, "jungle")).toBeGreaterThan(0.4);
  });

  it("gives each biome a different perk", () => {
    const only = (b: Biome) => state({ [b]: 0.4 }, 1);
    const none = state({}, 1);
    // forest: steady green
    expect(greenMult(only("forest"))).toBeGreaterThan(greenMult(none));
    // jungle: more green than forest at the same size
    expect(greenMult(only("jungle"))).toBeGreaterThan(
      greenMult(only("forest"))
    );
    // meadow: the green spreads faster, hardly any green of its own
    expect(spreadRate(only("meadow"))).toBeGreaterThan(spreadRate(none));
    expect(spreadRate(only("forest"))).toBe(spreadRate(none));
    expect(greenMult(only("meadow"))).toBeLessThan(greenMult(only("forest")));
    // wetland: a bigger tank
    expect(waterCapacity(only("wetland"))).toBeGreaterThan(waterCapacity(none));
    expect(waterCapacity(only("forest"))).toBe(waterCapacity(none));
    for (const b of BIOMES) expect(biomePerk(only(b), b)).toBeGreaterThan(0);
  });

  it("makes the jungle the thirstiest biome", () => {
    const drain = (b: Biome) => {
      const r = state({ [b]: 0.5 }, 0.5, { windbreak: 3 });
      r.resources.rainOutlook = 0;
      const before = r.resources.tank;
      tickWater(r, 10);
      return before - r.resources.tank;
    };
    expect(drain("jungle")).toBeGreaterThan(drain("forest"));
    expect(drain("jungle")).toBeGreaterThan(drain("meadow"));
  });

  it("a dry world sheds green, the jungle most and the wetland none", () => {
    const start = state(
      { forest: 0.2, jungle: 0.2, meadow: 0.2, wetland: 0.2 },
      0
    );
    start.resources.bmCover = 0.8;
    // Sliders at the same mix, so only the drought moves the shares.
    BIOMES.forEach((_, i) => {
      start.resources[`bmWant${i}`] = 1;
    });
    const dry = { ...start, resources: { ...start.resources, wtDry: 1 } };
    const after = { ...dry, resources: { ...dry.resources } };
    tickBiomes(after, 30);
    const lost = (b: Biome) => biomeShare(dry, b) - biomeShare(after, b);
    expect(lost("jungle")).toBeGreaterThan(lost("forest"));
    expect(lost("forest")).toBeGreaterThan(lost("meadow"));
    expect(lost("wetland")).toBeLessThanOrEqual(0);
    expect(worldCover(after)).toBeLessThan(worldCover(dry));
  });
});

describe("blight", () => {
  const over = TUNING.world.blightAt + 0.15;

  it("starts in a biome that covers too much, and only there", () => {
    const start = mixed({ forest: 0, jungle: 10, meadow: 0, wetland: 0 });
    start.resources.bmJungle = over;
    start.resources.bmForest = 0.2;
    const sick = run(start, 40);
    expect(blightOf(sick, "jungle")).toBeGreaterThan(0.2);
    expect(blightOf(sick, "forest")).toBe(0);
    expect(blightedBiome(sick)).toBe("jungle");
    expect(blightsSoFar(sick)).toBe(1);
  });

  it("takes green away from the rotting biome", () => {
    const healthy = state({ jungle: over }, 1);
    const sick = state({ jungle: over }, 1);
    sick.resources.bmBlight1 = 1;
    expect(greenMult(sick)).toBeLessThan(greenMult(healthy));
    expect(greenMult(sick)).toBeGreaterThan(1);
  });

  it("has no cure button: no action touches the rot", () => {
    const sick = state({ jungle: over }, 1);
    sick.resources.bmBlight1 = 1;
    for (const id of MIX_ACTION_IDS) {
      const after = performAction(def, sick, id);
      expect(blightOf(after, "jungle")).toBe(1);
    }
  });

  it("heals once the mix is spread out, and the log says so", () => {
    const start = mixed({ forest: 3, jungle: 3, meadow: 2, wetland: 2 });
    start.resources.bmJungle = over;
    start.resources.bmForest = 0.15;
    start.resources.bmMeadow = 0.1;
    start.resources.bmWetland = 0.1;
    start.resources.bmBlight1 = 0.9;
    start.resources.bmBlights = 1;
    start.resources.bmBlightAt = start.time;
    const better = run(start, 90);
    expect(blightOf(better, "jungle")).toBe(0);
    expect(healsSoFar(better)).toBe(1);
    expect(mixResultLine(better)).toMatch(/blight in the jungle is gone/i);
    expect(justHealed({ ...better, time: better.resources.bmHealedAt })).toBe(
      true
    );
  });

  it("a spread-out mix never catches it", () => {
    const start = mixed({ forest: 3, jungle: 3, meadow: 2, wetland: 2 }, 0.05);
    start.resources.tank = waterCapacity(start);
    const late = run(start, 1500);
    for (const b of BIOMES) expect(blightOf(late, b)).toBe(0);
    expect(blightsSoFar(late)).toBe(0);
  });
});
