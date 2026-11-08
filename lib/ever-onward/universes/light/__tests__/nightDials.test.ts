import {
  canPerformAction,
  newRun,
  performAction,
  reconcileRun,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { tendsCrews } from "../bots";
import { bestLampForTonight, gridClock } from "../grid";
import { lampActionId } from "../lamps";
import { lampLockLeft, lampStep } from "../tick";
import { TUNING } from "../tuning";
import {
  CREW_POST_ACTION_IDS,
  POST_BUILD,
  POST_SCHOOL,
  POST_WATCH,
  crewPostActionId,
  forecastStep,
  frontsSoFar,
  likeliestTown,
  weatherStage,
} from "../weather";

jest.setTimeout(240_000);

const G = TUNING.grid;
const SEEDS = [1, 2, 3, 4];

/** A night mid-way: these plants, lines and batteries, the day just starting. */
function night(owned: Record<string, number>, seed: number): RunState {
  const base = newRun(def, undefined, seed);
  const run = reconcileRun(def, {
    ...base,
    phase: 1,
    owned,
    resources: { ...base.resources, night: 99 },
  });
  def.tick(run, 0.1);
  return run;
}

/** A bank in step with the plants, at three sizes, and a big grid. */
const SNAPSHOTS: Record<string, Record<string, number>> = {
  // the plants a little ahead of the bank
  low: {
    gen1: 5,
    gen2: 4,
    "lines-1": 1,
    "batt-1": 1,
    "batt-2": 1,
    "batt-3": 1,
  },
  // the bank meets a usual evening
  mid: {
    gen1: 5,
    gen2: 4,
    "lines-1": 1,
    "lines-2": 1,
    "batt-1": 1,
    "batt-2": 1,
    "batt-3": 1,
    "batt-4": 1,
  },
  // the bank is a step ahead
  high: {
    gen1: 5,
    gen2: 4,
    "lines-1": 1,
    "lines-2": 1,
    "batt-1": 1,
    "batt-2": 1,
    "batt-3": 1,
    "batt-4": 1,
    "batt-5": 1,
  },
  // dams and a big bank
  big: {
    gen1: 5,
    gen2: 7,
    gen3: 3,
    "lines-1": 1,
    "lines-2": 1,
    "batt-1": 1,
    "batt-2": 1,
    "batt-3": 1,
    "batt-4": 1,
    "batt-5": 1,
    "batt-6": 1,
  },
};

type LampPolicy = (run: RunState) => number | null;

/** Power earned over twenty days with no buying, the streetlights set by `policy`. */
function lampDays(
  owned: Record<string, number>,
  policy: LampPolicy,
  seed: number
): number {
  let run = night(owned, seed);
  const start = run.resources.power;
  for (let t = 0; t < G.daySeconds * 20; t += 1) {
    const want = policy(run);
    if (want !== null && want !== lampStep(run) && lampLockLeft(run) <= 0)
      run = performAction(def, run, lampActionId(want));
    def.tick(run, 1);
  }
  return run.resources.power - start;
}

/** The streetlights on offer as the evening nears (decided once, held through the rush). */
const lookAt = G.rushAt - (G.lampLockSeconds + 3);
const inWindow = (run: RunState): boolean =>
  gridClock(run) >= lookAt && gridClock(run) < G.rushAt;
const afterRush = (run: RunState): boolean =>
  gridClock(run) >= G.rushAt && gridClock(run) < G.rushAt + G.rushSeconds + 6;

const reads: LampPolicy = (run) => {
  if (inWindow(run)) return bestLampForTonight(run);
  return afterRush(run) ? null : 3;
};
const fixed =
  (step: number): LampPolicy =>
  () =>
    step;
/** The simple rules: dim every dusk, all the way or one step. */
const dimsEveryDusk =
  (step: number): LampPolicy =>
  (run) =>
    inWindow(run) ? step : afterRush(run) ? null : 3;

describe("the streetlights are a real dial: no fixed setting is best", () => {
  const total = (name: string, policy: LampPolicy): number =>
    SEEDS.reduce(
      (sum, seed) => sum + lampDays(SNAPSHOTS[name], policy, seed),
      0
    );

  for (const name of ["mid", "high", "big"]) {
    it(`reading each evening beats every fixed step and every dim-at-dusk rule by 5% (${name})`, () => {
      const read = total(name, reads);
      for (const step of [0, 1, 2, 3])
        expect(total(name, fixed(step))).toBeLessThan(read / 1.05);
      for (const step of [0, 1])
        expect(total(name, dimsEveryDusk(step))).toBeLessThan(read / 1.05);
    });
  }

  it("every step is the best one for some evening", () => {
    const run = night(SNAPSHOTS.mid, 1);
    const best = new Set<number>();
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

// ------------------------------------------------------------------ crews

type CrewPolicy = (run: RunState) => string[];

const available = (run: RunState): string[] =>
  CREW_POST_ACTION_IDS.filter((id) => canPerformAction(def, run, id));

const posted =
  (posts: number[]): CrewPolicy =>
  (run) => {
    const ok = available(run);
    return posts
      .map((post, crew) => crewPostActionId(crew, post))
      .filter((id) => ok.includes(id));
  };

/** Sends one crew to the likeliest town at one step of the forecast and leaves it. */
const commitsAt =
  (step: number): CrewPolicy =>
  (run) => {
    if (weatherStage(run) !== "forecast")
      return posted([POST_BUILD, POST_BUILD, POST_BUILD])(run);
    if (forecastStep(run) !== step) return [];
    return posted([POST_WATCH + likeliestTown(run), POST_BUILD, POST_BUILD])(
      run
    );
  };

/** Reads the forecast at every step and moves the crew worth most (see bots.ts). */
const readsForecast: CrewPolicy = (run) =>
  tendsCrews({ learns: false })(run, available(run));

function crewDays(
  owned: Record<string, number>,
  policy: CrewPolicy,
  seed: number
): number {
  let run = night(owned, seed);
  const start = run.resources.power;
  for (let t = 0; t < 2400; t += 1) {
    if (t % 2 === 0)
      for (const id of policy(run))
        if (canPerformAction(def, run, id)) run = performAction(def, run, id);
    def.tick(run, 1);
  }
  expect(frontsSoFar(run)).toBeGreaterThan(10);
  return run.resources.power - start;
}

describe("the crews are a real dial: no fixed post is best", () => {
  const owned = {
    ...SNAPSHOTS.high,
    gen3: 1,
  };
  const total = (policy: CrewPolicy): number =>
    SEEDS.reduce((sum, seed) => sum + crewDays(owned, policy, seed), 0);

  it("reading the forecast beats every fixed arrangement by 20%", () => {
    const read = total(readsForecast);
    const fixedPosts: number[][] = [
      [POST_BUILD, POST_BUILD],
      [POST_BUILD, POST_SCHOOL],
      [POST_SCHOOL, POST_SCHOOL],
      [POST_WATCH, POST_BUILD],
      [POST_WATCH + 1, POST_BUILD],
      [POST_WATCH, POST_WATCH + 1],
      [POST_WATCH + 2, POST_WATCH + 2],
    ];
    for (const posts of fixedPosts)
      expect(total(posted(posts))).toBeLessThan(read / 1.2);
  });

  it("beats a guess made at the first forecast and never moved by 8%, and waiting for the last forecast by 4%", () => {
    const read = total((run) =>
      tendsCrews({ learns: false, fromStep: 1 })(run, available(run))
    );
    expect(total(commitsAt(1))).toBeLessThan(read / 1.08);
    expect(total(commitsAt(3))).toBeLessThan(read / 1.04);
  });
});
