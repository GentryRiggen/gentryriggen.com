import type { WalkGrid } from "./types";

/** Which half of a broken ship the walker rides. */
export type WalkHalf = "bow" | "stern";

/** The half a walker at model `x` rides when she breaks `atX` cells from the bow. */
export function walkHalfOf(x: number, atX: number): WalkHalf {
  return x < atX ? "bow" : "stern";
}

/**
 * Whether the whole of column `x` is on `side` of the break. The halves are
 * drawn cut at the break line, which often falls part-way through a column,
 * so a column the line crosses belongs to neither: no floor over the gap.
 */
export function isColumnOn(side: WalkHalf, x: number, atX: number): boolean {
  return side === "bow" ? x + 1 <= atX : x >= atX;
}

/**
 * `grid` cut at the break: only the columns wholly on `side` are left, so the
 * torn edge is a rail like the hull's, and a walker can neither walk nor jump
 * across it. Build `grid` from that half's own parts (a part that spans the
 * break goes with one half, see `walkHalfShip` in the scene), so the other
 * half's cabins leave no invisible walls or roofs behind.
 */
export function halfWalkGrid(
  grid: WalkGrid,
  side: WalkHalf,
  atX: number
): WalkGrid {
  const keeps = (x: number) => isColumnOn(side, x, atX);
  const isOnSide = (b: { x: number }) => walkHalfOf(b.x, atX) === side;
  const blockers = grid.blockers.filter(isOnSide);
  const stairs = grid.stairs.filter(
    (link) => keeps(link.from.x) && keeps(link.to.x)
  );
  return {
    length: grid.length,
    beam: grid.beam,
    blockers,
    stairs,
    blockersAt: (level) => grid.blockersAt(level).filter(isOnSide),
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
