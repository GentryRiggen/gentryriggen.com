/**
 * Where the hull tears when she breaks. The fracture is a jagged surface
 * through `breakX`: at each point (y, z) of the hull's cross-section the tear
 * runs at `tearX(breakX, y, z)`, within `TEAR_AMPLITUDE` of `breakX`. Both
 * halves are built against the same function, so they meet exactly along it,
 * and every fitting, window and wire goes to the side its own position is on.
 *
 * Ship frame: x forward, y to port, z up from the keel at midships.
 */

export type ShipPart = "whole" | "bow" | "stern";
export type HalfSide = "bow" | "stern";

/** The tear wanders this far (m) either side of `breakX`. */
export const TEAR_AMPLITUDE = 1.6;

/** A triangle wave in [0, 1] with period 1: torn steel is all corners. */
function tri(t: number): number {
  const f = t - Math.floor(t);
  return 1 - Math.abs(2 * f - 1);
}

/** The x of the tear at (y, z) of the cross-section. */
export function tearX(breakX: number, y: number, z: number): number {
  const j =
    0.55 * tri(0.21 * z + 0.13 * y + 0.31) +
    0.3 * tri(0.67 * z - 0.43 * y + 0.71) +
    0.15 * tri(1.9 * z + 1.3 * y + 0.17);
  return breakX + (2 * j - 1) * TEAR_AMPLITUDE;
}

/** Which half a point belongs to once she breaks at `breakX`. */
export function sideOf(
  breakX: number,
  x: number,
  y: number,
  z: number
): HalfSide {
  return x >= tearX(breakX, y, z) ? "bow" : "stern";
}

/** Whether a point is drawn in `part` (the whole ship takes everything). */
export function isInPart(
  part: ShipPart,
  breakX: number | null,
  x: number,
  y: number,
  z: number
): boolean {
  if (part === "whole" || breakX === null) return part === "whole";
  return sideOf(breakX, x, y, z) === part;
}
