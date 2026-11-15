/**
 * The longest frame step the weapon effects take. A slow device then slows the
 * show down instead of skipping its beats. Tests can raise it (the test hooks
 * only) to see effects at real-time pace under software rendering.
 * `timeScale` slows every effect for slow-motion moments (1 = normal).
 */
export const fxClock = { maxDt: 0.05, timeScale: 1 };

export function stepDt(rawDt: number): number {
  return Math.min(rawDt, fxClock.maxDt) * fxClock.timeScale;
}

/** Sets the slow-motion scale, clamped to 0.05..1. */
export function setTimeScale(s: number): void {
  fxClock.timeScale = Math.min(1, Math.max(0.05, s));
}
