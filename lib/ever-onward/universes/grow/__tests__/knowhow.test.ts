import {
  canPerformAction,
  isProjectDone as engineProjectDone,
  performAction,
  reconcileRun,
  shownProjects,
  startProject,
  tick,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { spreadRate } from "../biomes";
import { growBots } from "../bots";
import {
  FESTIVAL_ACTION_ID,
  festivalCost,
  festivalLeft,
  festivalsSoFar,
  isFestivalOn,
  isFestivalOpen,
  knowhowOf,
  knowhowPerSecond,
} from "../knowhow";
import { soilOf } from "../market";
import { incomePerSecond } from "../tick";
import { TUNING } from "../tuning";
import { waterCapacity } from "../water";
import { def, runAtPhaseStart } from "./fixtures";

const K = TUNING.knowhow;

/** A farm (1) or world (2) run with some helpers and plenty of know-how. */
function partWith(phase: 1 | 2, knowhow = 1000): RunState {
  const run = runAtPhaseStart(phase);
  const owned: Record<string, number> =
    phase === 1
      ? { scarecrow: 3, tractor: 2, well: 1 }
      : { windbreak: 3, "planting-rover": 2, "river-bend": 1 };
  return {
    ...run,
    owned: { ...run.owned, ...owned },
    resources: { ...run.resources, knowhow },
  };
}

describe("know-how", () => {
  it("trickles in from every level of every helper, on the farm and in the world", () => {
    const farm = partWith(1, 0);
    expect(knowhowPerSecond(farm)).toBeCloseTo(5 * K.perLevel, 6);
    const world = partWith(2, 0);
    expect(knowhowPerSecond(world)).toBeCloseTo(
      5 * K.perLevel * K.worldRate,
      6
    );
    expect(knowhowOf(tick(def, farm, 10))).toBeGreaterThan(0);
    // None in the yard or the pot.
    expect(knowhowPerSecond(runAtPhaseStart(0))).toBe(0);
    expect(knowhowPerSecond(runAtPhaseStart(3))).toBe(0);
  });
});

describe("the festival", () => {
  it("opens with a couple of helpers and costs know-how", () => {
    expect(isFestivalOpen(runAtPhaseStart(1))).toBe(false);
    const run = partWith(1);
    expect(isFestivalOpen(run)).toBe(true);
    const after = performAction(def, run, FESTIVAL_ACTION_ID);
    expect(after.resources.knowhow).toBe(
      run.resources.knowhow - festivalCost()
    );
    expect(isFestivalOn(after)).toBe(true);
    expect(festivalsSoFar(after)).toBe(1);
  });

  it("multiplies pay while it lasts, then ends, and can be held again", () => {
    for (const phase of [1, 2] as const) {
      const run = partWith(phase);
      const plain = incomePerSecond(run);
      const on = performAction(def, run, FESTIVAL_ACTION_ID);
      expect(incomePerSecond(on) / plain).toBeCloseTo(K.festivalMult, 5);
      // A second one cannot be held on top of the first.
      expect(canPerformAction(def, on, FESTIVAL_ACTION_ID)).toBe(false);
      let later = on;
      for (let i = 0; i < K.festivalSeconds + 1; i += 1)
        later = tick(def, later, 1);
      expect(festivalLeft(later)).toBe(0);
      expect(isFestivalOn(later)).toBe(false);
      expect(canPerformAction(def, later, FESTIVAL_ACTION_ID)).toBe(true);
    }
  });

  it("cannot be held without the know-how", () => {
    expect(canPerformAction(def, partWith(1, 0), FESTIVAL_ACTION_ID)).toBe(
      false
    );
  });
});

describe("projects", () => {
  const start = (run: RunState, id: string): RunState =>
    startProject(def, run, id);

  it("offers three on the farm and three in the world, each with a catch", () => {
    const farm = tick(def, partWith(1), 0.1);
    const world = tick(def, partWith(2), 0.1);
    expect(shownProjects(def, farm).map((p) => p.id)).toEqual([
      "drip-lines",
      "compost-heap",
      "hybrid-seed",
    ]);
    expect(shownProjects(def, world).map((p) => p.id)).toEqual([
      "rain-gauges",
      "tree-nursery",
      "wildlife-corridors",
    ]);
    for (const p of [...shownProjects(def, farm), ...shownProjects(def, world)])
      expect(p.tradeOff).toBeTruthy();
  });

  it("drip lines hold twice the water, and rain gauges do the same", () => {
    const farm = tick(def, partWith(1), 0.1);
    const done = start(farm, "drip-lines");
    expect(engineProjectDone(done, "drip-lines")).toBe(true);
    expect(waterCapacity(done) / waterCapacity(farm)).toBeCloseTo(
      K.tankMult,
      5
    );
    const world = tick(def, partWith(2), 0.1);
    expect(waterCapacity(start(world, "rain-gauges"))).toBeCloseTo(
      waterCapacity(world) * K.tankMult,
      5
    );
  });

  it("a leaf-mould heap makes the soil wear half as much when a crop repeats", () => {
    const farm = tick(def, partWith(1), 0.1);
    const held = (run: RunState): number => {
      // The same crop twice: plant it, hold a harvest day, plant it, hold another.
      let r: RunState = {
        ...run,
        resources: {
          ...run.resources,
          mkSoil: 0.8,
          mkLast: 2,
          mkCrop: 1,
          mkField: 1,
          mkPlantAt: 0,
          mkDay: TUNING.market.daySeconds - 0.5,
        },
      };
      r = tick(def, r, 1);
      return soilOf(r);
    };
    const plain = 0.8 - held(farm);
    const heaped = 0.8 - held(start(farm, "compost-heap"));
    expect(plain).toBeCloseTo(TUNING.soil.wear, 6);
    expect(heaped).toBeCloseTo(plain * K.heapWear, 6);
  });

  it("hybrid seed and wildlife corridors double the pay", () => {
    const farm = tick(def, partWith(1), 0.1);
    expect(
      incomePerSecond(start(farm, "hybrid-seed")) / incomePerSecond(farm)
    ).toBeCloseTo(K.hybridMult, 5);
    const world = tick(def, partWith(2), 0.1);
    expect(
      incomePerSecond(start(world, "wildlife-corridors")) /
        incomePerSecond(world)
    ).toBeCloseTo(K.corridorMult, 5);
  });

  it("a tree nursery makes the green spread twice as fast", () => {
    const world = tick(def, partWith(2), 0.1);
    expect(
      spreadRate(start(world, "tree-nursery")) / spreadRate(world)
    ).toBeCloseTo(K.nurserySpread, 5);
  });
});

describe("one currency, two hungry sinks", () => {
  it("what a project takes is not there for a festival, and the other way round", () => {
    const farm = tick(def, partWith(1, K.costs[2]), 0.1);
    const afterProject = startProject(def, farm, "hybrid-seed");
    expect(knowhowOf(afterProject)).toBeLessThan(festivalCost());
    expect(canPerformAction(def, afterProject, FESTIVAL_ACTION_ID)).toBe(false);
    // The same know-how spent on festivals leaves the project out of reach.
    let spent = farm;
    while (canPerformAction(def, spent, FESTIVAL_ACTION_ID)) {
      spent = performAction(def, spent, FESTIVAL_ACTION_ID);
      spent = { ...spent, resources: { ...spent.resources, fsLeft: 0 } };
    }
    expect(startProject(def, spent, "hybrid-seed")).toBe(spent);
  });

  it("a bot uses both: it holds festivals and starts projects in a normal run", () => {
    const result = simulate(def, {
      maxSeconds: 8 * 3600,
      step: 1,
      strategy: growBots().realistic,
    });
    expect(result.projectsDone.length).toBeGreaterThanOrEqual(4);
    expect(
      result.actionsDone.filter((a) => a.id === FESTIVAL_ACTION_ID).length
    ).toBeGreaterThanOrEqual(5);
  });
});

describe("a save from before know-how", () => {
  it("loads with none, no festival and no projects", () => {
    const run = partWith(1, 0);
    const old: RunState = {
      ...run,
      resources: Object.fromEntries(
        Object.entries(run.resources).filter(
          ([id]) => id !== "knowhow" && !id.startsWith("fs")
        )
      ),
    };
    const loaded = reconcileRun(def, old);
    expect(knowhowOf(loaded)).toBe(0);
    expect(isFestivalOn(loaded)).toBe(false);
    expect(incomePerSecond(loaded)).toBeCloseTo(incomePerSecond(run), 6);
    expect(tick(def, loaded, 1).resources.knowhow).toBeGreaterThan(0);
  });
});
