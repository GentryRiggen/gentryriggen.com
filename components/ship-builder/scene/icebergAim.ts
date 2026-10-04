/**
 * Where on the hull the iceberg is aimed, in cells from the bow. The hull's
 * group is centred on its length with the bow toward +X (see `modelToWorld`),
 * so a hit at local `x` is `lengthCells / 2 - x` cells from the bow. Taps on
 * the rounded bow or stern ends land just outside 0..length and are clamped.
 */
export function impactXFromHit(localX: number, lengthCells: number): number {
  const fromBow = lengthCells / 2 - localX;
  return Math.min(Math.max(fromBow, 0), lengthCells);
}

/** The opposite conversion: the hull-local x of a spot in cells from the bow. */
export function hullXOfImpact(impactX: number, lengthCells: number): number {
  return lengthCells / 2 - impactX;
}
