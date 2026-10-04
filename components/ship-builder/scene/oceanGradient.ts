/** Water within this radius of the ship's centre keeps the near colour. */
export const OCEAN_NEAR_RADIUS = 20;
/** Past this radius the water is fully the far (deep) colour. */
export const OCEAN_FAR_RADIUS = 180;
export const OCEAN_SIZE = 600;
/**
 * The grid is dense under the ship and sparse toward the horizon (see
 * `oceanAxisCoordinate`): about 0.4 units apart near the ship, where the
 * waves are drawn, for about 17k vertices in all.
 */
export const OCEAN_SEGMENTS = 128;

const OCEAN_LINEAR_SHARE = 0.085;

/**
 * Maps a uniform grid coordinate `t` in [-1, 1] to a distance along one axis
 * of the ocean, packing vertices close together near 0.
 */
export function oceanAxisCoordinate(t: number): number {
  const a = Math.abs(t);
  const shaped = OCEAN_LINEAR_SHARE * a + (1 - OCEAN_LINEAR_SHARE) * a ** 4;
  return Math.sign(t) * shaped * (OCEAN_SIZE / 2);
}

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
