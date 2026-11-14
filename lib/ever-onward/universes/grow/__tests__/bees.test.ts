import { newRun } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import {
  BEDS,
  addBee,
  bedEffect,
  beeCount,
  beeResultLine,
  beesHome,
  beesOn,
  bloomOf,
  honeyOf,
  honeyPrice,
  isLeaving,
  isPlanted,
  needsBees,
  openBees,
  plantBed,
  pollenRipenMult,
  rareCount,
  secondsToWilt,
  sellHoney,
  takeBee,
  tickBees,
  winterNeeds,
} from "../bees";
import { TUNING } from "../tuning";
import { def } from "./fixtures";

const P = TUNING.pollen;
const SEASON = TUNING.seasons.seconds;

/** A yard with `hives` hives and pollination open, at `time` (spring at 0). */
function yard(hives = 2, time = 1): RunState {
  const run = newRun(def);
  run.owned["bee-hive"] = hives;
  run.time = time;
  openBees(run);
  return run;
}

const run10 = (run: RunState, seconds: number, income = 100) => {
  for (let t = 0; t < seconds; t += 0.5) {
    run.time += 0.5;
    tickBees(run, 0.5, () => income);
  }
};

describe("pollination", () => {
  it("gives three bees a hive, all at home until sent out", () => {
    const run = yard(2);
    expect(beeCount(run)).toBe(6);
    expect(beesHome(run)).toBe(6);
  });

  it("needs a bed planted before bees can go to it", () => {
    const run = yard();
    addBee(run, 0);
    expect(beesOn(run, 0)).toBe(0);
    plantBed(run, 0);
    addBee(run, 0);
    expect(beesOn(run, 0)).toBe(1);
    expect(beesHome(run)).toBe(5);
    takeBee(run, 0);
    expect(beesOn(run, 0)).toBe(0);
  });

  it("makes honey from clover, and a hard-worked bed wilts and must be replanted", () => {
    const run = yard(3);
    plantBed(run, 0);
    for (let i = 0; i < 9; i += 1) addBee(run, 0);
    expect(secondsToWilt(run, 0)).not.toBeNull();
    run10(run, 60);
    expect(honeyOf(run)).toBeGreaterThan(0);
    expect(isPlanted(run, 0)).toBe(false);
    expect(beesOn(run, 0)).toBe(0);
    expect(beeResultLine(run)).toMatch(/Clover wilted/);
  });

  it("lets a lightly worked bed hold up", () => {
    const run = yard();
    plantBed(run, 0);
    addBee(run, 0);
    run10(run, 80);
    expect(isPlanted(run, 0)).toBe(true);
    expect(bloomOf(run, 0)).toBeGreaterThan(0.5);
  });

  it("makes the garden ripen faster with sunflower bees", () => {
    const run = yard();
    expect(pollenRipenMult(run)).toBe(1);
    plantBed(run, 1);
    addBee(run, 1);
    addBee(run, 1);
    expect(pollenRipenMult(run)).toBeGreaterThan(1);
    expect(bedEffect(run, 1)).toMatch(/ripens/);
  });

  it("calms the bees with lavender, so other beds tire more slowly", () => {
    const busy = yard(3);
    plantBed(busy, 0);
    for (let i = 0; i < 4; i += 1) addBee(busy, 0);
    const before = secondsToWilt(busy, 0)!;
    plantBed(busy, 2);
    for (let i = 0; i < 3; i += 1) addBee(busy, 2);
    expect(secondsToWilt(busy, 0)!).toBeGreaterThan(before);
  });

  it("pays honey best in winter, and the hive eats it in winter", () => {
    const run = yard(2);
    run.resources.honey = 100;
    const spring = honeyPrice(run, 100);
    run.time = SEASON * 3 + 1;
    expect(honeyPrice(run, 100)).toBeGreaterThan(spring);
    run10(run, 10);
    expect(honeyOf(run)).toBeLessThan(100);
    sellHoney(run, 1, 100);
    expect(honeyOf(run)).toBe(0);
  });

  it("loses bees in a hungry winter and gets them back in spring", () => {
    const run = yard(2, SEASON * 3 + 1);
    expect(winterNeeds(run)).toBeGreaterThan(0);
    run10(run, 30);
    expect(isLeaving(run) || beeCount(run) < 6).toBe(true);
    expect(beeCount(run)).toBeLessThan(6);
    run.time = SEASON * 4 + 1;
    run10(run, P.returnSeconds * 8);
    expect(beeCount(run)).toBe(6);
  });

  it("crosses two healthy, worked neighbours into a rare flower", () => {
    const run = yard(3);
    plantBed(run, 0);
    plantBed(run, 1);
    addBee(run, 0);
    addBee(run, 1);
    run.resources.pbBloom0 = 1;
    run.resources.pbBloom1 = 1;
    for (let t = 0; t < 3000 && rareCount(run) === 0; t += 1) {
      run.time = 1 + (t % 200);
      run.resources.pbBloom0 = 1;
      run.resources.pbBloom1 = 1;
      tickBees(run, 1, () => 100);
    }
    expect(rareCount(run)).toBe(1);
    expect(beeResultLine(run)).toMatch(/rare flower/);
  });

  it("asks for attention when bees sit idle next to a planted bed", () => {
    const run = yard();
    expect(needsBees(run)).toBe(false);
    plantBed(run, 0);
    expect(needsBees(run)).toBe(true);
  });

  it("has four beds, each saying what it gives", () => {
    expect(BEDS.map((b) => b.kind)).toEqual([
      "clover",
      "sunflower",
      "lavender",
      "apple",
    ]);
    for (const bed of BEDS) expect(bed.gives.length).toBeGreaterThan(5);
  });
});
