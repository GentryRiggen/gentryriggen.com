import { CELLS_PER_SEGMENT } from "../model/grid";
import type { BulkheadHeight, Hull } from "../model/types";
import type { CompartmentSpec } from "./types";

/** How far up the hull's depth each bulkhead height reaches. */
export const BULKHEAD_FRACTION: Record<BulkheadHeight, number> = {
  low: 0.45,
  waterline: 0.75,
  deck: 1,
};

/** Length of the iceberg's gash along the hull, in cells (about 2 segments). */
export const GASH_LENGTH = 6;

/**
 * The hull's watertight compartments, bow first. Bulkheads outside the hull
 * or doubled up on one boundary are ignored (the first one wins). The hull's
 * ends count as walls that reach the deck.
 */
export function compartmentSpecsOf(hull: Hull): CompartmentSpec[] {
  const length = hull.lengthSegments * CELLS_PER_SEGMENT;
  const walls = new Map<number, number>();
  for (const bulkhead of hull.bulkheads ?? []) {
    const { at } = bulkhead;
    if (!Number.isInteger(at) || at < 1 || at > hull.lengthSegments - 1) {
      continue;
    }
    if (!walls.has(at)) walls.set(at, BULKHEAD_FRACTION[bulkhead.height]);
  }
  const boundaries = [...walls.keys()].sort((a, b) => a - b);

  const specs: CompartmentSpec[] = [];
  let fromX = 0;
  let bowWall = 1;
  for (const at of boundaries) {
    const toX = at * CELLS_PER_SEGMENT;
    const sternWall = walls.get(at) ?? 1;
    specs.push({ id: `c${specs.length}`, fromX, toX, bowWall, sternWall });
    fromX = toX;
    bowWall = sternWall;
  }
  specs.push({
    id: `c${specs.length}`,
    fromX,
    toX: length,
    bowWall,
    sternWall: 1,
  });
  return specs;
}

/**
 * Where the gash runs for an impact centred at `impactX`, clamped so the
 * whole gash stays inside a hull `length` cells long.
 */
export function gashOf(
  impactX: number,
  length: number
): { fromX: number; toX: number } {
  const half = GASH_LENGTH / 2;
  const centre = Math.min(Math.max(impactX, half), length - half);
  return { fromX: centre - half, toX: centre + half };
}

/** Ids of the compartments the gash overlaps (touching a wall doesn't count). */
export function openedBy(
  specs: readonly CompartmentSpec[],
  impactX: number,
  length: number
): string[] {
  const gash = gashOf(impactX, length);
  return specs
    .filter((spec) => spec.fromX < gash.toX && spec.toX > gash.fromX)
    .map((spec) => spec.id);
}
