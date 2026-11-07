import {
  canPerformAction,
  newRun,
  performAction,
  startProject,
  tick,
} from "../../../engine/engine";
import { DEFAULT_SEED } from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import {
  footingPolicy,
  holdsOvertime,
  higherBots,
  placesLoad,
  playsPlayroom,
  steadiesAt,
  together,
} from "../bots";
import {
  LOAD_ACTION_IDS,
  bestLoad,
  loadActionId,
  loadPays,
} from "../deliveries";
import {
  FOOTING_ACTION_IDS,
  footingActionId,
  footingStock,
  gainOf,
} from "../footing";
import {
  FORKS,
  forkActionId,
  forkCost,
  forkSide,
  isForkChosen,
  type ForkId,
  type ForkSide,
} from "../forks";
import { OVERTIME_ACTION_ID, isOvertimeOn, knowhowOf } from "../knowhow";
import { STEADY_ACTION_ID, swayFactor, swayOf } from "../sway";
import { leanTarget, tumbleChance } from "../playroom";
import { incomePerSecond } from "../tick";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart, withResources } from "./fixtures";

const HOUR = 3600;
const FORK_IDS: readonly ForkId[] = ["play", "town", "sky", "top"];

/** Minutes the realistic bot spends in each phase with these fork sides and footing share. */
function phaseMinutes(sides: readonly ForkSide[], footing: number): number[] {
  const base = higherBots().realistic;
  const pick: Strategy["actions"] = (run, available) => {
    const id = forkActionId(FORK_IDS[run.phase], sides[run.phase]);
    return available.includes(id) ? [id] : [];
  };
  const result = simulate(def, {
    maxSeconds: 8 * HOUR,
    step: 1,
    strategy: {
      ...base,
      actions: together(
        pick,
        steadiesAt(0.75, 5),
        playsPlayroom({ pace: 2, bank: "reads" }, 5),
        placesLoad(15),
        footingPolicy(footing, 20),
        holdsOvertime
      ),
    },
  });
  const starts = [0, ...result.phases.map((p) => p.t)];
  const end = result.finishTime ?? result.endTime;
  return def.phases.map((_, i) => ((starts[i + 1] ?? end) - starts[i]) / 60);
}

jest.setTimeout(120_000);

