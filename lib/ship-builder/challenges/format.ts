import { formatStoryTime } from "../sim/story";
import {
  challengeDef,
  NEVER_SINKS_MINUTES,
  nextStarAt,
  type ChallengeId,
} from "./definitions";

const SHIPSHAPE_SEAS = [
  "She capsized in a calm sea",
  "Rode out a calm sea",
  "Rode out a choppy sea",
  "Rode out a stormy sea",
] as const;

/** A best value in plain words, e.g. "Stayed afloat 1 hour 40 minutes". */
export function describeValue(id: ChallengeId, value: number): string {
  switch (id) {
    case "outlast":
      return value >= NEVER_SINKS_MINUTES
        ? "She never sank"
        : `Stayed afloat ${formatStoryTime(value)}`;
    case "evacuation":
      return `${value}% of people saved`;
    case "shipshape":
      return SHIPSHAPE_SEAS[Math.max(0, Math.min(3, value))];
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
        ? "Ride out a calm sea"
        : target === 2
          ? "Ride out a choppy sea"
          : "Ride out a stormy sea";
  }
}

/** The "beat it" line for a result card. */
export function beatItHint(id: ChallengeId, value: number): string {
  const goal = describeGoal(id, value);
  if (goal === null) return "Three stars! You beat this one.";
  return `For the next star: ${goal.charAt(0).toLowerCase()}${goal.slice(1)}. ${challengeDef(id).tip}`;
}
