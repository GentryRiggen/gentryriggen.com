import { canPerformAction, performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { harvestDays } from "../market";
import {
  ENTER_ACTION_ID,
  FEED_ACTION_ID,
  PUMPKIN_ACTION_IDS,
  chancesAt,
  entriesSoFar,
  expectedSeconds,
  feedCost,
  handPaysOn,
  isDayFree,
  isGiant,
  isJudging,
  isPumpkinOpen,
  lastPumpkin,
  pumpkinResultLine,
  pumpkinStep,
  ribbonFor,
  ribbonSeconds,
  splitChanceNow,
  splitsSoFar,
} from "../pumpkin";
import { dayFarmPay } from "../tick";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

const P = TUNING.pumpkin;

const FARM_START = runAtPhaseStart(1);

/** A rich farm with the fair open, at the start of a harvest day. */
function fairDay(extra: Partial<RunState["owned"]> = {}): RunState {
  const start = FARM_START;
  let run: RunState = {
    ...start,
    owned: { ...start.owned, tractor: 1, ...extra },
    resources: { ...start.resources, harvest: 1e15, mkDay: 0 },
  };
  run = tick(def, run, 1);
  for (let t = 0; t < TUNING.market.daySeconds + 1; t += 1)
    run = tick(def, run, 1);
  return run;
}

/** Next harvest day. */
function nextDay(from: RunState): RunState {
  let run = from;
  const target = harvestDays(from) + 1;
  for (let t = 0; t < 400 && harvestDays(run) < target; t += 1)
    run = tick(def, run, 1);
  return run;
}

const withStep = (run: RunState, step: number): RunState => ({
  ...run,
  resources: { ...run.resources, pkStep: step },
});

describe("the prize pumpkin", () => {
  it("opens with the first tractor, and the hawk keeps the fair away", () => {
    expect(isPumpkinOpen(FARM_START)).toBe(false);
    const run = fairDay();
    expect(isPumpkinOpen(run)).toBe(true);
    const hawk: RunState = {
      ...run,
      resources: { ...run.resources, fkFarm: 2 },
    };
    expect(isPumpkinOpen(hawk)).toBe(false);
  });

  it("can be fed or entered once on a harvest day, not both", () => {
    const run = fairDay();
    expect(isDayFree(run)).toBe(true);
    const fed = performAction(def, run, FEED_ACTION_ID);
    expect(isDayFree(fed)).toBe(false);
    for (const id of PUMPKIN_ACTION_IDS)
      expect(canPerformAction(def, fed, id)).toBe(false);
    const next = nextDay(fed);
    expect(isDayFree(next)).toBe(true);
    expect(canPerformAction(def, next, ENTER_ACTION_ID)).toBe(true);
  });

  it("grows a step when it holds, and costs harvest every time", () => {
    // pick a seed where the first feeding holds
    let run = fairDay();
    const before = run.resources.harvest;
    run = performAction(def, run, FEED_ACTION_ID);
    expect(splitsSoFar(run) + pumpkinStep(run)).toBeGreaterThanOrEqual(0);
    expect(run.resources.harvest).toBeLessThan(before);
    // the step-0 feeding never splits
    expect(splitChanceNow(fairDay())).toBe(0);
    expect(pumpkinStep(run)).toBe(1);
    expect(feedCost(fairDay(), 100)).toBe(P.feedSeconds[0] * 100);
    expect(feedCost(withStep(fairDay(), 3), 100)).toBe(P.feedSeconds[3] * 100);
  });

  it("splits at the shown chance, and a split loses everything fed to it", () => {
    for (const step of [2, 4]) {
      let splits = 0;
      const trials = 300;
      const base = withStep(fairDay(), step);
      for (let i = 0; i < trials; i += 1) {
        const run: RunState = {
          ...base,
          resources: { ...base.resources, pkRng: 1000 + i * 7919 },
        };
        const after = performAction(def, run, FEED_ACTION_ID);
        if (splitsSoFar(after) === 1) {
          splits += 1;
          expect(pumpkinStep(after)).toBe(0);
          expect(lastPumpkin(after).outcome).toBe("split");
          expect(lastPumpkin(after).step).toBe(step);
          expect(lastPumpkin(after).pays).toBe(0);
          expect(after.resources.harvest).toBeLessThan(run.resources.harvest);
        } else {
          expect(pumpkinStep(after)).toBe(step + 1);
        }
      }
      expect(Math.abs(splits / trials - P.splitChance[step])).toBeLessThan(0.1);
    }
  });

  it("shows the risk before every feeding and never says which is best", () => {
    const run = withStep(fairDay(), 3);
    const feed = def
      .actions!.find((a) => a.id === FEED_ACTION_ID)!
      .describe(run);
    const enter = def
      .actions!.find((a) => a.id === ENTER_ACTION_ID)!
      .describe(run);
    expect(feed.detail).toContain(`${Math.round(P.splitChance[3] * 100)}%`);
    expect(feed.cost?.resource).toBe("harvest");
    expect(feed.cost!.amount).toBeGreaterThan(0);
    expect(enter.detail).toMatch(/Blue \d+%, red \d+%, garden \d+%/);
    for (const v of [feed, enter])
      expect(`${v.label} ${v.detail}`).not.toMatch(/best|recommend|should/i);
  });

  it("cannot be fed past a giant", () => {
    const giant = withStep(fairDay(), P.steps);
    expect(isGiant(giant)).toBe(true);
    expect(canPerformAction(def, giant, FEED_ACTION_ID)).toBe(false);
    expect(canPerformAction(def, giant, ENTER_ACTION_ID)).toBe(true);
  });

  it("gives better ribbon chances to a bigger pumpkin, and the chances add up", () => {
    let last = 0;
    for (let step = 0; step <= P.steps; step += 1) {
      const c = chancesAt(step);
      expect(c.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      expect(c[0]).toBeGreaterThan(last);
      last = c[0];
      c.forEach((x) => expect(x).toBeGreaterThan(0));
    }
    expect(expectedSeconds(P.steps)).toBeGreaterThan(expectedSeconds(0));
  });

  it("draws a ribbon from the shown chances", () => {
    const c = chancesAt(3);
    expect(ribbonFor(c, 0)).toBe(0);
    expect(ribbonFor(c, c[0] + 1e-6)).toBe(1);
    expect(ribbonFor(c, 0.9999)).toBe(2);
  });

  it("always wins a ribbon when entered, and the pay flows in over a few seconds", () => {
    let run = withStep(fairDay(), 3);
    run = performAction(def, run, ENTER_ACTION_ID);
    expect(isJudging(run)).toBe(true);
    const harvest = run.resources.harvest;
    for (let t = 0; t < P.judgeSeconds + 1; t += 1) run = tick(def, run, 1);
    expect(isJudging(run)).toBe(false);
    expect(entriesSoFar(run)).toBe(1);
    const result = lastPumpkin(run);
    expect(["blue", "red", "green"]).toContain(result.outcome);
    expect(result.pays).toBeGreaterThan(0);
    expect(pumpkinStep(run)).toBe(0);
    expect(pumpkinResultLine(run)).toMatch(/ribbon/i);
    for (let t = 0; t < 10; t += 1) run = tick(def, run, 1);
    expect(run.resources.harvest).toBeGreaterThan(harvest);
  });

  it("draws its own random stream and leaves run.rng alone", () => {
    const run = fairDay();
    const fed = performAction(def, run, FEED_ACTION_ID);
    expect(fed.rng).toBe(run.rng);
    expect(fed.resources.pkRng).not.toBe(run.resources.pkRng);
  });

  it("has a helper who enters a grown pumpkin on a day you did not, for less", () => {
    const run = withStep(fairDay({ "fair-hand": 1 }), 2);
    let r = run;
    for (let t = 0; t < P.handDelay - 6; t += 1) r = tick(def, r, 1);
    expect(isJudging(r)).toBe(false);
    for (let t = 0; t < 12; t += 1) r = tick(def, r, 1);
    expect(entriesSoFar(r) + (isJudging(r) ? 1 : 0)).toBe(1);
    expect(handPaysOn(run, dayFarmPay(run))).toBeCloseTo(
      expectedSeconds(2) * dayFarmPay(run) * P.handShare,
      6
    );
  });

  it("never gets in the way of a seedling: the helper leaves a seedling alone", () => {
    const run = fairDay({ "fair-hand": 1 });
    let r = run;
    for (let t = 0; t < 60; t += 1) r = tick(def, r, 1);
    expect(entriesSoFar(r)).toBe(0);
  });
});

describe("the pumpkin is a real bet", () => {
  /**
   * Seconds of farm pay per harvest day for the plan "feed until step `k`,
   * enter, repeat" (a split starts the cycle again from a seedling). Feeding
   * and entering each take the day's one turn, so a day spent feeding is a
   * day not entered.
   */
  function perDay(k: number): number {
    let reward = 0;
    let days = 0;
    let alive = 1;
    for (let step = 0; step < k; step += 1) {
      // Fed from `step`: the cost is paid, the day is used, it may split.
      reward -= alive * P.feedSeconds[step];
      days += alive;
      alive *= 1 - P.splitChance[step];
    }
    reward += alive * expectedSeconds(k);
    days += alive;
    return reward / days;
  }

  it("some feed-then-enter plan beats entering the seedling every day", () => {
    const plans = Array.from({ length: P.steps + 1 }, (_, k) => perDay(k));
    expect(Math.max(...plans)).toBeGreaterThan(plans[0] * 1.25);
  });

  it("feeding all the way to a giant is not the best plan either: the bet has an edge", () => {
    const plans = Array.from({ length: P.steps + 1 }, (_, k) => perDay(k));
    const best = plans.indexOf(Math.max(...plans));
    expect(best).toBeGreaterThan(1);
    expect(best).toBeLessThan(P.steps);
  });

  it("a bigger pumpkin's ribbons pay more", () => {
    for (let step = 1; step <= P.steps; step += 1)
      for (let ribbon = 0; ribbon < 3; ribbon += 1)
        expect(ribbonSeconds(ribbon, step)).toBeGreaterThan(
          ribbonSeconds(ribbon, step - 1)
        );
  });
});
