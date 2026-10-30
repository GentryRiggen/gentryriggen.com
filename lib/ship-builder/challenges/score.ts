import type { EvacuationPlan } from "../crowd/evacuation";
import { storyMinutesSinceImpact } from "../sim/story";
import { runTrial } from "../sim/seaTrial";
import type { SimSea, SimState, TrialInput, TrialOutcome } from "../sim/types";
import {
  MAX_VALUE,
  NEVER_SINKS_MINUTES,
  starsFor,
  type ChallengeId,
  type Stars,
} from "./definitions";

/** What a trial earned: the value that is scored, and the stars it makes. */
export interface ChallengeScore {
  id: ChallengeId;
  value: number;
  stars: Stars;
}

function scored(id: ChallengeId, rawValue: number): ChallengeScore {
  const value = Math.max(
    0,
    Math.min(
      MAX_VALUE[id],
      Number.isFinite(rawValue) ? Math.round(rawValue) : 0
    )
  );
  return { id, value, stars: starsFor(id, value) };
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

function survived(outcome: TrialOutcome | null): boolean {
  return outcome === "steady" || outcome === "recovered";
}

/**
 * Shipshape: 1 star for riding out a calm sea, 2 for a choppy one and 3 for
 * a stormy one. A sea only counts once the gentler ones were survived.
 */
export function scoreShipshape(
  outcomes: Readonly<Record<SimSea, TrialOutcome | null>>
): ChallengeScore {
  let value = 0;
  for (const sea of SEAS_IN_ORDER) {
    if (!survived(outcomes[sea])) break;
    value++;
  }
  return scored("shipshape", value);
}

/** Runs the waves trial in every sea (cheap, deterministic) for the score. */
export function shipshapeOutcomes(
  input: TrialInput
): Record<SimSea, TrialOutcome | null> {
  const outcomeIn = (sea: SimSea) => runTrial({ ...input, sea }).outcome;
  return {
    calm: outcomeIn("calm"),
    choppy: outcomeIn("choppy"),
    stormy: outcomeIn("stormy"),
  };
}
