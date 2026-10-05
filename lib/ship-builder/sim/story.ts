import { ICEBERG_IMPACT_S } from "./flooding";

/**
 * Story time: an iceberg trial plays in well under a minute, but the result
 * card talks in the hours a real ship would take. Tuned so the Titanic
 * template, struck at the bow, sinks in about 2 hours 40 minutes.
 */
export const STORY_MINUTES_PER_SIM_SECOND = 5;

/** Whole story minutes for a sim time in seconds. */
export function storyMinutes(simSeconds: number): number {
  return Math.round(simSeconds * STORY_MINUTES_PER_SIM_SECOND);
}

/** Whole story minutes since the iceberg struck (zero while it approaches). */
export function storyMinutesSinceImpact(simSeconds: number): number {
  return storyMinutes(Math.max(0, simSeconds - ICEBERG_IMPACT_S));
}

/**
 * The sim time the story clock shows: it stops when she goes under (the
 * `sunk` event). The descent to the sea floor is a journey for the camera,
 * not more time passing for the people aboard.
 */
export function storyClockSeconds(
  simSeconds: number,
  events: readonly { kind: string; at: number }[]
): number {
  const sunk = events.find((event) => event.kind === "sunk");
  return sunk ? Math.min(simSeconds, sunk.at) : simSeconds;
}

/** "2 hours 40 minutes", "1 hour", "35 minutes". */
export function formatStoryTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (rest > 0 || hours === 0) {
    parts.push(`${rest} ${rest === 1 ? "minute" : "minutes"}`);
  }
  return parts.join(" ");
}
