import { newRun, performAction } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { sceneInfo } from "../scene";
import { beamActionId, bestBeamStep } from "../beam";
import {
  beamStep,
  barrelOil,
  marketOilPrice,
  shipsPerFlash,
  tankCapacity,
} from "../tick";
import { isCoastMomentBusy, isTankerIn, tankerVisits } from "../tanker";
import { trafficShare } from "../toll";
import { TUNING } from "../tuning";

const T = TUNING.coast.tanker;

function coast(
  seed: number,
  owned: Record<string, number> = { keeper: 14, lighthouse: 2, lens: 2 }
): RunState {
  const run = newRun(def, undefined, seed);
  run.owned = { ...run.owned, ...owned };
  def.tick(run, 0.1);
  return run;
}

const level = (run: RunState) => run.resources.oil / tankCapacity(run);

describe("oil tankers", () => {
  it("tie up now and then, and sail on after a while", () => {
    const run = coast(1);
    run.resources.oil = tankCapacity(run);
    let firstAt = -1;
    let stay = 0;
    let longest = 0;
    for (let t = 0; t < 1800; t += 1) {
      run.resources.oil = tankCapacity(run);
      def.tick(run, 1);
      if (isTankerIn(run)) {
        if (firstAt < 0) firstAt = t;
        stay += 1;
        longest = Math.max(longest, stay);
      } else stay = 0;
    }
    expect(firstAt).toBeGreaterThan(T.firstSeconds - 2);
    expect(firstAt).toBeLessThan(T.firstSeconds + 5);
    expect(longest).toBeLessThanOrEqual(T.staySeconds + 1);
    expect(longest).toBeGreaterThan(T.staySeconds - 2);
    expect(tankerVisits(run)).toBeGreaterThanOrEqual(6);
  });

  it("sell below the market while in, and the price goes back after", () => {
    const run = coast(2);
    for (let t = 0; t < 600; t += 1) {
      run.resources.oil = tankCapacity(run);
      def.tick(run, 1);
      const market = marketOilPrice(run);
      if (isTankerIn(run)) {
        expect(run.resources.oilPrice).toBeLessThanOrEqual(
          market * T.dealMax + 1e-9
        );
        expect(run.resources.oilPrice).toBeGreaterThanOrEqual(
          market * T.dealMin - 1e-9
        );
      } else expect(run.resources.oilPrice).toBeCloseTo(market, 6);
    }
  });

  it("come on a schedule nothing the player does can move", () => {
    const a = coast(9);
    const b = coast(9);
    const visitsA: number[] = [];
    const visitsB: number[] = [];
    for (let t = 0; t < 1200; t += 1) {
      a.resources.oil = tankCapacity(a);
      b.resources.oil = tankCapacity(b);
      b.resources.coins = 1e9;
      let next = b;
      if (t % 37 === 0 && barrelOil(b) > 1)
        next = performAction(def, b, "buy-oil");
      Object.assign(b, next);
      def.tick(a, 1);
      def.tick(b, 1);
      if (t % 100 === 0) {
        visitsA.push(tankerVisits(a));
        visitsB.push(tankerVisits(b));
      }
    }
    expect(visitsB).toEqual(visitsA);
  });

  it("make a big moment in the picture, and hold pop-ups back", () => {
    const run = coast(3);
    expect(isCoastMomentBusy(run)).toBe(false);
    run.resources.tkLeft = 20;
    run.resources.tkDeal = 0.3;
    expect(sceneInfo(run).tanker).toBe(1);
    expect(sceneInfo(run).tankerDeal).toBe(2);
    expect(isCoastMomentBusy(run)).toBe(true);
  });
});

