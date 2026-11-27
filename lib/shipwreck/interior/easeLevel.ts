/**
 * How the scene shows a room's water (README.md "Water inside"): the shown
 * level eases toward the room's target at most `maxRate` metres per real
 * second, so a room never pops full. A dry room (−Infinity), a first sight
 * or any non-finite level snaps to the target; a bad target (NaN) or step
 * keeps what is shown.
 */

/** The fastest the shown water climbs or falls (m per real second). */
export const LEVEL_EASE_M_PER_S = 0.5;

export function easeLevel(
  shown: number,
  target: number,
  dtReal: number,
  maxRate = LEVEL_EASE_M_PER_S
): number {
  if (Number.isNaN(target)) return shown;
  if (!Number.isFinite(target) || !Number.isFinite(shown)) return target;
  if (!(dtReal > 0)) return shown;
  const step = maxRate * dtReal;
  const d = target - shown;
  if (Math.abs(d) <= step) return target;
  return d > 0 ? shown + step : shown - step;
}
