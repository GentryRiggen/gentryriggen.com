import {
  canPerformAction,
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { sceneInfo } from "..";
import {
  EVENING_NAMES,
  batteryCapacity,
  batteryCharge,
  bestLampForTonight,
  blackouts,
  dailyChargeRoom,
  districtsDark,
  eveningLevel,
  expectedEveningFactor,
  gridBanner,
  gridClock,
  isGridMomentBusy,
  isRushNow,
  litNights,
  rateShare,
  rushCarry,
  rushExcessAt,
  rushOutcome,
  secondsToRush,
  withoutEvenings,
} from "../grid";
import { lampActionId } from "../lamps";
import {
  lampEffect,
  lampChosen,
  lampLockLeft,
  lampStep,
  powerPerSecond,
  supplyMW,
} from "../tick";
import { TUNING } from "../tuning";
import { cloneRun } from "../../../engine/engine";

const G = TUNING.grid;

/** A night with these plants and batteries, the lights as they come. */
function night(
  owned: Record<string, number> = {},
  seed = 1,
  resources: Record<string, number> = {}
): RunState {
  const base = newRun(def, undefined, seed);
  const run = reconcileRun(def, {
    ...base,
    phase: 1,
    owned: { gen1: 5, gen2: 4, "lines-1": 1, "lines-2": 1, ...owned },
    resources: { ...base.resources, night: 99, ...resources },
  });
  return tick(def, run, 0.1);
}

const BATTERIES = { "batt-1": 1, "batt-2": 1, "batt-3": 1, "batt-4": 1 };

const play = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

/** Plays on until the clock reads `at` (the grid's day, in seconds). */
function toClock(run: RunState, at: number): RunState {
  let next = run;
  for (let t = 0; t < 400 && Math.abs(gridClock(next) - at) > 0.5; t += 1)
    next = tick(def, next, 1);
  return next;
}

describe("the grid's day", () => {
  it("opens with the plants (16 MW), and not before", () => {
    const early = tick(
      def,
      night({ gen1: 1, gen2: 0, "lines-1": 0, "lines-2": 0 }),
      1
    );
    expect(supplyMW(early)).toBeLessThan(16);
    expect(sceneInfo(early).gridOpen).toBe(0);
    const run = night();
    expect(sceneInfo(run).gridOpen).toBe(1);
    expect(gridClock(run)).toBeGreaterThanOrEqual(G.firstClock);
  });

  it("goes round once every day, dusk then the rush then a calm night", () => {
    let run = night();
    const seen: string[] = [];
    for (let t = 0; t < G.daySeconds + 5; t += 1) {
      run = tick(def, run, 1);
      const clock = gridClock(run);
      const part = isRushNow(run)
        ? "rush"
        : clock >= G.duskAt && clock < G.rushAt
          ? "dusk"
          : clock >= G.rushAt + G.rushSeconds
            ? "night"
            : "day";
      if (seen.at(-1) !== part) seen.push(part);
    }
    expect(seen).toEqual(["day", "dusk", "rush", "night", "day"]);
    expect(secondsToRush(night())).toBeGreaterThan(0);
  });

  it("starts gentle (mild, then usual), then draws each evening from its own stream", () => {
    const evenings = (seed: number, tend: boolean): number[] => {
      let run = night(BATTERIES, seed);
      const levels = [eveningLevel(run)];
      let day = run.resources.pgDays;
      for (let t = 0; t < G.daySeconds * 40; t += 1) {
        // a player busy with the streetlights does not move the weather
        if (tend && t % 37 === 0 && lampLockLeft(run) <= 0)
          run = performAction(def, run, lampActionId(t % 2 === 0 ? 0 : 3));
        run = tick(def, run, 1);
        if (run.resources.pgDays !== day) {
          day = run.resources.pgDays;
          levels.push(eveningLevel(run));
        }
      }
      return levels;
    };
    const calm = evenings(7, false);
    const busy = evenings(7, true);
    expect(calm.slice(0, 2)).toEqual([0, 1]);
    expect(busy).toEqual(calm);
    expect(evenings(8, false)).not.toEqual(calm);
    // every kind of evening turns up, and each has a plain name
    expect(new Set(calm).size).toBe(EVENING_NAMES.length);
  });

  it("does not use the run's own random numbers", () => {
    const run = night();
    expect(play(run, G.daySeconds * 3).rng).toBe(run.rng);
  });
});

describe("batteries and the rush", () => {
  it("charge by day, and the charging costs a share of the pay", () => {
    const withBank = night(BATTERIES, 3, { pgCharge: 0 });
    const without = night({}, 3);
    expect(batteryCapacity(withBank)).toBe(G.batteryHolds[3]);
    const gained = (run: RunState): number => {
      const later = play(run, 20);
      return later.resources.power - run.resources.power;
    };
    expect(batteryCharge(play(withBank, 20))).toBeGreaterThan(0);
    expect(gained(withBank)).toBeLessThan(gained(without));
    // never past full
    expect(batteryCharge(play(withBank, 200))).toBeLessThanOrEqual(
      batteryCapacity(withBank)
    );
  });

  it("cannot be filled faster than the plants allow: a bigger bank than the plants can charge stays part full", () => {
    const huge = night({
      gen1: 2,
      gen2: 0,
      "lines-1": 0,
      "lines-2": 0,
      ...Object.fromEntries(
        [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`batt-${n}`, 1])
      ),
    });
    expect(dailyChargeRoom(huge)).toBeLessThan(batteryCapacity(huge) / 10);
    const after = play(huge, G.daySeconds);
    expect(chargeShare(after)).toBeLessThan(0.05);
  });

  it("carries a rush it can: every light stays on, the night pays a bonus and the cities sparkle", () => {
    // the first evening is mild, and the bank is full
    const full = night({ ...BATTERIES }, 5, { pgCharge: 1970 });
    const before = toClock(full, G.rushAt - 1);
    const power = before.resources.power;
    const knowhow = before.resources.knowhow;
    let run = before;
    let sawBanner = 0;
    for (let t = 0; t < G.rushSeconds + 4; t += 1) {
      run = tick(def, run, 1);
      expect(districtsDark(run)).toBe(0);
      sawBanner = Math.max(sawBanner, gridBanner(run));
    }
    expect(sawBanner).toBe(1);
    expect(litNights(run)).toBe(1);
    expect(blackouts(run)).toBe(0);
    expect(run.resources.knowhow).toBeGreaterThan(
      knowhow + G.litKnowhow - 0.01
    );
    expect(run.resources.pgLitPay).toBeGreaterThan(
      powerPerSecond(before) * G.litSeconds * 0.5
    );
    expect(run.resources.power).toBeGreaterThan(
      power + run.resources.pgLitPay * 0.99
    );
    expect(sceneInfo(run).glow).toBe(1);
    // the batteries gave their power at the rush
    expect(batteryCharge(run)).toBeLessThan(batteryCapacity(run));
  });

  it("goes dark when the rush is more than the grid can carry, a district at a time, and comes back on", () => {
    // a hot evening with no batteries at all
    const hot = night({}, 5, { pgLevel: 2, pgDays: 5 });
    let run = toClock(hot, G.rushAt - 1);
    const seen: number[] = [];
    const power = run.resources.power;
    for (let t = 0; t < G.rushSeconds + 2; t += 1) {
      run = tick(def, run, 1);
      seen.push(districtsDark(run));
    }
    expect(Math.max(...seen)).toBeGreaterThan(0);
    expect(blackouts(run)).toBe(1);
    expect(litNights(run)).toBe(0);
    expect(gridBanner(run)).toBe(2);
    expect(sceneInfo(run).dark).toBeGreaterThan(0);
    expect(sceneInfo(run).glow).toBe(0);
    expect(isGridMomentBusy(run)).toBe(true);
    // never takes anything: the night's pay only went up
    expect(run.resources.power).toBeGreaterThan(power);
    // and the districts come back on, one by one
    const later = play(run, G.recoverySeconds + 2);
    expect(districtsDark(later)).toBe(0);
    expect(isGridMomentBusy(play(later, G.bannerSeconds + 1))).toBe(false);
  });

  it("loses pay in a blackout: the dark districts pay nothing while they are out", () => {
    const hot = (level: number, owned: Record<string, number>): RunState =>
      toClock(
        night(owned, 5, {
          pgLevel: level,
          pgDays: 5,
          pgCharge: batteryCapacity(night(owned, 5)),
        }),
        G.rushAt - 1
      );
    const earned = (run: RunState): number =>
      play(run, G.rushSeconds + G.recoverySeconds).resources.power -
      run.resources.power;
    const covered = earned(hot(0, BATTERIES));
    const short = earned(hot(3, {}));
    expect(short).toBeLessThan(covered);
  });

  it("needs lines to carry it: plenty stored, thin lines, and the lights still go out", () => {
    const thin = night({ "lines-1": 0, "lines-2": 0, ...BATTERIES }, 5, {
      pgLevel: 3,
      pgDays: 5,
      pgCharge: 1970,
    });
    const thick = night(
      { "lines-1": 1, "lines-2": 1, "lines-3": 1, "lines-4": 1, ...BATTERIES },
      5,
      { pgLevel: 3, pgDays: 5, pgCharge: 1970 }
    );
    expect(rateShare(thick)).toBeGreaterThan(rateShare(thin));
    expect(rushCarry(thin)).toBeLessThan(
      supplyMW(thin) * rushExcessAt(thin, 3, 1)
    );
    const thinOutcome = rushOutcome(thin, rushExcessAt(thin, 3, 1), 1970);
    expect(thinOutcome.isLit).toBe(false);
    expect(rushCarry(thick) / supplyMW(thick)).toBeGreaterThan(
      rushCarry(thin) / supplyMW(thin)
    );
  });

  it("is the streetlights that change how hard the rush hits", () => {
    const run = night(BATTERIES);
    const steps = TUNING.lamps.steps;
    for (let i = 1; i < steps.length; i += 1)
      expect(rushExcessAt(run, 2, steps[i].peak)).toBeGreaterThan(
        rushExcessAt(run, 2, steps[i - 1].peak)
      );
    // a change takes a few seconds to settle: the cities follow it only then,
    // and it cannot be undone sooner
    const dim = performAction(def, run, lampActionId(0));
    expect(lampChosen(dim)).toBe(0);
    expect(lampStep(dim)).toBe(2);
    expect(lampEffect(dim).peak).toBe(steps[2].peak);
    expect(lampLockLeft(dim)).toBe(G.lampLockSeconds);
    expect(canPerformAction(def, dim, lampActionId(3))).toBe(false);
    const settled = play(dim, G.lampLockSeconds + 1);
    expect(lampStep(settled)).toBe(0);
    expect(lampEffect(settled).peak).toBe(steps[0].peak);
    expect(canPerformAction(def, settled, lampActionId(3))).toBe(true);
  });

  it("is never read as income by the probes, and shows a battery's worth", () => {
    const base = night({});
    const banked = night(BATTERIES, 1, { pgCharge: 1970 });
    expect(expectedEveningFactor(banked)).toBeGreaterThan(
      expectedEveningFactor(base)
    );
    const frozen = withoutEvenings(cloneRun(banked));
    const clock = gridClock(frozen);
    const gained =
      tick(def, frozen, 1).resources.power - frozen.resources.power;
    expect(gridClock(tick(def, frozen, 1))).toBe(clock);
    expect(gained).toBeCloseTo(
      powerPerSecond(frozen) * expectedEveningFactor(frozen),
      6
    );
  });

  it("knows a bank that can't hold up: a fixed best step for tonight, soft when none can", () => {
    const run = night(BATTERIES, 1, { pgCharge: 1970, pgLevel: 1 });
    const step = bestLampForTonight(run);
    expect(step).toBeGreaterThanOrEqual(0);
    expect(step).toBeLessThanOrEqual(3);
  });
});