describe("the dark", () => {
  it("falls when the lamp runs dry: the picture says so, ships keep away, and the beam bursts when it is lit again", () => {
    let run = coast(5);
    run.resources.coins = 1e12;
    run.resources.oil = 0;
    def.tick(run, 1);
    expect(sceneInfo(run).lampDry).toBe(1);
    expect(sceneInfo(run).darkBanner).toBe(1);
    expect(isCoastMomentBusy(run)).toBe(true);
    const calm = shipsPerFlash(coast(5));
    for (let t = 0; t < 30; t += 1) def.tick(run, 1);
    expect(shipsPerFlash(run)).toBeLessThan(calm * 0.7);
    // the banner goes after a few seconds, the dark stays
    expect(sceneInfo(run).darkBanner).toBe(0);
    expect(sceneInfo(run).lampDry).toBe(1);
    run = performAction(def, run, "buy-oil");
    expect(sceneInfo(run).lampDry).toBe(0);
    expect(sceneInfo(run).relit).toBe(1);
    expect(sceneInfo(run).barrels).toBe(1);
    for (let t = 0; t < T.relitSeconds + 1; t += 1) def.tick(run, 1);
    expect(sceneInfo(run).relit).toBe(0);
    expect(trafficShare(run)).toBeLessThan(1);
  });

  it("is a real loss, and a recoverable one", () => {
    const run = coast(6);
    run.resources.oil = 0;
    for (let t = 0; t < 60; t += 1) def.tick(run, 1);
    expect(trafficShare(run)).toBeLessThan(0.8);
    run.resources.oil = tankCapacity(run);
    for (let t = 0; t < 200; t += 1) {
      run.resources.oil = tankCapacity(run);
      def.tick(run, 1);
    }
    expect(trafficShare(run)).toBeGreaterThan(0.95);
  });
});

describe("the oil market is a real dial: no fixed way of buying is best", () => {
  const SECONDS = 1500;
  const seeds = [1, 2, 3, 4, 5, 6];

  /** Net coins after `SECONDS`, buying oil by `policy` and reading the lamp by the market price. */
  function net(
    policy: (run: RunState) => boolean,
    seed: number,
    tankTier: number
  ): number {
    let run = coast(seed, {
      keeper: 14,
      lighthouse: 2,
      lens: 2,
      ...(tankTier > 0 ? { "tank-1": 1 } : {}),
    });
    run.resources.oil = tankCapacity(run);
    run.resources.coins = 0;
    for (let t = 0; t < SECONDS; t += 1) {
      if (t % 30 === 0) {
        const want = bestBeamStep(run);
        if (want !== beamStep(run))
          run = performAction(def, run, beamActionId(want));
      }
      if (policy(run) && barrelOil(run) > 0.1 * tankCapacity(run))
        run = performAction(def, run, "buy-oil");
      def.tick(run, 1);
    }
    return run.resources.coins;
  }

  /** Buys when oil is cheap (a tanker's deal, or a dip), and never lets the lamp go dark. */
  const reader = (run: RunState): boolean =>
    (run.resources.oilPrice < 1.1 && level(run) < 0.8) ||
    (level(run) < 0.05 && run.resources.oilPrice < 3.5);

  const fixed: Record<string, (run: RunState) => boolean> = {
    "tops up whenever the tank is low": (run) => level(run) < 0.25,
    "only from a tanker": (run) => isTankerIn(run) && level(run) < 0.8,
    "fills up whenever it can": (run) => level(run) < 0.9,
  };

  it.each([0, 1])(
    "reading the price beats each fixed habit by at least 8% (tank tier %i)",
    (tier) => {
      const total = (policy: (run: RunState) => boolean) =>
        seeds.reduce((sum, seed) => sum + net(policy, seed, tier), 0);
      const read = total(reader);
      for (const policy of Object.values(fixed))
        expect(total(policy)).toBeLessThan(read / 1.08);
    }
  );
});

describe("the lamp's brightness stays a real dial beside the market", () => {
  const SECONDS = 1500;
  const seeds = [1, 2, 3, 4, 5, 6];

  /** Net coins buying by the price, with the lamp held at `fixed` or read by the market price. */
  function net(fixed: number | null, seed: number): number {
    let run = coast(seed);
    run.resources.oil = tankCapacity(run);
    run.resources.coins = 0;
    for (let t = 0; t < SECONDS; t += 1) {
      const want = fixed ?? bestBeamStep(run);
      if (t % 30 === 0 && want !== beamStep(run))
        run = performAction(def, run, beamActionId(want));
      const full = level(run);
      const isCheap = run.resources.oilPrice < 1.1 && full < 0.8;
      const isDry = full < 0.05 && run.resources.oilPrice < 3.5;
      if ((isCheap || isDry) && barrelOil(run) > 0.1 * tankCapacity(run))
        run = performAction(def, run, "buy-oil");
      def.tick(run, 1);
    }
    return run.resources.coins;
  }

  it("reading the market price beats every fixed brightness by at least 8%", () => {
    const total = (fixed: number | null) =>
      seeds.reduce((sum, seed) => sum + net(fixed, seed), 0);
    const read = total(null);
    for (const step of [0, 1, 2, 3])
      expect(total(step)).toBeLessThan(read / 1.08);
  });
});
