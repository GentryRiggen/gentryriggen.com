import { formatStoryTime } from "../sim/story";
import {
  challengeDef,
  NEVER_SINKS_MINUTES,
  SMOOTH_FINISH_CELLS,
  NOT_SCORED,
  STEADY_PEAK_ROLL_DEG,
  nextStarAt,
  type ChallengeId,
} from "./definitions";

const SHIPSHAPE_SEAS = [
  "She capsized in a choppy sea",
  "Rode out a choppy sea",
  "Rode out a stormy sea with her weight fairly high",
  "Rode out a stormy sea with her weight kept low",
] as const;

/** Said when a trial did not apply (see `NOT_SCORED`). */
export const NOT_SCORED_TEXT =
  "She stayed afloat, so there was no sinking to escape. Try it on a ship that can sink.";

/** A best value in plain words, e.g. "Stayed afloat 1 hour 40 minutes". */
export function describeValue(id: ChallengeId, value: number): string {
  if (value === NOT_SCORED) return NOT_SCORED_TEXT;
  switch (id) {
    case "outlast":
      return value >= NEVER_SINKS_MINUTES
        ? "She never sank"
        : `Stayed afloat ${formatStoryTime(value)}`;
    case "evacuation":
      return `${value}% of people saved`;
    case "shipshape":
      return SHIPSHAPE_SEAS[Math.max(0, Math.min(3, value))];
    case "smooth":
      return value >= SMOOTH_FINISH_CELLS
        ? "Sailed the whole course"
        : `Sailed ${value} cells clear`;
  }
}

/** What it takes to earn the next star, or null at three stars. */
export function describeGoal(id: ChallengeId, value: number): string | null {
  const target = nextStarAt(id, value);
  if (target === null) return null;
  switch (id) {
    case "outlast":
      return target >= NEVER_SINKS_MINUTES
        ? "Never sink"
        : `Stay afloat ${formatStoryTime(target)}`;
    case "evacuation":
      return target >= 100
        ? "Get everyone off safely"
        : `Save ${target}% of the people`;
    case "shipshape":
      return target === 1
        ? "Ride out a choppy sea"
        : target === 2
          ? "Ride out a stormy sea with your weight lower"
          : `Ride out a stormy sea with your weight kept low, rolling under ${STEADY_PEAK_ROLL_DEG} degrees`;
    case "smooth":
      return target >= SMOOTH_FINISH_CELLS
        ? `Sail the whole ${SMOOTH_FINISH_CELLS}-cell course without a bump`
        : `Sail ${target} cells without a bump`;
  }
}

/** The "beat it" line for a result card. */
export function beatItHint(id: ChallengeId, value: number): string {
  const goal = describeGoal(id, value);
  if (goal === null) return "Three stars! You beat this one.";
  return `For the next star: ${goal.charAt(0).toLowerCase()}${goal.slice(1)}. ${challengeDef(id).tip}`;
}

/** Shipshape: what happened in the trial that decided the score. */
export function describeShipshapeRun(
  sea: string,
  peakRollDeg: number,
  hasCapsized: boolean
): string {
  return hasCapsized
    ? `She capsized in the ${sea} sea.`
    : `In the ${sea} sea she rolled ${Math.round(peakRollDeg)} degrees at most.`;
}

/** Smooth sailing: how the sail ended, in a sentence. */
export function describeSailEnd(
  end: "sailing" | "finished" | "hit" | "gave-up",
  hitKind: string | undefined
): string {
  switch (end) {
    case "finished":
      return "You crossed the finish line without touching a thing.";
    case "hit":
      return `She ran into ${hitKind === "ship" ? "another ship" : hitKind === "rock" ? "a rock" : "an iceberg"}.`;
    case "gave-up":
      return "You stopped the sail early.";
    case "sailing":
      return "";
  }
}