const chargeShare = (run: RunState): number =>
  batteryCapacity(run) > 0 ? batteryCharge(run) / batteryCapacity(run) : 0;

describe("a save from before the grid", () => {
  it("plays on, with the grid starting fresh", () => {
    const run = night();
    const old: RunState = {
      ...run,
      resources: Object.fromEntries(
        Object.entries(run.resources).filter(([id]) => !id.startsWith("pg"))
      ),
    };
    const loaded = reconcileRun(def, old);
    expect(() => play(loaded, 200)).not.toThrow();
    expect(gridClock(play(loaded, 5))).toBeGreaterThan(0);
  });
});

describe("holding pop-ups back for the picture", () => {
  it("holds them for the banner and the first seconds of the dark, not the whole time districts are out", () => {
    const hot = night({}, 5, { pgLevel: 3, pgDays: 5 });
    let run = toClock(hot, G.rushAt - 1);
    let busyAtSnap = false;
    let lastBusy = -1;
    let darkSeconds = 0;
    let busySeconds = 0;
    for (let t = 0; t < G.rushSeconds + G.recoverySeconds + 10; t += 1) {
      run = tick(def, run, 1);
      if (districtsDark(run) > 0) darkSeconds += 1;
      if (isGridMomentBusy(run)) {
        busySeconds += 1;
        lastBusy = t;
      }
      if (isRushNow(run) && districtsDark(run) > 0 && t < G.snapSeconds)
        busyAtSnap = true;
    }
    expect(busyAtSnap).toBe(true);
    expect(darkSeconds).toBeGreaterThan(G.rushSeconds);
    // busy for the snap and the banner only: well under the time it stays dark
    expect(busySeconds).toBeLessThan(darkSeconds * 0.6);
    expect(busySeconds).toBeLessThanOrEqual(
      G.snapSeconds + G.bannerSeconds + 2
    );
    expect(lastBusy).toBeLessThan(G.rushSeconds + G.bannerSeconds + 2);
    // and it is not busy at all once the banner has gone, dark or not
    expect(isGridMomentBusy(run)).toBe(false);
  });

  it("is quiet through a dark evening's long recovery", () => {
    const hot = night({}, 5, { pgLevel: 3, pgDays: 5 });
    let run = toClock(hot, G.rushAt - 1);
    run = play(run, G.rushSeconds + G.bannerSeconds + 3);
    expect(districtsDark(run)).toBeGreaterThan(0);
    expect(isGridMomentBusy(run)).toBe(false);
  });
});

