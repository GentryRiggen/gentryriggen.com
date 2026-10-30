import type { EvacuationPlan } from "../crowd/evacuation";
import type { ObstacleKind } from "../sail/types";
import type { SmoothRun } from "./smooth";
import { storyMinutesSinceImpact } from "../sim/story";
import { createTrial, stepTrial } from "../sim/seaTrial";
import type { SimSea, SimState, TrialInput, TrialOutcome } from "../sim/types";
import {
  MAX_VALUE,
  NEVER_SINKS_MINUTES,
  NOT_SCORED,
  SOLID_STABILITY_RATIO,
  STEADY_STABILITY_RATIO,
  starsFor,
  type ChallengeId,
  type Stars,
} from "./definitions";

/** What a trial earned: the value that is scored, and the stars it makes. */
export interface ChallengeScore {
  id: ChallengeId;
  /** `NOT_SCORED` when `isScored` is false. */
  value: number;
  stars: Stars;
  /** False when the trial did not apply, so nothing is saved or sent. */
  isScored: boolean;
  /** Shipshape: the sea whose trial decided the score. */
  sea?: SimSea;
  /** Shipshape: the most she rolled in that trial, in degrees. */
  peakRollDeg?: number;
  /** Shipshape: whether she capsized in that trial. */
  hasCapsized?: boolean;
  /** Smooth sailing: how the sail ended, and what she hit if she did. */
  sailEnd?: SmoothRun["status"];
  hitKind?: ObstacleKind;
}

function scored(id: ChallengeId, rawValue: number): ChallengeScore {
  const value = Math.max(
    0,
    Math.min(
      MAX_VALUE[id],
      Number.isFinite(rawValue) ? Math.round(rawValue) : 0
    )
  );
  return { id, value, stars: starsFor(id, value), isScored: true };
}

/** A trial that did not apply: no stars, nothing to save. */
export function notScored(id: ChallengeId): ChallengeScore {
  return { id, value: NOT_SCORED, stars: 0, isScored: false };
}

/**
 * Outlast the Titanic: story minutes from the iceberg strike to the sinking.
 * A ship that stays afloat scores a full day (three stars). A trial that is
 * not finished yet, or not an iceberg trial, scores nothing.
 */
export function scoreOutlast(state: SimState): ChallengeScore {
  if (state.outcome === "afloat") return scored("outlast", NEVER_SINKS_MINUTES);
  const sunk = state.events.find((event) => event.kind === "sunk");
  if (state.outcome !== "sank" || !sunk) return scored("outlast", 0);
  return scored("outlast", storyMinutesSinceImpact(sunk.at));
}

/** Everyone off safely: the share of people in lifeboats, as 0 to 100. */
export function scoreEvacuation(
  peopleCount: number,
  savedCount: number
): ChallengeScore {
  if (peopleCount <= 0) return scored("evacuation", 0);
  return scored("evacuation", (100 * savedCount) / peopleCount);
}

/** People in a boat when the sinking is over (the plan's fate at `end`). */
export function countSaved(
  plan: Pick<EvacuationPlan, "fateAt">,
  peopleCount: number,
  end: number
): number {
  let saved = 0;
  for (let i = 0; i < peopleCount; i++) {
    if (plan.fateAt(i, end).kind === "in-boat") saved++;
  }
  return saved;
}

const SEAS_IN_ORDER: readonly SimSea[] = ["calm", "choppy", "stormy"];
const DEG = 180 / Math.PI;
/** A weather trial that has not ended by now is not going to. */
const MAX_WEATHER_S = 60;

/** One sea's weather trial, run without rendering. */
export interface ShipshapeRun {
  outcome: TrialOutcome | null;
  /** The most she rolled away from her resting list, in degrees. */
  peakRollDeg: number;
  /** How high her weight sits (see `SOLID_STABILITY_RATIO`); lower is better. */
  stabilityRatio: number;
}

function survived(outcome: TrialOutcome | null): boolean {
  return outcome === "steady" || outcome === "recovered";
}

function runWeather(input: TrialInput, sea: SimSea): ShipshapeRun {
  const trial: TrialInput = { ...input, sea };
  let state = createTrial(trial);
  let peak = 0;
  while (state.phase !== "done" && state.time < MAX_WEATHER_S) {
    state = stepTrial(trial, state);
    peak = Math.max(peak, Math.abs(state.pose.roll - trial.ship.listAngle));
  }
  return {
    outcome: state.outcome,
    peakRollDeg: peak * DEG,
    stabilityRatio: input.ship.stabilityRatio,
  };
}

/** Runs the weather trial in every sea (cheap, deterministic) for the score. */
export function shipshapeRuns(input: TrialInput): Record<SimSea, ShipshapeRun> {
  return {
    calm: runWeather(input, "calm"),
    choppy: runWeather(input, "choppy"),
    stormy: runWeather(input, "stormy"),
  };
}

/**
 * The sea whose trial decides the score: the first she could not ride out,
 * else the stormy one (which sets how steadily she did it).
 */
export function decidingSea(
  runs: Readonly<Record<SimSea, ShipshapeRun>>
): SimSea {
  return SEAS_IN_ORDER.find((sea) => !survived(runs[sea].outcome)) ?? "stormy";
}

/**
 * Shipshape: 1 star for riding out a choppy sea (calm comes with it). A
 * stormy sea ridden out with her weight low enough (`SOLID_STABILITY_RATIO`)
 * is 2 stars, and 3 if it is lower still (`STEADY_STABILITY_RATIO`). The
 * roll angle is shown on the card but does not score: a stormy sea rolls
 * every stable ship the same.
 */
export function scoreShipshape(
  runs: Readonly<Record<SimSea, ShipshapeRun>>
): ChallengeScore {
  const sea = decidingSea(runs);
  const run = runs[sea];
  const stormy = runs.stormy;
  let value = 0;
  if (survived(runs.calm.outcome) && survived(runs.choppy.outcome)) {
    value = 1;
    if (
      survived(stormy.outcome) &&
      stormy.stabilityRatio <= SOLID_STABILITY_RATIO
    ) {
      value = stormy.stabilityRatio <= STEADY_STABILITY_RATIO ? 3 : 2;
    }
  }
  return {
    ...scored("shipshape", value),
    sea,
    peakRollDeg: run.peakRollDeg,
    hasCapsized: run.outcome === "capsized",
  };
}

/**
 * Smooth sailing: the cells she got from the start before touching anything
 * (the whole course if she crossed the finish line). A sail still going
 * scores what it has.
 */
export function scoreSmooth(run: SmoothRun): ChallengeScore {
  // A ship that cannot sail has nothing to score: no stars, nothing saved.
  if (run.status === "cannot-sail") return notScored("smooth");
  return {
    ...scored("smooth", run.reach),
    sailEnd: run.status,
    ...(run.hitKind ? { hitKind: run.hitKind } : {}),
  };
}
