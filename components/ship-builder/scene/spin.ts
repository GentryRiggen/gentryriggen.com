import { clamp } from "./animationMath";

const MIN_KNOTS = 8;
const MAX_KNOTS = 30;
export const MIN_REV_PER_SEC = 0.5;
export const MAX_REV_PER_SEC = 3;

/** Revolutions per second: 0 at rest, 0.5 at 8 kn rising linearly to 3 at 30. */
export function spinRevPerSec(topSpeedKnots: number): number {
  if (!(topSpeedKnots > 0)) return 0;
  const t = clamp((topSpeedKnots - MIN_KNOTS) / (MAX_KNOTS - MIN_KNOTS), 0, 1);
  return MIN_REV_PER_SEC + t * (MAX_REV_PER_SEC - MIN_REV_PER_SEC);
}
