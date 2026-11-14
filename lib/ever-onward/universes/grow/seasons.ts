import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

export type Season = "spring" | "summer" | "autumn" | "winter";

/** In the order they come round. */
export const SEASONS: readonly Season[] = [
  "spring",
  "summer",
  "autumn",
  "winter",
];

export type SeasonStream = "plant" | "grow" | "harvest";

const STREAM_INDEX: Record<SeasonStream, number> = {
  plant: 0,
  grow: 1,
  harvest: 2,
};

/** Seconds since the current phase began (seasons follow the phase clock). */
export const phaseTime = (run: RunState): number =>
  Math.max(0, run.time - (run.transitions.at(-1)?.at ?? 0));

const yearSeconds = (): number => TUNING.seasons.seconds * SEASONS.length;

/** Which season the phase clock is in; the yard opens in spring. */
export function seasonOf(run: RunState): Season {
  const into = phaseTime(run) % yearSeconds();
  return SEASONS[Math.floor(into / TUNING.seasons.seconds)];
}

/** Seconds until the next season begins. */
export function seasonSecondsLeft(run: RunState): number {
  const length = TUNING.seasons.seconds;
  return length - (phaseTime(run) % length);
}

/** Seconds until the next autumn begins (0 while it is autumn). */
export function secondsToAutumn(run: RunState): number {
  const length = TUNING.seasons.seconds;
  const into = phaseTime(run) % yearSeconds();
  const autumnAt = SEASONS.indexOf("autumn") * length;
  if (into >= autumnAt && into < autumnAt + length) return 0;
  return (autumnAt - into + yearSeconds()) % yearSeconds();
}

/**
 * How much the season helps a stream: planting (taps), growing (helpers) or
 * harvesting (picking by hand). Never under 1, and winter is exactly 1: a
 * season rests, it never punishes.
 */
export function seasonBoost(run: RunState, stream: SeasonStream): number {
  return TUNING.seasons[seasonOf(run)][STREAM_INDEX[stream]];
}