describe("Build It Higher trade-offs", () => {
  describe("forks", () => {
    it("has an either-or choice in every phase, each side with a catch", () => {
      expect(FORKS.map((f) => f.phase)).toEqual(def.phases.map((p) => p.id));
      for (const fork of FORKS)
        for (const side of fork.sides) {
          expect(side.name.length).toBeGreaterThan(3);
          expect(side.blurb.length).toBeGreaterThan(20);
          expect(side.catchLine.length).toBeGreaterThan(10);
        }
    });

    it.each(FORK_IDS.map((id, i) => [id, i] as const))(
      "%s: choosing one side closes the other for the run",
      (id, phase) => {
        const base = runAtPhaseStart(phase);
        const rich = withResources(base, {
          [def.phases[phase].manualResource]: forkCost(id) * 5,
        });
        const run: RunState = {
          ...rich,
          owned: {
            ...rich.owned,
            [["bear", "mason", "sky-crew", "stair-lamp"][phase]]: 4,
          },
        };
        const first = performAction(def, run, forkActionId(id, 0));
        expect(forkSide(first, id)).toBe(0);
        expect(isForkChosen(first, id)).toBe(true);
        expect(canPerformAction(def, first, forkActionId(id, 1))).toBe(false);
        expect(canPerformAction(def, first, forkActionId(id, 0))).toBe(false);
      }
    );

    it("keeps both sides of every fork within about 20% of each other", () => {
      for (const [i, id] of FORK_IDS.entries()) {
        const a = phaseMinutes(
          [0, 0, 0, 0].map((_, j) => (j === i ? 0 : 0)) as ForkSide[],
          1
        )[i];
        const b = phaseMinutes(
          [0, 0, 0, 0].map((_, j) => (j === i ? 1 : 0)) as ForkSide[],
          1
        )[i];
        const ratio = b / a;
        expect([id, ratio >= 0.8 && ratio <= 1.25]).toEqual([id, true]);
      }
    });
  });

  describe("foundations (spend now or invest)", () => {
    it("pays a quarter back better than spending it all, and half is no waste either", () => {
      const spend = phaseMinutes([0, 0, 1, 0], 0);
      const quarter = phaseMinutes([0, 0, 1, 0], 1);
      const half = phaseMinutes([0, 0, 1, 0], 2);
      const total = (xs: number[]) => xs.slice(0, 3).reduce((a, b) => a + b, 0);
      // Investing a quarter beats spending everything by a clear margin ...
      expect(total(spend) / total(quarter)).toBeGreaterThan(1.08);
      // ... and keeping half is a real option, not a trap.
      expect(total(half) / total(quarter)).toBeLessThan(1.25);
      expect(total(half) / total(quarter)).toBeGreaterThan(0.9);
    });

    it("keeps nothing by default in the playroom and a quarter after", () => {
      const play = runAtPhaseStart(0);
      expect(play.resources.ftStep).toBe(0);
      expect(runAtPhaseStart(1).resources.ftStep).toBe(1);
    });

    it("raises every payout and slows the lean once there is some footing", () => {
      const base = runAtPhaseStart(1);
      const run = { ...base, owned: { mason: 3 } };
      const richer = withResources(run, { ftStock: 20000 });
      expect(gainOf(richer)).toBeGreaterThan(0);
      expect(incomePerSecond(richer)).toBeGreaterThan(incomePerSecond(run));
    });

    it("has a radio button for each share and nothing is lost by changing it", () => {
      expect(FOOTING_ACTION_IDS).toHaveLength(3);
      const base = runAtPhaseStart(1);
      const run: RunState = { ...base, owned: { ...base.owned, mason: 3 } };
      const there = performAction(def, run, footingActionId(2));
      const back = performAction(def, there, footingActionId(0));
      expect(back.resources.ftStep).toBe(0);
      expect(footingStock(back)).toBe(footingStock(there));
    });
  });

  describe("know-how (one currency, two sinks)", () => {
    const town = (): RunState => {
      const base = runAtPhaseStart(1);
      return withResources(
        {
          ...base,
          owned: { mason: 3, "cross-braces": 1 },
          revealed: [...base.revealed, "cross-braces"],
        },
        { knowhow: TUNING.knowhow.overtimeCost + TUNING.knowhow.costs[0] - 1 }
      );
    };

    it("buys either a lasting project or an overtime shift, never both from the same pile", () => {
      const run = town();
      const shift = performAction(def, run, OVERTIME_ACTION_ID);
      expect(isOvertimeOn(shift)).toBe(true);
      expect(knowhowOf(shift)).toBe(
        knowhowOf(run) - TUNING.knowhow.overtimeCost
      );
      // What is left is not enough for the first project.
      expect(startProject(def, shift, "hard-hats")).toBe(shift);
      // The same pile pays for the project instead, if chosen first.
      // (a moment's tick lets the project show up on the shelf first)
      const funded = tick(
        def,
        withResources(run, { knowhow: TUNING.knowhow.costs[0] }),
        1
      );
      const project = startProject(def, funded, "hard-hats");
      expect(project).not.toBe(funded);
      expect(knowhowOf(project)).toBeLessThan(1);
    });

    it("overtime makes everything pay more, and runs out by itself", () => {
      const run = town();
      const shift = performAction(def, run, OVERTIME_ACTION_ID);
      expect(incomePerSecond(shift)).toBeCloseTo(
        incomePerSecond(run) * TUNING.knowhow.overtimeMult,
        6
      );
      let later = shift;
      for (let t = 0; t < TUNING.knowhow.overtimeSeconds + 2; t += 1)
        later = tick(def, later, 1);
      expect(isOvertimeOn(later)).toBe(false);
    });
  });

  describe("the playroom's lean", () => {
    const crew = (extra: Record<string, number> = {}): RunState => {
      const base = runAtPhaseStart(0);
      return {
        ...base,
        owned: { bear: 3, ...extra },
        resources: { ...base.resources, pcPace: 3, pcEff: 3 },
      };
    };

    it("is leaned on less by the wide fork, by every rug corner and by the fort", () => {
      const plain = leanTarget(crew());
      expect(leanTarget(withResources(crew(), { fkPlay: 2 }))).toBeLessThan(
        plain * 0.5
      );
      expect(leanTarget(withResources(crew(), { fkPlay: 1 }))).toBeGreaterThan(
        plain
      );
      let last = plain;
      for (const level of [1, 2, 3]) {
        const now = leanTarget(crew({ "rug-corners": level }));
        expect(now).toBeLessThan(last);
        last = now;
      }
      expect(
        leanTarget(crew({ "rug-corners": 3, "cushion-fort": 1 }))
      ).toBeLessThan(last * 0.6);
    });
  });

  describe("sway (a managed risk, never a punishment)", () => {
    it("never takes more than half of the pay, however long it is left", () => {
      const base = runAtPhaseStart(1);
      const wobbling = withResources(base, { sway: 1 });
      expect(swayFactor(wobbling)).toBeGreaterThanOrEqual(0.5);
      expect(swayFactor(withResources(base, { sway: 0 }))).toBe(1);
    });

    it("builds up on its own in the town and one press of Steady puts it right", () => {
      let run = { ...runAtPhaseStart(1), owned: { mason: 4 } } as RunState;
      for (let t = 0; t < 400; t += 1) run = tick(def, run, 1);
      expect(swayOf(run)).toBeGreaterThan(0.5);
      const steadied = performAction(def, run, STEADY_ACTION_ID);
      expect(swayOf(steadied)).toBe(0);
    });

    it("has no Steady button in the playroom, where the build pace sets the lean", () => {
      const run = { ...runAtPhaseStart(0), owned: { bear: 4 } } as RunState;
      expect(swayOf(run)).toBe(0);
      expect(canPerformAction(def, run, STEADY_ACTION_ID)).toBe(false);
    });

    it("needs the button less once the tower is braced", () => {
      const base = { ...runAtPhaseStart(1), owned: { mason: 4 } } as RunState;
      const braced = {
        ...base,
        owned: { ...base.owned, "cross-braces": 3, "safety-nets": 1 },
      };
      const settle = (start: RunState): number => {
        let run = start;
        for (let t = 0; t < 1200; t += 1) run = tick(def, run, 1);
        return swayOf(run);
      };
      expect(settle(braced)).toBeLessThan(settle(base) - 0.2);
    });
  });

  describe("deliveries", () => {
    const here = (): RunState => {
      const base = runAtPhaseStart(0);
      return withResources(
        { ...base, owned: { bear: 3 } },
        { dlStage: 1, blocks: 100 }
      );
    };

    it("offers three loads that each pay something different", () => {
      const run = here();
      const pays = [0, 1, 2].map((o) => loadPays(run, o, 100));
      expect(new Set(pays.map((p) => Math.round(p))).size).toBe(3);
      for (const id of LOAD_ACTION_IDS)
        expect(canPerformAction(def, run, id)).toBe(true);
    });

    it("says the base stone is best while the footing is empty", () => {
      expect(bestLoad(here(), 100)).toBe(2);
    });

    it("says the pole is best when the tower leans, and the blocks when it is straight and well founded", () => {
      const straight = withResources(here(), { ftStock: 1e9 });
      expect(bestLoad(straight, 100)).toBe(0);
      const leaning = withResources(straight, { pcLean: 0.95 });
      expect(bestLoad(leaning, 100)).toBe(1);
    });

    it("softens the next tumbles when the pillow is placed in the playroom", () => {
      const run = withResources(here(), { pcStreak: 5 });
      const before = tumbleChance(run);
      const placed = performAction(def, run, loadActionId(1));
      expect(tumbleChance(placed)).toBeCloseTo(before / 2, 6);
      expect(placed.resources.dlStage).toBe(0);
    });

    it("straightens the tower when the pole is placed in the town", () => {
      const base = runAtPhaseStart(1);
      const leaning = withResources(
        {
          ...base,
          owned: { mason: 3 },
          resources: { ...base.resources, dlStage: 1 },
        },
        { sway: 0.9 }
      );
      const placed = performAction(def, leaning, loadActionId(1));
      expect(swayOf(placed)).toBeLessThan(0.3);
      expect(placed.resources.dlStage).toBe(0);
    });

    it("waits as long as it takes and is never lost", () => {
      let run = here();
      for (let t = 0; t < 600; t += 1) run = tick(def, run, 1);
      expect(run.resources.dlStage).toBe(1);
      expect(canPerformAction(def, run, loadActionId(0))).toBe(true);
    });
  });

  describe("no luck in the run's own stream", () => {
    it("never draws from the run's random numbers (the tumbles and the toddler have their own), so a whole run is the same every time", () => {
      const run = simulate(def, {
        strategy: higherBots().tapper,
        maxSeconds: 8 * HOUR,
        step: 1,
      }).finalRun;
      expect(run.rng).toBe(newRun(def).rng);
      expect(run.rng).toBe(DEFAULT_SEED);
    });
  });
});
