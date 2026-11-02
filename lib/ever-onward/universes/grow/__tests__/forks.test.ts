import {
  canPerformAction,
  performAction,
  reconcileRun,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { activeBiome, greenMult, isBiomeLocked, spreadBiome } from "../biomes";
import { growBots, takesFork } from "../bots";
import { isFairOpen, ribbonPays } from "../fair";
import {
  FORKS,
  FORK_ACTION_IDS,
  beesWelcome,
  forkActionId,
  forkCost,
  forkSide,
  isForkChosen,
  isForkOpen,
  type ForkId,
  type ForkSide,
} from "../forks";
import { incomePerSecond } from "../tick";
import { TUNING } from "../tuning";
import { waterCapacity } from "../water";
import { canMult } from "../windowbox";
import { def, runAtPhaseStart } from "./fixtures";

const PHASE_OF: Record<ForkId, number> = {
  yard: 0,
  farm: 1,
  world: 2,
  seed: 3,
};

/** A run at the start of a fork's phase, with enough owned to open it. */
function openFork(id: ForkId): RunState {
  const base = runAtPhaseStart(PHASE_OF[id]);
  const fork = FORKS.find((f) => f.id === id)!;
  const run: RunState = {
    ...base,
    owned: { ...base.owned },
    resources: { ...base.resources },
  };
  const needs: Record<ForkId, [string, number]> = {
    yard: ["sprinkler", 3],
    farm: ["tractor", 2],
    world: ["windbreak", 2],
    seed: ["trellis", 2],
  };
  run.owned[needs[id][0]] = needs[id][1];
  run.resources[fork.currency] = forkCost(id) * 3;
  return run;
}

const choose = (run: RunState, id: ForkId, side: ForkSide): RunState =>
  performAction(def, run, forkActionId(id, side));

describe("forks", () => {
  it.each(FORKS.map((f) => f.id))(
    "%s: opens at its milestone, costs its currency and is not chosen yet",
    (id) => {
      const base = runAtPhaseStart(PHASE_OF[id]);
      expect(isForkOpen(base, id)).toBe(false);
      const run = openFork(id);
      expect(isForkOpen(run, id)).toBe(true);
      expect(isForkChosen(run, id)).toBe(false);
      const fork = FORKS.find((f) => f.id === id)!;
      const after = choose(run, id, 0);
      expect(after.resources[fork.currency]).toBe(
        run.resources[fork.currency] - forkCost(id)
      );
    }
  );

  it.each(FORKS.map((f) => f.id))(
    "%s: buying one side locks the other for the run",
    (id) => {
      const run = openFork(id);
      expect(canPerformAction(def, run, forkActionId(id, 0))).toBe(true);
      expect(canPerformAction(def, run, forkActionId(id, 1))).toBe(true);
      const first = choose(run, id, 0);
      expect(forkSide(first, id)).toBe(0);
      expect(canPerformAction(def, first, forkActionId(id, 1))).toBe(false);
      expect(canPerformAction(def, first, forkActionId(id, 0))).toBe(false);
      // The other side can never be bought afterwards, even with plenty.
      const rich = {
        ...first,
        resources: {
          ...first.resources,
          seeds: 1e12,
          harvest: 1e12,
          green: 1e12,
          care: 1e12,
        },
      };
      expect(performAction(def, rich, forkActionId(id, 1))).toBe(rich);
      const second = choose(run, id, 1);
      expect(forkSide(second, id)).toBe(1);
      expect(canPerformAction(def, second, forkActionId(id, 0))).toBe(false);
    }
  );

  it("has an action for every side, tagged as a choice", () => {
    expect(FORK_ACTION_IDS).toHaveLength(8);
    for (const id of FORK_ACTION_IDS) expect(def.decisionActions).toContain(id);
  });

  describe("the yard: bees or bug spray", () => {
    it("bug spray makes the sprinklers ripen much more, and closes the bees", () => {
      const run = openFork("yard");
      run.owned.sprinkler = 4;
      const bees = choose(run, "yard", 0);
      const spray = choose(run, "yard", 1);
      expect(incomePerSecond(spray) / incomePerSecond(bees)).toBeCloseTo(
        TUNING.forks.yard.sprayRipen,
        5
      );
      expect(beesWelcome(spray)).toBe(false);
      expect(beesWelcome(bees)).toBe(true);
    });

    it("hives are only on offer after the bees are asked", () => {
      const run = openFork("yard");
      run.owned.sprinkler = 5;
      const offered = (r: RunState, id: string) =>
        def.upgrades.find((u) => u.id === id)!.visibleWhen!(r);
      const bees = choose(run, "yard", 0);
      const spray = choose(run, "yard", 1);
      expect(offered(run, "bee-hive")).toBe(false);
      expect(offered(bees, "bee-hive")).toBe(true);
      expect(offered(spray, "bee-hive")).toBe(false);
      expect(
        offered(
          { ...spray, owned: { ...spray.owned, orchard: 1 } },
          "honey-stand"
        )
      ).toBe(false);
      expect(
        offered(
          { ...bees, owned: { ...bees.owned, orchard: 1 } },
          "honey-stand"
        )
      ).toBe(true);
    });

    it("a save that already keeps bees counts as the bees side", () => {
      const run = runAtPhaseStart(0);
      const old: RunState = {
        ...run,
        owned: { ...run.owned, sprinkler: 5, "bee-hive": 2 },
        revealed: [...run.revealed, "bee-hive"],
      };
      const loaded = reconcileRun(def, old);
      expect(forkSide(loaded, "yard")).toBe(0);
      expect(canPerformAction(def, loaded, forkActionId("yard", 1))).toBe(
        false
      );
    });
  });

  describe("the farm: scarecrow crew or hired hawk", () => {
    it("pay the numbers on the card", () => {
      const run = openFork("farm");
      const none = incomePerSecond(run);
      const crew = incomePerSecond(choose(run, "farm", 0));
      const hawk = incomePerSecond(choose(run, "farm", 1));
      expect(crew / none).toBeCloseTo(TUNING.forks.farm.crewIncome, 5);
      expect(hawk / none).toBeCloseTo(TUNING.forks.farm.hawkIncome, 5);
    });

    it("the hawk frightens the fair away and the crew doubles its ribbons", () => {
      const run = openFork("farm");
      run.flags["fair-open"] = true;
      expect(isFairOpen(run)).toBe(true);
      expect(isFairOpen(choose(run, "farm", 1))).toBe(false);
      expect(isFairOpen(choose(run, "farm", 0))).toBe(true);
      expect(ribbonPays(0, 100)).toBe(2400);
    });

    it("the crew makes the crops drink less", () => {
      const run = openFork("farm");
      const crew = choose(run, "farm", 0);
      expect(forkSide(crew, "farm")).toBe(0);
      expect(TUNING.forks.farm.crewThirst).toBeLessThan(1);
    });
  });

  describe("the world: old forest or wetland", () => {
    it("closes the other biome and moves the spreading to the chosen one", () => {
      const run = openFork("world");
      const forest = choose(run, "world", 0);
      expect(isBiomeLocked(forest, "wetland")).toBe(true);
      const sameActive = {
        ...forest,
        resources: { ...forest.resources, bmActive: 3 },
      };
      expect(activeBiome(sameActive)).toBe("forest");
      const wetland = choose(run, "world", 1);
      expect(isBiomeLocked(wetland, "forest")).toBe(true);
      expect(activeBiome(wetland)).toBe("wetland");
      // A closed biome cannot be picked back.
      const before = wetland.resources.bmActive;
      spreadBiome(wetland, "forest");
      expect(wetland.resources.bmActive).toBe(before);
    });

    it("pays much more green for the chosen biome", () => {
      const run = openFork("world");
      const grown = {
        ...run,
        resources: { ...run.resources, bmForest: 0.4, bmWetland: 0.4 },
      };
      const none = greenMult(grown);
      expect(greenMult(choose(grown, "world", 0))).toBeGreaterThan(none);
      expect(greenMult(choose(grown, "world", 1))).toBeGreaterThan(none);
    });

    it("wetland holds more water", () => {
      const run = openFork("world");
      const grown = {
        ...run,
        resources: { ...run.resources, bmWetland: 0.5 },
      };
      expect(waterCapacity(choose(grown, "world", 1))).toBeGreaterThan(
        waterCapacity(choose(grown, "world", 0))
      );
    });
  });

  describe("the old window box: morning sun or night-light", () => {
    it("the sun makes answers pay more, the night-light makes helpers pay more", () => {
      const run = openFork("seed");
      const none = incomePerSecond(run);
      const sun = choose(run, "seed", 0);
      const night = choose(run, "seed", 1);
      expect(incomePerSecond(sun)).toBe(none);
      expect(incomePerSecond(night) / none).toBeCloseTo(
        TUNING.forks.seed.nightHelpers,
        5
      );
      expect(canMult(sun) / canMult(run)).toBeCloseTo(
        TUNING.forks.seed.sunTap,
        5
      );
      expect(canMult(night)).toBe(canMult(run));
    });
  });

  describe("a save from before forks", () => {
    it("reads as not chosen everywhere and plays unchanged", () => {
      const run = runAtPhaseStart(1);
      const old: RunState = {
        ...run,
        resources: Object.fromEntries(
          Object.entries(run.resources).filter(([id]) => !id.startsWith("fk"))
        ),
      };
      const loaded = reconcileRun(def, old);
      for (const fork of FORKS) expect(forkSide(loaded, fork.id)).toBeNull();
      expect(incomePerSecond(loaded)).toBeCloseTo(incomePerSecond(run), 6);
    });
  });

  describe("neither side is a trap", () => {
    const bot = growBots().realistic;
    const base = bot.actions!;
    /** Seconds the realistic bot spends in the fork's phase with this side. */
    function phaseSeconds(id: ForkId, side: ForkSide): number {
      const result = simulate(def, {
        maxSeconds: 8 * 3600,
        step: 1,
        strategy: {
          ...bot,
          actions: (run, available) => [
            ...base(run, available).filter((a) => !a.startsWith("fork-")),
            ...(run.phase === PHASE_OF[id]
              ? takesFork(side)(run, available)
              : takesFork(0)(run, available)),
          ],
        },
      });
      const starts = [0, ...result.phases.map((p) => p.t)];
      const end = result.finishTime ?? result.endTime;
      const i = PHASE_OF[id];
      return (starts[i + 1] ?? end) - starts[i];
    }

    it.each(FORKS.map((f) => f.id))(
      "%s: both sides finish the part within 20% of each other",
      (id) => {
        const a = phaseSeconds(id, 0);
        const b = phaseSeconds(id, 1);
        expect(Math.abs(a - b) / Math.min(a, b)).toBeLessThan(0.2);
      }
    );
  });
});
