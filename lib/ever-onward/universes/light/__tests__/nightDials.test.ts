import {
  canPerformAction,
  cloneRun,
  isMaxed,
  newRun,
  performAction,
  reconcileRun,
  visibleUpgrades,
} from "../../../engine/engine";
import type { RunState, UpgradeDef } from "../../../engine/types";
import { def } from "./fixtures";
import {
  SEEDS,
  cheapestFirst,
  meanSpeed,
  nightStart,
  playAll,
  type NightResult,
} from "./nightSim";
import { simulate } from "../../../engine/sim";
import {
  buysBatteries,
  nightPlayer,
  setsLamps,
  tendsCrews,
  type OilChoice,
} from "../bots";
import {
  batteryCapacity,
  bestLampForTonight,
  dailyChargeRoom,
  eveningLevel,
  gridClock,
  isRushNow,
  rateShare,
  rushExcessAt,
  rushOutcome,
} from "../grid";
import { lampActionId } from "../lamps";
import { demandAtStep, isLampsOpen, lampChosen, supplyMW } from "../tick";
import { TUNING } from "../tuning";
import {
  POST_BUILD,
  POST_WATCH,
  crewCount,
  crewPostActionId,
  forecastStep,
  isWeatherOpen,
  likeliestTown,
  postOf,
  weatherStage,
} from "../weather";

/**
 * The night's three dials, tested the way a player meets them: every seed is
 * snapshotted when the night begins and played to its end on the real
 * economy (the real shop, real buying, real prices), once for each habit.
 * Nothing is paused and no buying is turned off. Each habit's speed is its
 * night's length against the reading player's, averaged over 12 seeds.
 */
jest.setTimeout(900_000);

const G = TUNING.grid;
const STEPS = TUNING.lamps.steps;
const MARGIN = 1.05;

// ---------------------------------------------------------------- helpers

const nothing: OilChoice = () => [];

/** The step every player takes when the last towns can be lit: soft enough for the plants. */
const finishing = (run: RunState): number | undefined =>
  [3, 2, 1, 0].find((step) => supplyMW(run) >= demandAtStep(run, step));

/** Wraps "the step wanted now" with the finishing move every player makes. */
const lampRule =
  (want: (run: RunState) => number | null): OilChoice =>
  (run, available) => {
    if (!isLampsOpen(run)) return [];
    const done = finishing(run);
    const wanted = done ?? want(run);
    if (wanted === null || wanted === lampChosen(run)) return [];
    const id = lampActionId(wanted);
    return available.includes(id) ? [id] : [];
  };

/** The seconds before the rush a player looks at the evening. */
const LOOK = G.rushAt - (G.lampLockSeconds + 3);
const isDusk = (run: RunState): boolean =>
  gridClock(run) >= LOOK && gridClock(run) < G.rushAt;

/** The brightest step at all times. */
const BRIGHT = 3;

/** Rules a player could follow from what the panel shows: tonight's name, nothing more. */
const fixed = (step: number): OilChoice => lampRule(() => step);
const dimsEveryDusk = (step: number): OilChoice =>
  lampRule((run) => (isRushNow(run) ? null : isDusk(run) ? step : BRIGHT));
const dimsHotEvenings = (step: number): OilChoice =>
  lampRule((run) =>
    isRushNow(run)
      ? null
      : isDusk(run) && eveningLevel(run) >= 2
        ? step
        : BRIGHT
  );
const byEveningName = (table: readonly number[]): OilChoice =>
  lampRule((run) =>
    isRushNow(run) ? null : isDusk(run) ? table[eveningLevel(run)] : BRIGHT
  );

/**
 * The sums the old panel put side by side (what the rush asks, in seconds
 * of the grid, against what the batteries hold, and the lines' share). The
 * panel no longer shows them; this is what a player who worked them out
 * would do at dusk, kept here only to see how far reading beats it.
 */
const doesTheSums = lampRule((run) => {
  if (isRushNow(run)) return null;
  if (!isDusk(run)) return BRIGHT;
  const share =
    batteryCapacity(run) > 0
      ? (run.resources.pgCharge ?? 0) / batteryCapacity(run)
      : 0;
  const holds = (batteryCapacity(run) / Math.max(1, supplyMW(run))) * share;
  for (let step = BRIGHT; step >= 0; step -= 1) {
    const asks = rushExcessAt(run, eveningLevel(run), STEPS[step].peak);
    if (asks * G.rushSeconds <= holds && asks <= rateShare(run)) return step;
  }
  return 0;
});

// ---------------------------------------------------------------- streetlights

