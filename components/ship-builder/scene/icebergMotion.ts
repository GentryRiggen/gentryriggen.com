import { ICEBERG_IMPACT_S } from "@/lib/ship-builder/sim/flooding";

/** Sim seconds until the iceberg meets the hull (shared with the sim). */
export { ICEBERG_IMPACT_S };

/** The iceberg slides past the hull until this many sim seconds. */
export const ICEBERG_SLIDE_S = 3;
/** How far ahead of the strike spot the iceberg starts, in cells. */
export const ICEBERG_APPROACH = 16;
/** How fast it drifts away after the slide, in cells per second. */
const DRIFT_SPEED = 1.5;
/** The drift stops here so a long result card never sends it off to space. */
const MAX_DRIFT_SECONDS = 30;

/**
 * The iceberg's position along the hull relative to the strike spot, in
 * cells (positive is toward the bow). The ship sails forward, so the berg
 * comes in from ahead, touches at `ICEBERG_IMPACT_S`, slides past until
 * `ICEBERG_SLIDE_S`, then drifts slowly astern.
 */
export function icebergOffset(seconds: number): number {
  if (seconds <= ICEBERG_SLIDE_S) {
    return ICEBERG_APPROACH * (1 - seconds / ICEBERG_IMPACT_S);
  }
  const drifting = Math.min(seconds - ICEBERG_SLIDE_S, MAX_DRIFT_SECONDS);
  const slid = ICEBERG_APPROACH * (1 - ICEBERG_SLIDE_S / ICEBERG_IMPACT_S);
  return slid - drifting * DRIFT_SPEED;
}
