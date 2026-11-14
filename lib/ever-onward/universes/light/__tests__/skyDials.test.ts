import { cloneRun, newRun, performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def, runAtPhaseStart, withDials } from "./fixtures";
import { SEEDS, meanSpeed, playAll, skyStart } from "./skySim";
import {
  MOOD_SHIELDS,
  RECALL_SHARE,
  clicksToward,
  playsSky,
  shieldsWanted,
} from "../skyBots";
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
  heatNow,
  isSkyMomentBusy,
  lightMult,
  sunMood,
  tickSunEdge,
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
/** No flare may burn this share of the fleet or more. */
const BURN_LIMIT = 0.6;

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

  it("holds pop-ups back for a whole shout and a moment after, never longer", () => {
    let run = openSky({ skHitLeft: D.hitSeconds, skBusy: 0 });
    // A flare that has just burned holds them for the banner and a bit more.
    run = openSky({ skDist: 1, skDistNow: 1, skFlareIn: 0.5 });
    run = wait(run, 1);
    expect(run.resources.skHitLeft).toBeGreaterThan(0);
    expect(isSkyMomentBusy(run)).toBe(true);
    // Still held after the banner has gone, until the moment after is over.
    run = wait(run, D.hitSeconds);
    expect(run.resources.skHitLeft).toBe(0);
    expect(isSkyMomentBusy(run)).toBe(true);
    run = wait(run, D.momentAfter + 1);
    expect(isSkyMomentBusy(run)).toBe(false);
  });

  it("holds pop-ups for stray probes going wild and for the wild ones coming home", () => {
    let run = openSky({ skWild: 20 });
    run = performAction(def, run, RECALL_ACTION);
    run = wait(run, D.recallSeconds + 1);
    expect(run.resources.skHomeLeft).toBeGreaterThan(0);
    expect(isSkyMomentBusy(run)).toBe(true);
    run = wait(run, D.homeBannerSeconds + D.momentAfter + 1);
    expect(isSkyMomentBusy(run)).toBe(false);
  });
});

