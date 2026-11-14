import { newRun, performAction } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { sceneInfo } from "../scene";
import {
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
    expect(sceneInfo(run).tankerDeal).toBe(7);
    // a tanker that has just come in is the moment ...
    run.resources.tkLeft = T.staySeconds - 1;
    expect(sceneInfo(run).tankerNew).toBe(1);
    expect(isCoastMomentBusy(run)).toBe(true);
    // ... and a tanker at the quay for a while does not hold pop-ups back
    run.resources.tkLeft = 20;
    expect(sceneInfo(run).tankerNew).toBe(0);
    expect(isCoastMomentBusy(run)).toBe(false);
  });

  it("holds pop-ups back for the DARK! banner and the relight, not for a long dark spell", () => {
    const run = coast(4);
    run.resources.oil = 0;
    run.resources.lampDarkFor = 1;
    expect(isCoastMomentBusy(run)).toBe(true);
    run.resources.lampDarkFor = T.darkBannerSeconds + 30;
    expect(isCoastMomentBusy(run)).toBe(false);
    run.resources.oil = 100;
    run.resources.lampRelitHold = 3;
    expect(isCoastMomentBusy(run)).toBe(true);
  });

  it("holds narration a few seconds past the relight banner, and no longer", () => {
    const run = coast(4);
    run.resources.oil = 0;
    def.tick(run, 1);
    run.resources.coins = 1e9;
    run.resources.oil = 100;
    def.tick(run, 1);
    // the relight banner is up, and narration waits
    expect(sceneInfo(run).relit).toBeGreaterThan(0);
    expect(isCoastMomentBusy(run)).toBe(true);
    // the banner is gone ...
    for (let t = 0; t < T.relitSeconds; t += 1) def.tick(run, 1);
    expect(sceneInfo(run).relit).toBe(0);
    // ... narration still waits a few seconds, so the story card cannot cover it ...
    expect(T.relitHoldSeconds).toBeGreaterThan(T.relitSeconds);
    expect(T.relitHoldSeconds - T.relitSeconds).toBeLessThanOrEqual(4);
    expect(isCoastMomentBusy(run)).toBe(true);
    // ... and then lets go
    for (let t = 0; t < T.relitHoldSeconds - T.relitSeconds + 1; t += 1)
      def.tick(run, 1);
    expect(isCoastMomentBusy(run)).toBe(false);
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
