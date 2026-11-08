import { cloneRun, newRun, performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def, runAtPhaseStart, withDials } from "./fixtures";
import { SEEDS, meanSpeed, playAll, skyStart } from "./skySim";
import { clicksToward, playsSky } from "../skyBots";
import {
  COPYING,
  MIRRORS,
  RECALL_ACTION,
  SHIELDS,
  SPEED,
  copyMult,
  downActionId,
  mirrorMult,
  onTheirWay,
  pointsAt,
  shieldLeak,
  spareOf,
  speedMult,
  targetOf,
  upActionId,
  wildFraction,
  wildShare,
} from "../design";
import {
  burnShare,
  distanceActionId,
  distanceNow,
  forecastSize,
  isSkyMomentBusy,
  lightMult,
  sunMood,
} from "../sunEdge";
import { starsPerSecond } from "../tick";
import { TUNING } from "../tuning";

/**
 * The sky's three dials, played the way a player meets them: every seed is
 * snapshotted when the sky begins and played to its end on the real economy
 * (the real shop, real buying, real prices), once for each habit. Nothing is
 * paused and no buying is turned off. A habit's speed is its sky's length
 * against the reading player's, averaged over 12 seeds.
 */
jest.setTimeout(900_000);

const D = TUNING.dials;
const MARGIN = 1.05;

/** A sky run with the dials open and a fleet flying. */
function openSky(resources: Record<string, number> = {}): RunState {
  const start = runAtPhaseStart(2);
  const run = withDials({
    ...start,
    owned: { ...start.owned, collector: 4, probe: 1 },
    resources: { ...start.resources, probes: 40, collectors: 4 },
  });
  // Set after the dials open, which plans the first flare and picks the mood.
  Object.assign(run.resources, resources);
  return run;
}

const wait = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

describe("the probe design", () => {
  it("starts as an even split, worth 1 in every stat", () => {
    const run = openSky();
    expect(
      [SPEED, MIRRORS, COPYING, SHIELDS].map((s) => targetOf(run, s))
    ).toEqual([2, 2, 2, 2]);
    expect(speedMult(run)).toBeCloseTo(1);
    expect(mirrorMult(run)).toBeCloseTo(1);
    expect(copyMult(run)).toBeCloseTo(1);
    expect(spareOf(run)).toBe(0);
  });

  it("takes a point off at once and lands it somewhere else only after the settle", () => {
    let run = performAction(def, openSky(), downActionId(SPEED));
    // the point has left speed already, and is nowhere yet
    run = tick(def, run, 0.01);
    expect(pointsAt(run, SPEED)).toBe(1);
    expect(spareOf(run)).toBe(1);
    run = performAction(def, run, upActionId(COPYING));
    expect(targetOf(run, COPYING)).toBe(3);
    run = wait(run, Math.floor(D.settleSeconds / 2));
    expect(pointsAt(run, COPYING)).toBeLessThan(3);
    expect(onTheirWay(run)).toBeGreaterThan(0);
    run = wait(run, D.settleSeconds);
    expect(pointsAt(run, COPYING)).toBeCloseTo(3, 1);
    expect(onTheirWay(run)).toBeCloseTo(0, 1);
  });

  it("gives each stat its own effect", () => {
    const run = openSky();
    const more = (stat: number): RunState => {
      const r = cloneRun(run);
      r.resources[`skE${stat}`] = 4;
      r.resources[`skT${stat}`] = 4;
      return r;
    };
    expect(starsPerSecond(more(SPEED))).toBeGreaterThan(starsPerSecond(run));
    expect(mirrorMult(more(MIRRORS))).toBeGreaterThan(1);
    expect(copyMult(more(COPYING))).toBeGreaterThan(1);
    expect(shieldLeak(more(SHIELDS))).toBeLessThan(shieldLeak(run));
  });

  it("is not changed by anything while a point is on its way (no free respec)", () => {
    let run = performAction(def, openSky(), downActionId(MIRRORS));
    run = performAction(def, run, upActionId(MIRRORS));
    // put straight back: the point still has to walk
    run = tick(def, run, 0.01);
    expect(pointsAt(run, MIRRORS)).toBeLessThan(2);
  });
});

