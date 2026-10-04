export type Vec3Tuple = [number, number, number];

/** Roughly one bulb every 0.4 of string, never fewer than three. */
const BULB_SPACING = 0.4;
const MIN_BULBS = 3;
const MAX_BULBS = 40;
/** The string droops by this share of its length, up to MAX_SAG. */
const SAG_SHARE = 0.1;
const MAX_SAG = 0.9;

export function stringLength(target: Vec3Tuple): number {
  return Math.hypot(...target);
}

export function bulbCountFor(length: number): number {
  const count = Math.round(length / BULB_SPACING);
  return Math.min(MAX_BULBS, Math.max(MIN_BULBS, count));
}

export function sagFor(length: number): number {
  return Math.min(MAX_SAG, length * SAG_SHARE);
}

/**
 * A point a fraction `t` (0 to 1) of the way along a festoon from the origin
 * to `target`: the straight line dipped by a hanging-cable curve, deepest in
 * the middle and zero at both ends.
 */
export function festoonPoint(target: Vec3Tuple, t: number): Vec3Tuple {
  const sag = sagFor(stringLength(target)) * 4 * t * (1 - t);
  return [target[0] * t, target[1] * t - sag, target[2] * t];
}
