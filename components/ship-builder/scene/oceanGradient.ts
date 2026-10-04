/** Water within this radius of the ship's centre keeps the near colour. */
export const OCEAN_NEAR_RADIUS = 20;
/** Past this radius the water is fully the far (deep) colour. */
export const OCEAN_FAR_RADIUS = 180;
export const OCEAN_SIZE = 600;
/** Enough vertices for a smooth radial falloff with per-vertex colours. */
export const OCEAN_SEGMENTS = 96;

/**
 * How far toward the deep colour the water is at `distance` from the ship:
 * 0 near the ship, 1 toward the horizon, smoothstepped in between.
 */
export function oceanDepthMix(distance: number): number {
  const t =
    (distance - OCEAN_NEAR_RADIUS) / (OCEAN_FAR_RADIUS - OCEAN_NEAR_RADIUS);
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}
