import {
  canPerformAction,
  newRun,
  performAction,
  tick,
  manualAction,
  visibleActions,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { lightBots } from "../bots";
import { tankCapacity } from "../tick";
import { boatArrived, litCount, warmthOf } from "../warmth";
import { sceneInfo } from "..";
import { ACTIVE, def, drain, runAtPhaseStart } from "./fixtures";

const withResources = (
  run: RunState,
  resources: Record<string, number>
): RunState => ({ ...run, resources: { ...run.resources, ...resources } });

/** A coast run with a few keepers, so the lamp panel and the oil button are on offer. */
const coastRun = (resources: Record<string, number> = {}): RunState => ({
  ...withResources(newRun(def), { ships: 30, coins: 1000, ...resources }),
  owned: { keeper: 3 },
});

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

describe("The first ship comes home", () => {
  it("starts the warmth at 30% whatever came before, with every light lit", () => {
    const start = runAtPhaseStart(3);
    expect(warmthOf(start)).toBeCloseTo(0.3, 5);
    expect(start.resources.lights).toBe(12);
    expect(litCount(start)).toBe(11);
  });

  it("puts the boat out from the first moment, with no sail to steer", () => {
    const start = runAtPhaseStart(3);
    expect(sceneInfo(start).boatVisible).toBe(1);
    expect(visibleActions(def, start).map((a) => a.id)).not.toContain(
      "steer-boat"
    );
  });

  it("stoking the flame helps a little, and a cold flame still earns resolve", () => {
    const start = runAtPhaseStart(3);
    const cold = withResources(start, { flame: 0 });
    const afterTap = manualAction(def, cold);
    expect(afterTap.resources.wmStoke).toBeGreaterThan(0);
    expect(afterTap.resources.resolve).toBeGreaterThan(cold.resources.resolve);
    expect(tick(def, cold, 10).resources.resolve).toBeGreaterThan(
      cold.resources.resolve
    );
  });

  it("ends with the game's first action: one flash, ships guided: 1", () => {
    let run = runAtPhaseStart(3);
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
    // Whatever still burned lifts off with the flash.
    expect(litCount(run)).toBe(0);
  });

  it("can always be finished from the worst state", () => {
    const worst = drain(runAtPhaseStart(3));
    const result = simulate(def, {
      startRun: worst,
      maxSeconds: 3 * 3600,
      step: 1,
      strategy: { tapsPerSecond: 0, shopEvery: 10, actions: ACTIVE.actions },
    });
    expect(result.finished).toBe(true);
  });
});

describe("the idle bot never presses a button outside the last phase", () => {
  it("does nothing but tap, shop and take a fork in the road until the ending", () => {
    const result = simulate(def, {
      maxSeconds: 8 * 3600,
      step: 1,
      strategy: lightBots().idle,
    });
    const early = result.actionsDone.filter(
      (a) => a.t < (result.finalRun.transitions[2]?.at ?? Infinity)
    );
    // A fork in the road is one shop-style click; nothing else is pressed.
    expect(early.filter((a) => !a.id.startsWith("fork-"))).toEqual([]);
  });
});
