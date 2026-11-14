/**
 * The longest frame step the weapon effects take. A slow device then slows the
 * show down instead of skipping its beats. Tests can raise it (the test hooks
 * only) to see effects at real-time pace under software rendering.
 */
export const fxClock = { maxDt: 0.05 };

export function stepDt(rawDt: number): number {
  return Math.min(rawDt, fxClock.maxDt);
}
