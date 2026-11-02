import {
  canPerformAction,
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { lightBots } from "../bots";
import {
  DEPOSIT_SHARES,
  WITHDRAW_ACTION,
  depositActionId,
  fundBalance,
  fundFee,
  fundKind,
  fundPayout,
  fundScale,
  fundYieldPerSecond,
  isFundOpen,
} from "../fund";
import { TUNING } from "../tuning";

jest.setTimeout(120_000);

const F = TUNING.fund;

/** A coast run with the jar open and a purse of coins. */
function coastRun(coins = 1000): RunState {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    resources: { ...base.resources, ships: 200, coins },
  });
}

describe("the fund", () => {
  it("opens at a milestone in every part, and is not there before", () => {
    expect(isFundOpen(newRun(def))).toBe(false);
    expect(isFundOpen(coastRun())).toBe(true);
    const night = reconcileRun(def, {
      ...newRun(def),
      phase: 1,
      owned: { gen1: 2 },
    });
    expect(isFundOpen(night)).toBe(true);
    expect(fundKind(night).currency).toBe("power");
    const sky = reconcileRun(def, {
      ...newRun(def),
      phase: 2,
      owned: { collector: 3 },
    });
    expect(fundKind(sky).name).toBe("Starlight Vault");
    expect(isFundOpen(sky)).toBe(true);
    const last = reconcileRun(def, { ...newRun(def), phase: 3 });
    expect(fundKind(last).currency).toBe("resolve");
  });

  it("takes a share of the coins in, and they stop being spendable", () => {
    const run = coastRun(1000);
    const after = performAction(def, run, depositActionId(0.25));
    expect(fundBalance(after)).toBeCloseTo(250);
    expect(after.resources.coins).toBeCloseTo(750);
    const all = performAction(def, run, depositActionId(1));
    expect(fundBalance(all)).toBeCloseTo(1000);
    expect(all.resources.coins).toBeCloseTo(0);
  });

  it("refuses an empty deposit and an empty withdrawal", () => {
    const broke = coastRun(0);
    for (const share of DEPOSIT_SHARES)
      expect(canPerformAction(def, broke, depositActionId(share))).toBe(false);
    expect(canPerformAction(def, coastRun(), WITHDRAW_ACTION)).toBe(false);
  });

  it("grows what is in it, a little faster the less there is", () => {
    const income = 50;
    const small = fundYieldPerSecond(100, income) / 100;
    const big = fundYieldPerSecond(10000, income) / 10000;
    expect(small).toBeGreaterThan(big * 5);
    expect(fundYieldPerSecond(0, income)).toBe(0);
    // Never more than the jar's ceiling, however much goes in.
    const ceiling = F.yieldPerSecond * fundScale(income);
    expect(fundYieldPerSecond(1e9, income)).toBeLessThanOrEqual(ceiling);
    let run = performAction(def, coastRun(1000), depositActionId(1));
    const before = fundBalance(run);
    for (let i = 0; i < 30; i += 1) run = tick(def, run, 1);
    expect(fundBalance(run)).toBeGreaterThan(before);
    expect(run.resources.fundEarned).toBeGreaterThan(0);
  });

  it("takes a steep fee for money just put in, and a small one once it has aged", () => {
    let run = performAction(def, coastRun(1000), depositActionId(1));
    expect(fundFee(run)).toBeCloseTo(F.earlyFee);
    const early = performAction(def, run, WITHDRAW_ACTION);
    expect(early.resources.coins).toBeCloseTo(1000 * (1 - F.earlyFee));
    expect(fundBalance(early)).toBe(0);
    for (let i = 0; i < F.matureSeconds; i += 1) run = tick(def, run, 1);
    expect(fundFee(run)).toBeCloseTo(F.lateFee);
    const late = performAction(def, run, WITHDRAW_ACTION);
    expect(late.resources.coins).toBeCloseTo(fundPayout(run), 5);
    expect(late.resources.coins).toBeGreaterThan(1000);
  });

  it("makes a top-up only partly young", () => {
    let run = performAction(def, coastRun(1000), depositActionId(0.5));
    for (let i = 0; i < 100; i += 1) run = tick(def, run, 1);
    const old = fundFee(run);
    run = { ...run, resources: { ...run.resources, coins: 10 } };
    const topped = performAction(def, run, depositActionId(1));
    expect(fundFee(topped)).toBeGreaterThan(old);
    expect(fundFee(topped)).toBeLessThan(F.earlyFee);
  });

  it("is a real choice: the best amount to park is partly in, never none or all", () => {
    // The net gain of parking x for t seconds: growth minus the early fee.
    const income = 100;
    const scale = fundScale(income);
    const gain = (x: number, seconds: number): number =>
      fundYieldPerSecond(x, income) * seconds - F.earlyFee * x;
    for (const seconds of [60, 90, 120]) {
      const grid = Array.from(
        { length: 400 },
        (_, i) => (i + 1) * (scale / 20)
      );
      const best = grid.reduce((a, b) =>
        gain(b, seconds) > gain(a, seconds) ? b : a
      );
      expect(gain(best, seconds)).toBeGreaterThan(gain(1e-9, seconds));
      expect(best).toBeGreaterThan(grid[0]);
      expect(best).toBeLessThan(grid[grid.length - 1]);
      // Parking far more than that loses to parking the best amount.
      expect(gain(best * 8, seconds)).toBeLessThan(gain(best, seconds));
    }
    // And a short wait is not worth parking anything for.
    expect(gain(scale, 5)).toBeLessThan(0);
  });

  it("closes when the part of the story ends", () => {
    const run = performAction(def, coastRun(1000), depositActionId(1));
    const next = {
      ...run,
      owned: { ...run.owned, lighthouse: 7 },
    };
    const moved = tick(def, next, 1);
    expect(moved.phase).toBe(1);
    expect(fundBalance(moved)).toBe(0);
  });

  it("reads an old save with no fund as an empty jar", () => {
    const run = coastRun(500);
    const old: RunState = { ...run, resources: { ...run.resources } };
    for (const id of [
      "fund",
      "fundSince",
      "fundDeposits",
      "fundFees",
      "fundEarned",
    ])
      delete old.resources[id];
    const loaded = reconcileRun(def, old);
    expect(fundBalance(loaded)).toBe(0);
    expect(loaded.resources.coins).toBe(500);
    expect(canPerformAction(def, loaded, depositActionId(0.5))).toBe(true);
    const played = tick(def, loaded, 1);
    expect(Number.isFinite(played.resources.coins)).toBe(true);
  });

  it("pays a player who parks part of the price more than one who never does", () => {
    const finish = (fundShare: number): number =>
      simulate(def, {
        maxSeconds: 4 * 3600,
        step: 1,
        strategy: lightBots({ fundShare }).tapper,
      }).endTime;
    const never = finish(0);
    const partly = finish(0.3);
    expect(partly).toBeLessThan(never * 0.97);
  });
});