describe("what a flare reaches", () => {
  const atMood = (mood: number, step: number): RunState =>
    openSky({ skMood: mood, skDist: step, skDistNow: step });

  it("a restless sun reaches even the far edge, and a quiet sun's reach is short", () => {
    expect(heatNow(atMood(1, 0))).toBe(0);
    expect(heatNow(atMood(2, 0))).toBeGreaterThan(0);
    expect(heatNow(atMood(0, 4))).toBeLessThan(heatNow(atMood(1, 4)));
    expect(heatNow(atMood(2, 4))).toBeGreaterThan(heatNow(atMood(1, 4)));
  });

  it("never burns 60% of the fleet, however hot, big and unshielded", () => {
    const bare = atMood(2, 4);
    bare.resources.skE3 = 0;
    bare.resources.skT3 = 0;
    for (const size of [0, 1, 2])
      expect(burnShare(bare, size)).toBeLessThan(BURN_LIMIT);
  });

  it("is re-planned when the sun changes its mood (a big flare planned while restless does not land on a quiet sun)", () => {
    let run = openSky({ skMood: 2, skMoodLeft: 0.5, skFlareIn: 300 });
    run.resources.skFlareSize = 2;
    run = tick(def, run, 1);
    expect(sunMood(run)).not.toBe(2);
    const odds = D.moods[sunMood(run)].odds;
    // a size the new mood can draw
    expect(odds[run.resources.skFlareSize]).toBeGreaterThan(0);
    const mood = D.moods[sunMood(run)];
    expect(run.resources.skFlareIn).toBeLessThanOrEqual(
      Math.max(300 - 1, mood.gapMin + mood.gapSpread)
    );
  });

  it("locks the forecast of a flare when it is planned: buying charts later does not flip it", () => {
    const run = openSky({ skFlareIn: 20, skMood: 1, skMoodLeft: 1e6 });
    const shown = run.resources.skFlareFore;
    const charted = cloneRun(run);
    charted.owned["nav-1"] = 1;
    const later = tick(def, charted, 1);
    expect(later.resources.skFlareFore).toBe(shown);
  });

  it("burns the wild probes too, so they do not climb on burns alone", () => {
    let run = openSky({
      skWild: 30,
      skDist: 4,
      skDistNow: 4,
      skFlareIn: 0.5,
      skFlareSize: 2,
      skMood: 2,
      skMoodLeft: 1e6,
    });
    run = tick(def, run, 1);
    expect(run.resources.skFlares).toBe(1);
    expect(run.resources.skWild).toBeLessThan(30);
  });

  it("mends most of what it burned over a minute, so the fleet can always grow back", () => {
    let run = openSky({
      skDist: 4,
      skDistNow: 4,
      skFlareIn: 0.5,
      skFlareSize: 2,
      skMood: 2,
      skMoodLeft: 1e6,
      skFlareFore: 2,
    });
    const before = run.resources.probes;
    run = tick(def, run, 1);
    const burned = before - run.resources.probes;
    expect(burned).toBeGreaterThan(0);
    // no more flares while it mends
    run.resources.skFlareIn = 1e9;
    expect(run.resources.skRepair).toBeGreaterThan(0);
    // A little growth runs alongside; the mended ones are most of what came back.
    run = wait(run, D.repairSeconds * 3);
    expect(run.resources.skRepair).toBeLessThan(0.1 * burned);
  });

  it("does not move with run.rng, which a player's timing changes", () => {
    const a = openSky();
    const b = openSky();
    delete a.resources.skSeed;
    delete b.resources.skSeed;
    delete a.resources.nightSeed;
    delete b.resources.nightSeed;
    delete a.resources.hbSeed;
    delete b.resources.hbSeed;
    a.rng = 111;
    b.rng = 999;
    tickSunEdge(a, 1, () => undefined);
    tickSunEdge(b, 1, () => undefined);
    expect(a.resources.skSeed).toBe(b.resources.skSeed);
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

  it("gives back the know-how of an overdrive that was running in the sky", () => {
    const base = newRun(def);
    const run: RunState = {
      ...base,
      phase: 2,
      owned: { collector: 4, probe: 1 },
      resources: { ...base.resources, probes: 20, odLeft: 40, knowhow: 0 },
    };
    const after = tick(def, run, 1);
    expect(after.resources.odLeft).toBe(0);
    expect(after.resources.knowhow).toBeGreaterThanOrEqual(
      TUNING.overdrive.nightCost
    );
  });

  it("keeps the new downsides off the projects bought before the sun had any", () => {
    const base = newRun(def);
    const owned = (flags: Record<string, boolean>): RunState => ({
      ...base,
      phase: 2,
      owned: { collector: 6, probe: 1 },
      flags,
      resources: { ...base.resources, probes: 20, skDist: 3, skDistNow: 3 },
    });
    const old = tick(
      def,
      owned({
        "project-mirror-polish": true,
        "project-probe-school": true,
      }),
      1
    );
    const fresh = withDials(
      owned({
        "project-mirror-polish": true,
        "project-probe-school": true,
      })
    );
    for (const run of [old, fresh]) {
      run.resources.skDist = 3;
      run.resources.skDistNow = 3;
    }
    // The old save's flares are not made worse by polish, nor its copies wilder by school.
    expect(old.resources.skGrandPolish).toBe(1);
    expect(old.resources.skGrandSchool).toBe(1);
    expect(burnShare(old, 1)).toBeLessThan(burnShare(fresh, 1));
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

let readingRuns: ReturnType<typeof playAll> | undefined;
/** The reading player's sky on every seed, played once for the whole file. */
const readerResults = (): ReturnType<typeof playAll> =>
  (readingRuns ??= playAll({ sky: playsSky() }));

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
    reading = readerResults();
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
    for (const dist of [1, 2, 3, 4])
      expect(against(playsSky({ mood: false, dist }))).toBeGreaterThanOrEqual(
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

// --------------------------------------------- nothing near the sun soft-locks

describe("parking the fleet at any distance never soft-locks the sky", () => {
  /** Each park runs to the end, uncapped but for a very long wait. */
  const PARK_LIMIT = 8000;
  const parks = new Map<number, ReturnType<typeof playAll>>();
  const parkAt = (dist: number): ReturnType<typeof playAll> => {
    const cached = parks.get(dist);
    if (cached) return cached;
    const runs = playAll({
      maxSeconds: PARK_LIMIT,
      sky: clicksOnly([...D.startSplit], dist),
    });
    parks.set(dist, runs);
    return runs;
  };
  const mean = (list: readonly number[]): number =>
    list.reduce((sum, n) => sum + n, 0) / list.length;

  for (const dist of [0, 1, 2, 3, 4]) {
    it(`parked at step ${dist} with the starting split and never touching a dial, every seed finishes within about 1.5x of reading`, () => {
      const reading = readerResults();
      const parked = parkAt(dist);
      expect(parked.every((r) => r.isDone)).toBe(true);
      const ratios = parked.map((r, i) => r.seconds / reading[i].seconds);
      expect(mean(ratios)).toBeLessThan(1.7);
      expect(Math.max(...ratios)).toBeLessThan(2.5);
    });

    it(`parked at step ${dist}, no single flare burns 60% of the fleet`, () => {
      expect(Math.max(...parkAt(dist).map((r) => r.worstBurn))).toBeLessThan(
        BURN_LIMIT
      );
    });
  }

  it("the reading player is never burned that hard either", () => {
    expect(Math.max(...readerResults().map((r) => r.worstBurn))).toBeLessThan(
      BURN_LIMIT
    );
  });

  it("idle (touching nothing at all) finishes too", () => {
    const idle = playAll({ maxSeconds: PARK_LIMIT, sky: () => [] });
    expect(idle.every((r) => r.isDone)).toBe(true);
  });
});

// ------------------------------------------- shields' best value moves with the sun

describe("shields are worth what the sun makes them worth", () => {
  const reading = (): ReturnType<typeof playAll> => readerResults();
  const against = (sky: ReturnType<typeof playsSky>): number =>
    meanSpeed(playAll({ sky }), reading());

  it("a fixed one shield point loses to reading the sun, and so does every other fixed number", () => {
    expect(against(playsSky({ shields: false }))).toBeGreaterThanOrEqual(
      MARGIN
    );
    for (const held of [0, 1, 2, 3])
      expect(against(playsSky({ shields: held }))).toBeGreaterThanOrEqual(
        MARGIN
      );
  });

  it("what a point saves swings with mood and distance: nothing at the far edge of a usual sun, a lot at Close under a restless one", () => {
    /** The fleet a point of shield saves each minute, over the flares the mood throws. */
    const savedPerMinute = (mood: number, step: number): number => {
      const bare = openSky({ skMood: mood, skDist: step, skDistNow: step });
      const shielded = cloneRun(bare);
      bare.resources.skE3 = 0;
      bare.resources.skT3 = 0;
      shielded.resources.skE3 = 3;
      shielded.resources.skT3 = 3;
      const { odds, gapMin, gapSpread } = D.moods[mood];
      const perFlare = odds.reduce(
        (sum, chance, size) =>
          sum + chance * (burnShare(bare, size) - burnShare(shielded, size)),
        0
      );
      return (perFlare * 60) / (gapMin + gapSpread / 2);
    };
    expect(savedPerMinute(1, 0)).toBe(0);
    expect(savedPerMinute(0, 0)).toBe(0);
    for (const step of [2, 3, 4]) {
      expect(savedPerMinute(2, step)).toBeGreaterThan(savedPerMinute(1, step));
      expect(savedPerMinute(1, step)).toBeGreaterThan(savedPerMinute(0, step));
    }
    // a restless sun reaches even the far edge, where shields then matter
    expect(savedPerMinute(2, 0)).toBeGreaterThan(0.05);
    // and what a point is worth at Close under a restless sun is many times a quiet sun's
    expect(savedPerMinute(2, 3)).toBeGreaterThan(4 * savedPerMinute(0, 3));
  });

  it("a reader holds the most under a restless sun, and fewer when it is quiet or usual", () => {
    const wanted = (mood: number): number =>
      shieldsWanted(openSky({ skMood: mood, skFlareIn: 1e9 }));
    expect(wanted(0)).toBe(MOOD_SHIELDS[0]);
    expect(wanted(2)).toBe(MOOD_SHIELDS[2]);
    expect(wanted(2)).toBeGreaterThan(wanted(1));
    expect(wanted(2)).toBeGreaterThan(wanted(0));
  });

  it("the shield foundry changes the answer, not only the strength: a restless sun needs one point fewer", () => {
    const plain = openSky({ skMood: 2, skFlareIn: 1e9 });
    const forged = cloneRun(plain);
    forged.owned["nav-1"] = 1;
    forged.owned["nav-2"] = 1;
    expect(shieldsWanted(forged)).toBe(shieldsWanted(plain) - 1);
    // and that one fewer point protects as well as one more did before
    const at = (run: RunState, points: number): RunState => {
      const r = cloneRun(run);
      r.resources.skE3 = points;
      r.resources.skT3 = points;
      return r;
    };
    expect(shieldLeak(at(forged, 2))).toBeCloseTo(shieldLeak(at(plain, 3)), 5);
  });
});

// -------------------------------------------- the readers play the real best

describe("the reading player plays the best there is", () => {
  const against = (sky: ReturnType<typeof playsSky>): number =>
    meanSpeed(playAll({ sky }), readerResults());

  it("recalls at about a tenth of the fleet gone wild (the neighbours are not better)", () => {
    expect(RECALL_SHARE).toBeGreaterThanOrEqual(0.1);
    expect(RECALL_SHARE).toBeLessThanOrEqual(0.18);
    for (const recallShare of [0.08, 0.18, 0.25])
      expect(against(playsSky({ recallShare }))).toBeGreaterThan(0.99);
  });

  it("flies by the sun's mood (no other table of distances is better)", () => {
    for (const moodDist of [
      [4, 2, 0],
      [4, 3, 1],
      [3, 2, 1],
      [4, 2, 2],
      [4, 4, 1],
    ])
      expect(against(playsSky({ moodDist }))).toBeGreaterThan(0.985);
  });

  it("holds the shields that read the sun (no other table is better)", () => {
    expect(
      meanSpeed(playAll({ sky: playsSky({ shields: 2 }) }), readerResults())
    ).toBeGreaterThanOrEqual(MARGIN);
  });
});