describe("the streetlights are a commitment", () => {
  it("follow a change only once it has settled: dimming at the last minute does not protect the start of the rush", () => {
    const run = toClock(
      night(BATTERIES, 5, { pgLevel: 2, pgDays: 5 }),
      G.rushAt - 1
    );
    // asked for just before the rush, it has not settled when the rush begins
    const dim = performAction(def, run, lampActionId(0));
    const into = play(dim, 3);
    expect(isRushNow(into)).toBe(true);
    expect(lampStep(into)).toBe(2);
    expect(lampChosen(into)).toBe(0);
    // it takes effect once it has settled
    expect(lampStep(play(dim, G.lampLockSeconds + 1))).toBe(0);
  });

  it("cannot be switched down and back for free around the rush: the dim lasts until the way back has settled", () => {
    // dimmed as the bots do (settled well before the rush) ...
    let run = toClock(
      night(BATTERIES, 5, { pgLevel: 1, pgDays: 5 }),
      G.rushAt - (G.lampLockSeconds + 3)
    );
    run = performAction(def, run, lampActionId(0));
    run = toClock(run, G.rushAt + G.rushSeconds + 1);
    expect(lampStep(run)).toBe(0);
    // ... the way back (here the lights going back by themselves) is just
    // as slow: the cities stay dim until it has settled
    expect(lampLockLeft(run)).toBeGreaterThan(G.lampLockSeconds - 3);
    expect(canPerformAction(def, run, lampActionId(3))).toBe(false);
    expect(lampStep(play(run, G.lampLockSeconds - 3))).toBe(0);
    expect(lampStep(play(run, G.lampLockSeconds + 1))).toBe(2);
  });

  it("goes back to what it was after the rush when it was dimmed for tonight", () => {
    let run = toClock(
      night(BATTERIES, 5, { pgLevel: 2, pgDays: 5 }),
      G.rushAt - (G.lampLockSeconds + 3)
    );
    expect(lampStep(run)).toBe(2);
    run = performAction(def, run, lampActionId(0));
    run = toClock(run, G.rushAt + G.rushSeconds + 1);
    expect(lampStep(run)).toBe(0);
    // the rush is over: it settles back to Bright with no click
    expect(lampChosen(run)).toBe(2);
    run = play(run, G.lampLockSeconds + 2);
    expect(lampStep(run)).toBe(2);
  });

  it("keeps a change made by day: only dusk's changes are for tonight", () => {
    let run = toClock(night(BATTERIES, 5), 10);
    run = performAction(def, run, lampActionId(0));
    run = play(run, G.lampLockSeconds + 1);
    run = toClock(run, G.rushAt + G.rushSeconds + G.lampLockSeconds + 5);
    expect(lampStep(run)).toBe(0);
  });
});

