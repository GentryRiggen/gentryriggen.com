import { newRun, performAction } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { sceneInfo } from "../scene";
import { goingRate, shipsPerFlash, farePaid } from "../tick";
import {
  TOLL_STEPS,
  bestTollStep,
  isTollOpen,
  rivalToll,
  setToll,
  shipShare,
  tollActionId,
  tollEarning,
  tollLockLeft,
  tollStep,
  trafficShare,
} from "../toll";
import { TUNING } from "../tuning";

const H = TUNING.coast.harbor;

/** A coast with `keeper` keepers, three lighthouses and a lamp that never runs dry. */
function harbor(seed = 1, keeper: number = H.opensAtKeepers): RunState {
  const run = newRun(def, undefined, seed);
  run.owned = { ...run.owned, keeper, lighthouse: 2 };
  run.resources.oil = 1e12;
  def.tick(run, 0.1);
  return run;
}

const SECONDS = 1500;

/** Coins earned in `SECONDS` with the toll chosen by `policy` once a second (no buying). */
function earn(policy: (run: RunState) => number | null, seed: number): number {
  let run = harbor(seed, 14);
  run.resources.coins = 0;
  for (let t = 0; t < SECONDS; t += 1) {
    const step = policy(run);
    if (step !== null && step !== tollStep(run) && tollLockLeft(run) <= 0)
      run = performAction(def, run, tollActionId(step));
    run.resources.oil = 1e12;
    def.tick(run, 1);
  }
  return run.resources.coins;
}

/** Reads the going rate off the rival's sign, and moves only for a clear gain. */
const reader = (run: RunState): number | null => {
  const rate = goingRate(run);
  const want = bestTollStep(rate);
  const gain =
    tollEarning(TOLL_STEPS[want].pay, rate) /
    tollEarning(TOLL_STEPS[tollStep(run)].pay, rate);
  return gain >= 1.1 ? want : null;
};

describe("the harbor toll", () => {
  it("opens with the keepers, and starts at Usual", () => {
    const fresh = newRun(def);
    expect(isTollOpen(fresh)).toBe(false);
    const run = harbor();
    expect(isTollOpen(run)).toBe(true);
    expect(TOLL_STEPS[tollStep(run)].label).toBe("Usual");
    expect(sceneInfo(run).tollOpen).toBe(1);
  });

  it("pays more per ship and brings fewer ships as it rises", () => {
    const rate = 1.4;
    for (let i = 1; i < TOLL_STEPS.length; i += 1) {
      expect(TOLL_STEPS[i].pay).toBeGreaterThan(TOLL_STEPS[i - 1].pay);
      expect(shipShare(TOLL_STEPS[i].pay, rate)).toBeLessThanOrEqual(
        shipShare(TOLL_STEPS[i - 1].pay, rate)
      );
    }
    const low = harbor();
    const high = harbor();
    setToll(high, 4);
    expect(farePaid(high)).toBeGreaterThan(farePaid(low));
    expect(shipShare(TOLL_STEPS[4].pay, rate)).toBeLessThan(0.3);
  });

  it("makes a change a commitment: traffic follows slowly and the sign takes time", () => {
    let run = harbor();
    expect(trafficShare(run)).toBeCloseTo(1, 1);
    run = performAction(def, run, tollActionId(4));
    expect(tollStep(run)).toBe(4);
    // a new sign puts a few ships off at once, and locks the sign
    expect(trafficShare(run)).toBeCloseTo(H.changeTraffic, 2);
    expect(tollLockLeft(run)).toBe(H.changeLockSeconds);
    const again = performAction(def, run, tollActionId(0));
    expect(tollStep(again)).toBe(4);
    // the traffic is still most of the way up ten seconds on, and down after a minute
    for (let t = 0; t < 10; t += 1) def.tick(run, 1);
    expect(trafficShare(run)).toBeGreaterThan(0.5);
    for (let t = 0; t < 120; t += 1) def.tick(run, 1);
    expect(trafficShare(run)).toBeLessThan(0.45);
    // after the lock the sign can change again
    expect(tollLockLeft(run)).toBe(0);
    expect(tollStep(performAction(def, run, tollActionId(1)))).toBe(1);
  });

  it("is moved by the world: the rival wanders on its own stream, whatever you do", () => {
    const a = harbor(7);
    const b = harbor(7);
    const seenA: number[] = [];
    const seenB: number[] = [];
    for (let t = 0; t < 900; t += 1) {
      if (t % 50 === 0 && tollLockLeft(b) <= 0) setToll(b, (t / 50) % 5);
      b.resources.coins = 0;
      def.tick(a, 1);
      def.tick(b, 1);
      if (t % 60 === 0) {
        seenA.push(rivalToll(a));
        seenB.push(rivalToll(b));
      }
    }
    expect(seenB).toEqual(seenA);
    expect(Math.max(...seenA) - Math.min(...seenA)).toBeGreaterThan(0.5);
    for (const r of seenA) {
      expect(r).toBeGreaterThanOrEqual(H.rivalMin - 1e-9);
      expect(r).toBeLessThanOrEqual(H.rivalMax + 1e-9);
    }
  });

  it("lifts the going rate as the harbor grows (so the best toll moves)", () => {
    const small = harbor(3);
    const grown = harbor(3);
    grown.owned = { ...grown.owned, lighthouse: 6, "dock-1": 1, "dock-2": 1 };
    def.tick(small, 1);
    def.tick(grown, 1);
    expect(goingRate(grown)).toBeGreaterThan(goingRate(small) * 1.1);
  });

  it("keeps ships away while the lamp is dark, and they come back after", () => {
    const run = harbor(4);
    run.resources.oil = 0;
    for (let t = 0; t < 40; t += 1) def.tick(run, 1);
    expect(trafficShare(run)).toBeLessThan(H.darkTraffic + 0.15);
    run.resources.oil = 1e12;
    for (let t = 0; t < 150; t += 1) def.tick(run, 1);
    expect(trafficShare(run)).toBeGreaterThan(0.9);
  });

  it("does not touch the tank size or the fare you can read in the shop", () => {
    const run = harbor(5, 10);
    const before = shipsPerFlash(run);
    setToll(run, 4);
    for (let t = 0; t < 100; t += 1) def.tick(run, 1);
    expect(shipsPerFlash(run)).toBeLessThan(before);
  });
});

describe("the toll is a real dial: no fixed toll is best", () => {
  const seeds = [1, 2, 3, 4, 5, 6];
  const total = (policy: (run: RunState) => number | null) =>
    seeds.reduce((sum, seed) => sum + earn(policy, seed), 0);

  it("each toll is the best one for some going rate", () => {
    const best = new Set<number>();
    for (let rate = 0.6; rate <= 3.2; rate += 0.05)
      best.add(bestTollStep(rate));
    expect([...best].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("reading the rival's sign beats every fixed toll by at least 8%", () => {
    const read = total(reader);
    for (let step = 0; step < TOLL_STEPS.length; step += 1) {
      const fixed = total(() => step);
      expect(fixed).toBeLessThan(read / 1.08);
    }
  });
});