describe("the streetlights are a real dial: reading each evening beats every simple habit", () => {
  const reads = setsLamps({ patience: 30 });
  let reading: NightResult[];
  /** How many times longer the night takes with this habit than when reading (above 1: reading is faster). */
  const against = (lamps: OilChoice): number =>
    meanSpeed(playAll({ lamps }), reading);

  beforeAll(() => {
    reading = playAll({ lamps: reads });
  });

  it("covers at least twelve different nights", () => {
    expect(new Set(SEEDS).size).toBeGreaterThanOrEqual(12);
    expect(reading).toHaveLength(SEEDS.length);
  });

  it.each([0, 1, 2, 3])(
    "beats leaving them at step %i all night by 5%",
    (step) => {
      expect(against(fixed(step))).toBeGreaterThan(MARGIN);
    }
  );

  it.each([0, 1, 2])("beats dimming to step %i every dusk by 5%", (step) => {
    expect(against(dimsEveryDusk(step))).toBeGreaterThan(MARGIN);
  });

  it.each([0, 1])(
    "beats dimming to step %i only on hot and scorching evenings by 5%",
    (step) => {
      expect(against(dimsHotEvenings(step))).toBeGreaterThan(MARGIN);
    }
  );

  it.each([
    ["a step for each evening, 3-2-1-0", [3, 2, 1, 0]],
    ["a step for each evening, 3-3-2-1", [3, 3, 2, 1]],
    ["a step for each evening, 3-2-2-1", [3, 2, 2, 1]],
  ] as const)("beats %s read off tonight's name by 5%%", (_, table) => {
    expect(against(byEveningName(table))).toBeGreaterThan(MARGIN);
  });

  it("beats the sums the old panel put side by side, done at dusk, by 5%", () => {
    // The panel no longer shows both sides (what the rush asks, in seconds of
    // the grid, against what the bank holds), so a player cannot read the
    // sum off it. Done exactly all the same (the plants, the bank and the
    // lines worked out, the brightest step that fits), it still trails
    // reading: reading also counts the charge still coming in, what a lit
    // night pays at each step and when the rush cannot be met at all.
    expect(against(doesTheSums)).toBeGreaterThan(MARGIN);
  });

  it("is never best at one step: every step is somebody's best evening", () => {
    const best = new Set<number>();
    const run = nightRunFor(1);
    for (const bank of [200, 600, 1000, 2000, 5000]) {
      for (const level of [0, 1, 2, 3]) {
        const trial = {
          ...run,
          resources: {
            ...run.resources,
            pgCharge: bank,
            pgLevel: level,
            pgClock: 70,
          },
        };
        best.add(bestLampForTonight(trial));
      }
    }
    expect([...best].sort()).toEqual([0, 1, 2, 3]);
  });
});

/** A night mid-way: these plants, lines and batteries, the day just starting. */
function nightRunFor(seed: number): RunState {
  const base = newRun(def, undefined, seed);
  const run = reconcileRun(def, {
    ...base,
    phase: 1,
    owned: {
      gen1: 5,
      gen2: 4,
      "lines-1": 1,
      "lines-2": 1,
      "batt-1": 1,
      "batt-2": 1,
      "batt-3": 1,
      "batt-4": 1,
    },
    resources: { ...base.resources, night: 99 },
  });
  def.tick(run, 0.1);
  return run;
}

// ---------------------------------------------------------------- crews

/** One crew builds; the others go to the forecast's likeliest town on every forecast and come home after. */
const chasesTheTopTown: OilChoice = (run, available) => {
  if (run.phase !== 1) return [];
  const picks: string[] = [];
  for (let crew = 1; crew < crewCount(run); crew += 1) {
    const isForecast = isWeatherOpen(run) && weatherStage(run) === "forecast";
    const want = isForecast ? POST_WATCH + likeliestTown(run) : POST_BUILD;
    const id = crewPostActionId(crew, want);
    if (postOf(run, crew) !== want && available.includes(id)) picks.push(id);
  }
  return picks;
};

/** One crew camps on the likeliest town of each forecast and never comes home. */
const campsOnTheTopTown: OilChoice = (run, available) => {
  if (run.phase !== 1 || !isWeatherOpen(run)) return [];
  if (weatherStage(run) !== "forecast") return [];
  const want = POST_WATCH + likeliestTown(run);
  const id = crewPostActionId(1, want);
  return postOf(run, 1) !== want && available.includes(id) ? [id] : [];
};

/** Sends a crew once, at one step of the forecast, and leaves it there. */
const commitsAt =
  (step: number): OilChoice =>
  (run, available) => {
    if (run.phase !== 1) return [];
    const picks: string[] = [];
    for (let crew = 1; crew < crewCount(run); crew += 1) {
      const isForecast = isWeatherOpen(run) && weatherStage(run) === "forecast";
      const isSent = isForecast && forecastStep(run) >= step;
      const isStayingPut =
        isForecast &&
        forecastStep(run) > step &&
        postOf(run, crew) >= POST_WATCH;
      const want = isSent ? POST_WATCH + likeliestTown(run) : POST_BUILD;
      const id = crewPostActionId(crew, want);
      if (!isStayingPut && postOf(run, crew) !== want && available.includes(id))
        picks.push(id);
    }
    return picks;
  };