describe("the sun's edge", () => {
  it("glides between steps slowly, so a change lands after a while", () => {
    let run = performAction(def, openSky(), distanceActionId(3));
    run = wait(run, 10);
    expect(distanceNow(run)).toBeGreaterThan(1);
    expect(distanceNow(run)).toBeLessThan(2);
    run = wait(run, D.distanceStepSeconds * 2);
    expect(distanceNow(run)).toBe(3);
  });

  it("gathers more light the closer it flies, and a flare burns more of the fleet", () => {
    const at = (step: number): RunState =>
      withDials({
        ...openSky(),
        resources: { ...openSky().resources, skDist: step, skDistNow: step },
      });
    for (let step = 1; step <= 4; step += 1) {
      expect(lightMult(at(step))).toBeGreaterThan(lightMult(at(step - 1)));
      expect(burnShare(at(step), 2)).toBeGreaterThanOrEqual(
        burnShare(at(step - 1), 2)
      );
    }
    expect(burnShare(at(0), 2)).toBe(0);
    expect(burnShare(at(4), 2)).toBeGreaterThan(burnShare(at(2), 2));
  });

  it("shields keep a flare from burning as much", () => {
    const close = openSky({ skDist: 4, skDistNow: 4 });
    const shielded = cloneRun(close);
    shielded.resources.skE3 = 5;
    shielded.resources.skT3 = 5;
    expect(burnShare(shielded, 1)).toBeLessThan(burnShare(close, 1) * 0.6);
  });

  it("a flare burns the fleet, from its own stream, and the forecast shows it first", () => {
    let run = openSky({ skDist: 4, skDistNow: 4, skFlareIn: 20 });
    const before = run.resources.probes;
    let sawForecast = false;
    for (let t = 0; t < 40; t += 1) {
      run = tick(def, run, 1);
      if (forecastSize(run) !== null) sawForecast = true;
    }
    expect(sawForecast).toBe(true);
    expect(run.resources.skFlares).toBeGreaterThanOrEqual(1);
    expect(run.resources.probes).toBeLessThan(before);
    expect(run.resources.skHitLost).toBeGreaterThan(0);
  });

  it("draws the same flares for the same starting seed, whenever the dials open", () => {
    const early = openSky();
    const late = withDials({
      ...runAtPhaseStart(2),
      resources: {
        ...runAtPhaseStart(2).resources,
        nightSeed: early.resources.nightSeed,
        probes: 40,
      },
    });
    expect(late.resources.skSeed).toBe(early.resources.skSeed);
    expect(late.resources.skFlareSize).toBe(early.resources.skFlareSize);
    // a different starting seed is a different sky
    const other = withDials({
      ...runAtPhaseStart(2),
      resources: { ...runAtPhaseStart(2).resources, nightSeed: 12345 },
    });
    expect(other.resources.skSeed).not.toBe(early.resources.skSeed);
  });

  it("the sun has moods that move how often flares come and how they are forecast", () => {
    const quiet = openSky({ skMood: 0 });
    const restless = openSky({ skMood: 2 });
    expect(sunMood(quiet)).toBe(0);
    expect(D.moods[2].lead).toBeLessThan(D.moods[0].lead);
    expect(D.moods[2].gapMin + D.moods[2].gapSpread).toBeLessThan(
      D.moods[0].gapMin
    );
    expect(restless.resources.skMood).toBe(2);
  });

  it("holds pop-ups back only in a shout's first seconds", () => {
    let run = openSky({ skHitLeft: D.hitSeconds });
    expect(isSkyMomentBusy(run)).toBe(true);
    run = wait(run, 5);
    expect(isSkyMomentBusy(run)).toBe(false);
  });
});

describe("wild probes", () => {
  it("only come when copying is pushed past the free points", () => {
    const run = openSky();
    expect(wildFraction(run)).toBe(0);
    const hard = cloneRun(run);
    hard.resources.skE2 = 5;
    hard.resources.skT2 = 5;
    expect(wildFraction(hard)).toBeGreaterThan(0.2);
    const grown = wait(hard, 60);
    expect(grown.resources.skWild).toBeGreaterThan(0);
    expect(wildShare(grown)).toBeGreaterThan(0);
  });

  it("keep light for themselves and crowd the fleet", () => {
    const calm = openSky();
    const wild = cloneRun(calm);
    wild.resources.skWild = 40;
    expect(starsPerSecond(wild)).toBeLessThan(starsPerSecond(calm));
  });

  it("come home when called, at the cost of design points pulled off copying", () => {
    let run = openSky({ skWild: 20 });
    const before = copyMult(run);
    run = performAction(def, run, RECALL_ACTION);
    expect(copyMult(run)).toBeLessThan(before);
    run = wait(run, D.recallSeconds + 2);
    expect(run.resources.skWild).toBe(0);
    expect(run.resources.skRecalls).toBe(1);
    expect(copyMult(run)).toBeCloseTo(before, 1);
  });
});

