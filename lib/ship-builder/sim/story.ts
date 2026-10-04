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