describe("the crews are a real dial: reading the forecast beats every simple habit", () => {
  const reads = tendsCrews();
  let reading: NightResult[];
  const against = (crews: OilChoice): number =>
    meanSpeed(playAll({ crews }), reading);

  beforeAll(() => {
    reading = playAll({ crews: reads });
  });

  it("beats one crew building and the rest going to the top town on every forecast, by 5%", () => {
    expect(against(chasesTheTopTown)).toBeGreaterThan(MARGIN);
  });

  it("beats camping a spare crew on the top town, by 5%", () => {
    expect(against(campsOnTheTopTown)).toBeGreaterThan(MARGIN);
  });

  it("beats leaving every crew building, by 5%", () => {
    expect(against(nothing)).toBeGreaterThan(MARGIN);
  });

  it.each([1, 3])(
    "beats sending a crew at forecast step %i and leaving it, by 5%",
    (step) => {
      expect(against(commitsAt(step))).toBeGreaterThan(MARGIN);
    }
  );

  it("is never behind sending one crew at the middle forecast: that is the reading, done once", () => {
    expect(against(commitsAt(2))).toBeGreaterThan(0.98);
  });
});

// ---------------------------------------------------------------- batteries

type Choose = (
  run: RunState,
  affordable: UpgradeDef[]
) => UpgradeDef | undefined;

const isBattery = (u: UpgradeDef): boolean => u.id.startsWith("batt-");

/** The bank first: every battery as soon as it can be had, and nothing else while one waits. */
const bankFirst: Choose = (run, affordable) => {
  const bank = affordable.find(isBattery);
  if (bank) return bank;
  const isWaiting = visibleUpgrades(def, run).some(
    (u) => isBattery(u) && !isMaxed(run, u)
  );
  return isWaiting ? undefined : cheapestFirst(run, affordable);
};

/** Never a battery. */
const neverBanks: Choose = (run, affordable) =>
  cheapestFirst(
    run,
    affordable.filter((u) => !isBattery(u))
  );

describe("plants against batteries is a real balance", () => {
  const habits = { lamps: setsLamps({ patience: 30 }), crews: tendsCrews() };
  let steady: NightResult[];
  const against = (choose: Choose): number =>
    meanSpeed(playAll({ ...habits, choose }), steady);

  beforeAll(() => {
    steady = playAll({ ...habits, choose: buysBatteries() });
  });

  it("costs to under-build: no bank at all makes the night 5% longer", () => {
    expect(against(neverBanks)).toBeGreaterThan(MARGIN);
  });

  it("costs to over-build: the bank before every plant makes the night 5% longer", () => {
    expect(against(bankFirst)).toBeGreaterThan(MARGIN);
  });

  it("keeps the late evenings lit for the player who keeps the bank in step", () => {
    const late = steady.map((r) => r.darkByThird[2]);
    const mean = late.reduce((a, b) => a + b, 0) / late.length;
    expect(mean).toBeLessThan(0.35);
  });

  it("never makes a rush that cannot be lit: with everything built a scorching one at Bright is met", () => {
    const run = nightRunFor(2);
    const rich = {
      ...run,
      owned: {
        ...run.owned,
        gen3: 3,
        "lines-1": 1,
        "lines-2": 1,
        "lines-3": 1,
        "lines-4": 1,
        "batt-5": 1,
        "batt-6": 1,
        "batt-7": 1,
        "batt-8": 1,
      },
    };
    const outcome = rushOutcome(
      rich,
      rushExcessAt(rich, 3, STEPS[2].peak),
      Math.min(batteryCapacity(rich), dailyChargeRoom(rich))
    );
    expect(outcome.isLit).toBe(true);
  });
});

describe("the bank is always on offer, however crowded the shop", () => {
  it.each([1, 5])(
    "keeps the next battery step visible all night, from the night's start to its end (seed %i)",
    (seed) => {
      let checked = 0;
      let wasOffered = false;
      const start = nightStart(seed);
      const result = simulate(def, {
        strategy: { ...nightPlayer({}), projects: "best" },
        maxSeconds: 8000,
        step: 1,
        startRun: cloneRun(start),
        seed,
        stopWhen: (run) => {
          if (run.phase >= 2) return true;
          for (let i = 1; i < G.batteryHolds.length; i += 1) {
            const isNext =
              (run.owned[`batt-${i}`] ?? 0) > 0 &&
              (run.owned[`batt-${i + 1}`] ?? 0) === 0 &&
              supplyMW(run) * G.showBankSeconds >= G.batteryHolds[i];
            if (!isNext) continue;
            checked += 1;
            expect(run.revealed).toContain(`batt-${i + 1}`);
            // ... while the shop's own three cards are on offer beside it
            const others = visibleUpgrades(def, run).filter(
              (u) => !u.hasOwnSlot && (run.owned[u.id] ?? 0) === 0
            );
            if (others.length >= 3) wasOffered = true;
          }
          return false;
        },
      });
      expect(result.finalRun.phase).toBeGreaterThanOrEqual(2);
      expect(checked).toBeGreaterThan(100);
      expect(wasOffered).toBe(true);
    }
  );
});

// a reading player is never stuck waiting on a button that is blocked
it("the streetlights can always be changed by a player who waits for the settle", () => {
  let run = nightRunFor(3);
  run = performAction(def, run, lampActionId(0));
  expect(canPerformAction(def, run, lampActionId(1))).toBe(false);
  for (let t = 0; t < G.lampLockSeconds + 1; t += 1) def.tick(run, 1);
  expect(canPerformAction(def, run, lampActionId(1))).toBe(true);
});
