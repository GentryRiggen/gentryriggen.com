import {
  buy,
  canPerformAction,
  newRun,
  performAction,
  tick,
  manualAction,
  visibleActions,
  visibleUpgrades,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { lightBots } from "../bots";
import {
  LET_GO_GIFTS,
  boatArrived,
  flameOf,
  steadyFlame,
  strainPerSecond,
  tankCapacity,
} from "../tick";
import { sceneInfo } from "..";
import { ACTIVE, def, drain, runAtPhaseStart } from "./fixtures";

const withResources = (
  run: RunState,
  resources: Record<string, number>
): RunState => ({ ...run, resources: { ...run.resources, ...resources } });

const coastRun = (resources: Record<string, number> = {}): RunState =>
  withResources(newRun(def), { ships: 30, coins: 1000, ...resources });

describe("one click fills the tank", () => {
  it("fills the whole tank when the coins allow", () => {
    const run = coastRun({ oil: 0, oilPrice: 1, coins: 1000 });
    const after = performAction(def, run, "buy-oil");
    expect(after.resources.oil).toBeCloseTo(tankCapacity(run), 5);
    expect(after.resources.coins).toBeCloseTo(1000 - tankCapacity(run) * 1, 5);
  });

  it("buys as much as the coins can pay for when they are short", () => {
    const run = coastRun({ oil: 0, oilPrice: 2, coins: 30 });
    const after = performAction(def, run, "buy-oil");
    expect(after.resources.oil).toBeCloseTo(15, 5);
    expect(after.resources.coins).toBeCloseTo(0, 5);
  });

  it("never shrinks the barrel as the bank shrinks", () => {
    // Two clicks in a row from a poor bank used to give a smaller barrel each
    // time (a share of what was left). Now one click spends what it can.
    const first = performAction(
      def,
      coastRun({ oil: 0, oilPrice: 2, coins: 40 }),
      "buy-oil"
    );
    expect(first.resources.oil).toBeCloseTo(20, 5);
    expect(canPerformAction(def, first, "buy-oil")).toBe(false);
  });
});

describe("bonus windows wait for the player", () => {
  const night = (): RunState => {
    const start = runAtPhaseStart(1);
    return {
      ...start,
      owned: { ...start.owned, gen1: 3 },
      resources: { ...start.resources, supply: 9, rush: 0, rushCooldown: 1 },
    };
  };

  it("opens, then stays open however long it is ignored", () => {
    let run = night();
    for (let i = 0; i < 600; i += 1) run = tick(def, run, 1);
    expect(run.resources.rush).toBe(1);
    expect(canPerformAction(def, run, "ride-rush")).toBe(true);
  });

  it("does not start the next one until this one is claimed", () => {
    const run = night();
    run.resources.rush = 1;
    run.resources.rushCooldown = 0;
    const later = tick(def, tick(def, run, 1), 1);
    expect(later.resources.rushCooldown).toBe(0);
    const claimed = performAction(def, later, "ride-rush");
    expect(claimed.resources.rush).toBe(0);
    expect(claimed.resources.rushCooldown).toBeGreaterThanOrEqual(100);
  });

  it("does not make the grid strain faster", () => {
    const calm = night();
    const busy = night();
    busy.resources.rush = 1;
    expect(strainPerSecond(busy)).toBe(strainPerSecond(calm));
  });

  it("pays about 25 seconds of income, not more", () => {
    const run = night();
    run.resources.rush = 1;
    const after = performAction(def, run, "ride-rush");
    const bonus = after.resources.power - run.resources.power;
    const perSecond = tick(def, run, 1).resources.power - run.resources.power;
    expect(bonus).toBeLessThanOrEqual(perSecond * 30 + 100);
  });
});

describe("The first ship comes home", () => {
  /** Lets go of a light by paying for it. */
  const letGo = (run: RunState, id: string): RunState => {
    const rich = withResources(run, { resolve: 1e6 });
    return buy(def, rich, id);
  };

  it("starts the flame at 600 whatever came before", () => {
    const start = runAtPhaseStart(3);
    expect(flameOf(start)).toBe(600);
  });

  it("offers three lights at once, in any order, each with a different gift", () => {
    const start = runAtPhaseStart(3);
    const offered = visibleUpgrades(def, start).map((u) => u.id);
    expect(offered).toHaveLength(3);
    expect(new Set(offered.map((id) => LET_GO_GIFTS[id])).size).toBe(3);
    // The last one on offer can be let go first.
    const third = letGo(start, offered[2]);
    expect(third.owned[offered[2]]).toBe(1);
    expect(third.resources.lights).toBe(11);
  });

  it("every gift does something you can feel", () => {
    const start = runAtPhaseStart(3);
    const burst = letGo(start, "letgo-signs");
    expect(flameOf(burst)).toBeGreaterThan(flameOf(start));
    const fade = letGo(start, "letgo-porch");
    expect(steadyFlame(fade)).toBeGreaterThan(steadyFlame(start));
    const taps = letGo(start, "letgo-stadium");
    expect(steadyFlame(taps)).toBeGreaterThan(steadyFlame(start));
  });

  it("tapping the flame matters, and a cold flame still lets go", () => {
    const start = runAtPhaseStart(3);
    const cold = withResources(start, { flame: 0 });
    const afterTap = manualAction(def, cold);
    expect(afterTap.resources.flame).toBeGreaterThan(0);
    expect(afterTap.resources.resolve).toBeGreaterThan(cold.resources.resolve);
    expect(tick(def, cold, 10).resources.resolve).toBeGreaterThan(
      cold.resources.resolve
    );
  });

  /** A run in the last phase with this many lights left. */
  function withLightsLeft(left: number): RunState {
    let run = runAtPhaseStart(3);
    for (const light of Object.keys(LET_GO_GIFTS)) {
      if (run.resources.lights <= left) break;
      for (let i = 0; i < 3; i += 1) {
        run = letGo(tick(def, run, 1), light);
      }
    }
    return run;
  }

  it("shows the sea and a small boat at three lights left, not before", () => {
    expect(sceneInfo(withLightsLeft(4)).boatVisible).toBe(0);
    const run = withLightsLeft(3);
    expect(run.resources.lights).toBe(3);
    expect(sceneInfo(run).boatVisible).toBe(1);
    expect(visibleActions(def, run).map((a) => a.id)).toContain("steer-boat");
  });

  it("drifts gently and tapping the old beam steers it back", () => {
    let run = withLightsLeft(3);
    run = tick(def, run, 60);
    expect(run.resources.boatHeading).toBeLessThan(100);
    expect(run.resources.boatHeading).toBeGreaterThan(40);
    run.resources.boatHeading = 30;
    const steered = performAction(def, run, "steer-boat");
    expect(steered.resources.boatHeading).toBeGreaterThan(60);
  });

  it("ends with the game's first action: one flash, ships guided: 1", () => {
    let run = withLightsLeft(1);
    expect(canPerformAction(def, run, "flash-lamp")).toBe(false);
    run.resources.boatProgress = 100;
    expect(boatArrived(run)).toBe(true);
    expect(canPerformAction(def, run, "flash-lamp")).toBe(true);
    expect(run.resources.ships).toBe(0);
    run = performAction(def, run, "flash-lamp");
    expect(run.resources.ships).toBe(1);
    expect(run.complete).toBe(true);
    expect(sceneInfo(run).finished).toBe(1);
    expect(run.story).toContain("last-remember");
  });

  it("can always be finished from the worst state", () => {
    const worst = drain(runAtPhaseStart(3));
    const result = simulate(def, {
      startRun: worst,
      maxSeconds: 2 * 3600,
      step: 1,
      strategy: { tapsPerSecond: 0, shopEvery: 10, actions: ACTIVE.actions },
    });
    expect(result.finished).toBe(true);
  });
});

describe("the first ship is logged in the coast", () => {
  it("notes the moment and the weather of the very first ship", () => {
    let run = newRun(def);
    run = manualAction(def, tick(def, run, 3));
    expect(run.flags.firstShip).toBe(true);
    expect(run.resources.firstShipAt).toBeGreaterThan(0);
    expect(run.resources.firstShipStorm).toBe(0);
    expect(sceneInfo(run).firstShipSeconds).toBe(
      Math.floor(run.resources.firstShipAt)
    );
  });
});

describe("the idle bot never presses a button outside the last phase", () => {
  it("does nothing but tap and shop until the ending", () => {
    const result = simulate(def, {
      maxSeconds: 8 * 3600,
      step: 1,
      strategy: lightBots().idle,
    });
    const early = result.actionsDone.filter(
      (a) => a.t < (result.finalRun.transitions[2]?.at ?? Infinity)
    );
    expect(early).toEqual([]);
  });
});
