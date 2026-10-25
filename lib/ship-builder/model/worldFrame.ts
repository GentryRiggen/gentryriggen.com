/**
 * The scene's vertical frame, kept here so lib code (the sim) can work out
 * world heights. `components/ship-builder/scene/coords.ts` re-exports these.
 */

/** Main deck height above the waterline (world y = 0). */
export const DECK_Y = 1.2;
/** World height of one build level. */
export const LEVEL_HEIGHT = 1;