describe("saves from before the dials", () => {
  it("pays back the racing fins and mission control once, at what they cost", () => {
    const base = newRun(def);
    const run: RunState = {
      ...base,
      phase: 2,
      owned: { collector: 4, probe: 1, "fins-1": 1, "mission-control": 1 },
      resources: { ...base.resources, probes: 20, energy: 0 },
    };
    const after = tick(def, run, 1);
    expect(after.owned["fins-1"]).toBeUndefined();
    expect(after.owned["mission-control"]).toBeUndefined();
    expect(after.resources.energy).toBeGreaterThanOrEqual((5250 + 3792) * 9.5);
  });

  it("opens the dials by itself for a fleet already flying", () => {
    const base = newRun(def);
    const run = tick(
      def,
      {
        ...base,
        phase: 2,
        owned: { collector: 4, probe: 1 },
        resources: { ...base.resources, probes: 30 },
      },
      1
    );
    expect(run.flags["sky-dials"]).toBe(true);
    expect(targetOf(run, SPEED)).toBe(2);
  });
});

// ------------------------------------------------------ the dials are a real game

describe("reading the sky beats every simple habit", () => {
  let reading: ReturnType<typeof playAll>;
  /** How much longer the sky takes with this habit than when reading (above 1: reading is faster). */
  const against = (sky: ReturnType<typeof playsSky>): number =>
    meanSpeed(playAll({ sky }), reading);
  /** The same, as the share of seeds the habit wins on. */
  const wins = (sky: ReturnType<typeof playsSky>): number => {
    const habit = playAll({ sky });
    return habit.filter((h, i) => h.seconds < reading[i].seconds * 0.98).length;
  };

  beforeAll(() => {
    reading = playAll({ sky: playsSky() });
  });

  it("is played on twelve seeds, to the end of the sky", () => {
    expect(SEEDS).toHaveLength(12);
    for (const r of reading) expect(r.seconds).toBeGreaterThan(0);
    // The sky takes a real while: it is not skipped past.
    const mean = reading.reduce((s, r) => s + r.seconds, 0) / reading.length;
    expect(mean).toBeGreaterThan(600);
    expect(mean).toBeLessThan(1800);
    expect(skyStart(1).phase).toBe(2);
  });

  it("beats every fixed split at every fixed distance (the best of 24 settings)", () => {
    const splits = [
      [2, 2, 2, 2],
      [1, 4, 1, 2],
      [1, 1, 4, 2],
      [4, 1, 1, 2],
      [2, 1, 4, 1],
      [0, 3, 4, 1],
    ];
    const gaps = splits.flatMap((split) =>
      [1, 2, 3, 4].map((dist) => against(clicksOnly(split, dist)))
    );
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(MARGIN);
  });

  it("beats 'always max' one stat, whatever the distance", () => {
    for (const split of [
      [8, 0, 0, 0],
      [0, 8, 0, 0],
      [0, 0, 8, 0],
      [0, 0, 0, 8],
    ])
      expect(against(clicksOnly(split, 2))).toBeGreaterThanOrEqual(MARGIN);
  });

  it("beats 'split evenly' and flying at one distance", () => {
    expect(against(playsSky({ stage: false }))).toBeGreaterThanOrEqual(MARGIN);
    expect(against(clicksOnly([2, 2, 2, 2], 2))).toBeGreaterThanOrEqual(MARGIN);
  });

  it("beats a player who reads everything but the stars (no change of split as the sky thins)", () => {
    expect(
      against(playsSky({ stage: false, split: [2, 1, 4, 1] }))
    ).toBeGreaterThanOrEqual(MARGIN);
  });

  it("beats a player who ignores the sun's mood, whatever distance it flies at", () => {
    expect(against(playsSky({ mood: false, dist: 2 }))).toBeGreaterThanOrEqual(
      MARGIN
    );
    expect(against(playsSky({ mood: false, dist: 3 }))).toBeGreaterThanOrEqual(
      MARGIN
    );
  });

  it("beats a player who never looks at the flare forecast", () => {
    expect(against(playsSky({ forecast: false }))).toBeGreaterThanOrEqual(
      MARGIN
    );
  });

  it("beats a player who never brings the wild ones home", () => {
    expect(against(playsSky({ recalls: false }))).toBeGreaterThanOrEqual(
      MARGIN
    );
  });

  it("is not just one lucky seed: reading wins on most seeds against 'no forecast'", () => {
    expect(wins(playsSky({ forecast: false }))).toBeLessThanOrEqual(4);
  });
});

/** A habit that moves to a split and a distance once and keeps them. */
function clicksOnly(split: readonly number[], dist: number) {
  return (run: RunState, available: readonly string[]): string[] =>
    Math.floor(run.time) % 5 === 0
      ? clicksToward(run, available, { split, dist })
      : [];
}
