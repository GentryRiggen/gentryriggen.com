import type { WalkGrid } from "./types";

/** Which half of a broken ship a column rides with (see partHalves' halfOfX). */
export type WalkHalf = "bow" | "stern";

/**
 * The half the column under model `x` belongs to when she breaks `atX` cells
 * from the bow: a column goes by its centre, as a grid part does.
 */
export function walkHalfOf(x: number, atX: number): WalkHalf {
  return Math.floor(x) + 0.5 < atX ? "bow" : "stern";
}

/**
 * `grid` cut at the break: only `side`'s columns are left, so the torn edge is
 * a rail like the hull's, and a walker can neither walk nor jump across it.
 */
export function halfWalkGrid(
  grid: WalkGrid,
  side: WalkHalf,
  atX: number
): WalkGrid {
  const keeps = (x: number) => walkHalfOf(x, atX) === side;
  const blockers = grid.blockers.filter((b) => keeps(b.x));
  const stairs = grid.stairs.filter(
    (link) => keeps(link.from.x) && keeps(link.to.x)
  );
  return {
    length: grid.length,
    beam: grid.beam,
    blockers,
    stairs,
    blockersAt: (level) => grid.blockersAt(level).filter((b) => keeps(b.x)),
    floorLevel: (x, z) => (keeps(x) ? grid.floorLevel(x, z) : null),
    isWalkable: (x, z, level) => keeps(x) && grid.isWalkable(x, z, level),
    obstructionAt: (x, z, level) =>
      keeps(x) ? grid.obstructionAt(x, z, level) : null,
    dropLevel: (x, z, level) => (keeps(x) ? grid.dropLevel(x, z, level) : null),
    surfaceHeight: (x, z, level) => grid.surfaceHeight(x, z, level),
    isBlocked: (x, z, level) => !keeps(x) || grid.isBlocked(x, z, level),
    stepLevel: (fromX, fromZ, fromLevel, toX, toZ) =>
      keeps(toX) ? grid.stepLevel(fromX, fromZ, fromLevel, toX, toZ) : null,
  };
}
