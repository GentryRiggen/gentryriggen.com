import {
  canPerformAction,
  newRun,
  performAction,
  startProject,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { BOND_SHARES, bondActionId, bondStock } from "../bond";
import { FETCH_ACTION_ID, isBallReady } from "../fetch";
import {
  PARADE_ACTION_ID,
  isParadeOn,
  isParadeResting,
  knowhowOf,
  paradeCost,
} from "../knowhow";
import { heatOf, isTired, tiredMult } from "../meter";
import { currentWant, isWanting, tendActionId, tendsSoFar } from "../quiet";
import { incomePerSecond, manualPerTap } from "../tick";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

const advance = (run: RunState, seconds: number, step = 1): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += step) next = tick(def, next, step);
  return next;
};

/** A friend run with a bracelet and a few helpers, ready to set smiles aside. */
function bankRun(): RunState {
  const run = newRun(def);
  return {
    ...run,
    owned: { balloon: 3, puppy: 2, bracelet: 1 },
    resources: { ...run.resources, smiles: 0 },
  };
}

describe("Smile trade-offs", () => {
  describe("spend now or invest: the friendship bank", () => {
    it("pays less now and more later the more you set aside", () => {
      const after = (step: number) => {
        let run = performAction(def, bankRun(), bondActionId(step));
        run = advance(run, 600);
        return {
          smiles: run.resources.smiles,
          perTap: manualPerTap(run),
          stock: bondStock(run),
        };
      };
      const none = after(0);
      const quarter = after(1);
      const half = after(2);
      // Early on, setting smiles aside leaves fewer to spend.
      const early = (step: number) =>
        advance(performAction(def, bankRun(), bondActionId(step)), 30).resources
          .smiles;
      expect(early(2)).toBeLessThan(early(1));
      expect(early(1)).toBeLessThan(early(0));
      // Later, the bank makes every laugh bigger than a plain friendship.
      expect(none.stock).toBe(0);
      expect(quarter.stock).toBeGreaterThan(0);
      expect(half.stock).toBeGreaterThan(quarter.stock);
      expect(quarter.perTap).toBeGreaterThan(0);
    });

    it("is open only with the bracelet, and never loses what you set aside by switching", () => {
      const closed = { ...bankRun(), owned: { balloon: 3, puppy: 2 } };
      expect(canPerformAction(def, closed, bondActionId(1))).toBe(false);
      expect(BOND_SHARES).toEqual([0, 0.25, 0.5]);
      let run = performAction(def, bankRun(), bondActionId(2));
      run = advance(run, 120);
      const stock = bondStock(run);
      run = performAction(def, run, bondActionId(0));
      expect(bondStock(run)).toBeGreaterThanOrEqual(stock * 0.95);
    });
  });

  describe("one currency, two sinks: know-how", () => {
    function townRun(): RunState {
      const start = runAtPhaseStart(1);
      return {
        ...start,
        owned: { ...start.owned, clown: 4, band: 2, "smile-factory": 1 },
        flags: { ...start.flags },
        resources: { ...start.resources, knowhow: 200, mtHeat: 0, mtTired: 0 },
      };
    }

    it("buys a permanent project or a repeatable parade, not both", () => {
      const run = advance(townRun(), 1);
      const project = def.projects!.find((p) => p.id === "big-top")!;
      const price = project.costs[0].amount;
      const afterProject = startProject(def, run, "big-top");
      expect(afterProject).not.toBe(run);
      expect(knowhowOf(afterProject)).toBeLessThan(knowhowOf(run) - price + 5);
      const afterParade = performAction(def, run, PARADE_ACTION_ID);
      expect(isParadeOn(afterParade)).toBe(true);
      expect(knowhowOf(afterParade)).toBeLessThan(knowhowOf(run));
      // A parade can be held again; a project is done for good.
      expect(startProject(def, afterProject, "big-top")).toBe(afterProject);
    });

    it("lets the crowd rest between parades", () => {
      let run = advance(townRun(), 1);
      run = performAction(def, run, PARADE_ACTION_ID);
      run = advance(run, TUNING.knowhow.paradeSeconds + 1);
      expect(isParadeOn(run)).toBe(false);
      expect(isParadeResting(run)).toBe(true);
      expect(canPerformAction(def, run, PARADE_ACTION_ID)).toBe(false);
      run = advance(run, TUNING.knowhow.paradeRest + 1);
      expect(isParadeResting(run)).toBe(false);
      expect(paradeCost()).toBeLessThanOrEqual(knowhowOf(run));
      expect(canPerformAction(def, run, PARADE_ACTION_ID)).toBe(true);
    });

    it("pays more while a parade is on", () => {
      const run = advance(townRun(), 1);
      const on = performAction(def, run, PARADE_ACTION_ID);
      expect(incomePerSecond(on)).toBeGreaterThan(incomePerSecond(run) * 1.4);
      expect(manualPerTap(on)).toBeGreaterThan(manualPerTap(run) * 1.4);
    });
  });

  describe("a managed risk: the cheer meter", () => {
    const town = (): RunState => {
      const start = runAtPhaseStart(1);
      return {
        ...start,
        resources: { ...start.resources, mtHeat: 0, mtTired: 0 },
      };
    };

    it("warms with taps and settles instead of rising for ever at a steady pace", () => {
      let run = town();
      for (let s = 0; s < 120; s += 1) {
        for (let t = 0; t < 3; t += 1) run = manualActionFor(run);
        run = tick(def, run, 1);
      }
      expect(heatOf(run)).toBeGreaterThan(0.3);
      expect(heatOf(run)).toBeLessThan(1);
      expect(isTired(run)).toBe(false);
    });

    it("wears the crowd out when mashed hard, and never takes more than 40% of the pay", () => {
      let run = town();
      for (let s = 0; s < 120; s += 1) {
        for (let t = 0; t < 12; t += 1) run = manualActionFor(run);
        run = tick(def, run, 1);
      }
      expect(isTired(run)).toBe(true);
      expect(tiredMult(run)).toBe(TUNING.meter.tiredMult);
      expect(tiredMult(run)).toBeGreaterThanOrEqual(0.6);
      expect(manualPerTap(run)).toBeGreaterThan(0);
    });

    it("cools on its own, and a rested crowd pays in full again", () => {
      let run = town();
      for (let s = 0; s < 60; s += 1) {
        for (let t = 0; t < 12; t += 1) run = manualActionFor(run);
        run = tick(def, run, 1);
      }
      expect(isTired(run)).toBe(true);
      run = advance(run, 90);
      expect(isTired(run)).toBe(false);
      expect(heatOf(run)).toBeLessThan(0.4);
    });

    it("is gone in the first and last parts", () => {
      expect(heatOf(runAtPhaseStart(0))).toBe(0);
      expect(heatOf({ ...runAtPhaseStart(3), resources: { mtHeat: 1 } })).toBe(
        0
      );
    });

    it("blocks a parade while the crowd is too warm", () => {
      let run = town();
      run = {
        ...run,
        owned: { ...run.owned, clown: 3 },
        resources: { ...run.resources, knowhow: 500, mtHeat: 0.9 },
      };
      expect(canPerformAction(def, run, PARADE_ACTION_ID)).toBe(false);
    });
  });

  describe("fetch: a claim that never expires", () => {
    it("brings the ball back after a rest, and a throw pays a burst of smiles", () => {
      const run = newRun(def);
      let next: RunState = { ...run, owned: { balloon: 2, puppy: 1 } };
      expect(isBallReady(next)).toBe(false);
      next = advance(next, TUNING.fetch.restSeconds + 1);
      expect(isBallReady(next)).toBe(true);
      next = advance(next, 600);
      expect(isBallReady(next)).toBe(true);
      const before = next.resources.smiles;
      const after = performAction(def, next, FETCH_ACTION_ID);
      expect(after.resources.smiles).toBeGreaterThan(before);
      expect(isBallReady(after)).toBe(false);
    });
  });

  describe("the friend on the bench: nothing is ever wrong", () => {
    it("pays for every answer, the fitting one most", () => {
      const start = runAtPhaseStart(3);
      let run = advance(
        { ...start, resources: { ...start.resources, qtTends: 1 } },
        40
      );
      expect(isWanting(run)).toBe(true);
      const right = currentWant(run);
      const wrong = (right + 1) % 3;
      const pay = (choice: number) =>
        performAction(def, run, tendActionId(choice)).resources.patience -
        run.resources.patience;
      expect(pay(wrong)).toBeGreaterThan(0);
      expect(pay(right)).toBeGreaterThan(pay(wrong));
      run = performAction(def, run, tendActionId(right));
      expect(tendsSoFar(run)).toBe(2);
      expect(isWanting(run)).toBe(false);
    });
  });
});

function manualActionFor(run: RunState): RunState {
  // One tap, the way the game does it.
  const next = {
    ...run,
    resources: { ...run.resources },
    flags: { ...run.flags },
  };
  def.manualAction(next);
  return next;
}