describe("the night's seed", () => {
  it("does not depend on when the grid opens: a run's evenings are fixed when it begins", () => {
    const evenings = (taps: number): number[] => {
      const base = newRun(def, undefined, 11);
      const run = reconcileRun(def, {
        ...base,
        // the player's taps move run.rng, whenever they happen
        rng: base.rng + taps * 7919,
        phase: 1,
        owned: { gen1: 5, gen2: 4, "lines-1": 1, "lines-2": 1, ...BATTERIES },
        resources: { ...base.resources, night: 99 },
      });
      let next = tick(def, run, 0.1);
      const levels = [eveningLevel(next)];
      let day = next.resources.pgDays;
      for (let t = 0; t < G.daySeconds * 30; t += 1) {
        next = tick(def, next, 1);
        if (next.resources.pgDays !== day) {
          day = next.resources.pgDays;
          levels.push(eveningLevel(next));
        }
      }
      return levels;
    };
    expect(evenings(0)).toEqual(evenings(500));
    expect(newRun(def, undefined, 11).resources.nightSeed).not.toBe(0);
    expect(newRun(def, undefined, 12).resources.nightSeed).not.toBe(
      newRun(def, undefined, 11).resources.nightSeed
    );
  });
});

describe("saves from before the batteries", () => {
  it("pay back what the cut load balancer and smart grid cost, once, in the night", () => {
    const base = newRun(def, undefined, 3);
    const old = reconcileRun(def, {
      ...base,
      phase: 1,
      owned: { gen1: 5, gen2: 3, "grid-1": 1, "grid-2": 1 },
      resources: { ...base.resources, night: 80, power: 1000 },
    });
    expect(old.owned["grid-1"]).toBe(1);
    const after = tick(def, old, 1);
    const paid = (9600 + 9000) * 28;
    expect(paid).toBeGreaterThan(500_000);
    // everything they paid comes back (and a second of the night's pay)
    expect(after.resources.power - old.resources.power).toBeGreaterThanOrEqual(
      paid
    );
    expect(after.resources.power - old.resources.power).toBeLessThan(
      paid * 1.01
    );
    expect(after.owned["grid-1"]).toBeUndefined();
    expect(after.owned["grid-2"]).toBeUndefined();
    // and only once
    const later = play(after, 5);
    expect(later.resources.power - after.resources.power).toBeLessThan(
      paid * 0.01
    );
  });

  it("keeps the refund at what was paid, whatever the night costs now", () => {
    const base = newRun(def, undefined, 3);
    const old = reconcileRun(def, {
      ...base,
      phase: 1,
      owned: { gen1: 5, gen2: 3, "grid-1": 1 },
      resources: { ...base.resources, night: 80, power: 0 },
    });
    const after = tick(def, old, 1);
    expect(after.resources.power).toBeGreaterThan(9600 * 28);
    expect(after.resources.power).toBeLessThan(9600 * 28 * 1.05);
  });
});
