/** Sideways drag, in pixels, that is ignored so a resting finger never turns. */
export const LOOK_DEAD_ZONE_PX = 8;
/** Sideways drag, in pixels, that turns at full speed. */
export const LOOK_FULL_TURN_PX = 100;
/** Above 1 so small drags turn gently and fine aim is easy. */
const LOOK_CURVE = 1.3;

/**
 * Turns how far the pointer is from where a look drag began into a turn
 * speed from -1 (full left) to 1 (full right): nothing inside the dead zone,
 * then a curve that eases in, so small moves aim precisely and a long drag
 * spins quickly.
 */
export function lookTurn(offsetPx: number): number {
  if (!Number.isFinite(offsetPx)) return 0;
  const reach = Math.abs(offsetPx) - LOOK_DEAD_ZONE_PX;
  if (reach <= 0) return 0;
  const share = Math.min(1, reach / (LOOK_FULL_TURN_PX - LOOK_DEAD_ZONE_PX));
  return Math.sign(offsetPx) * share ** LOOK_CURVE;
}
