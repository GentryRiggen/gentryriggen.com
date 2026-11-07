import {
  canPerformAction,
  performAction,
  startProject,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import {
  PARADE_ACTION_ID,
  isParadeOn,
  isParadeResting,
  knowhowOf,
  paradeCost,
} from "../knowhow";
import { currentWant, isWanting, tendActionId, tendsSoFar } from "../quiet";
import { incomePerSecond, manualPerTap } from "../tick";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

const advance = (run: RunState, seconds: number, step = 1): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += step) next = tick(def, next, step);
  return next;
};

describe("Smile trade-offs", () => {
  describe("one currency, two sinks: know-how (the world)", () => {
    function townRun(): RunState {
      const start = runAtPhaseStart(2);
      return {
        ...start,
        owned: { ...start.owned, poster: 4, loudspeaker: 2 },
        flags: { ...start.flags },
        resources: { ...start.resources, knowhow: 200, mtHeat: 0, mtTired: 0 },
      };
    }

    it("buys a permanent project or a repeatable parade, not both", () => {
      const run = advance(townRun(), 1);
      const project = def.projects!.find((p) => p.id === "every-language")!;
      const price = project.costs[0].amount;
      const afterProject = startProject(def, run, "every-language");
      expect(afterProject).not.toBe(run);
      expect(knowhowOf(afterProject)).toBeLessThan(knowhowOf(run) - price + 5);
      const afterParade = performAction(def, run, PARADE_ACTION_ID);
      expect(isParadeOn(afterParade)).toBe(true);
      expect(knowhowOf(afterParade)).toBeLessThan(knowhowOf(run));
      // A parade can be held again; a project is done for good.
      expect(startProject(def, afterProject, "every-language")).toBe(
        afterProject
      );
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
