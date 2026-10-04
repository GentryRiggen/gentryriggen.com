import type { Bulkhead, BulkheadHeight, Hull, Ship } from "./types";

/** Tapping a wall slot steps through these; after `deck` the wall goes. */
const NEXT_HEIGHT: Record<BulkheadHeight, BulkheadHeight | null> = {
  low: "waterline",
  waterline: "deck",
  deck: null,
};

/**
 * The hull with only valid bulkheads: inside the hull, one per boundary (the
 * first wins), sorted bow first. No bulkheads at all leaves the field off.
 */
export function cleanBulkheads(hull: Hull): Hull {
  const { bulkheads, ...rest } = hull;
  if (!bulkheads) return hull;
  const seen = new Set<number>();
  const kept: Bulkhead[] = [];
  for (const bulkhead of bulkheads) {
    const { at } = bulkhead;
    if (!Number.isInteger(at) || at < 1 || at > hull.lengthSegments - 1) {
      continue;
    }
    if (seen.has(at)) continue;
    seen.add(at);
    kept.push({ at, height: bulkhead.height });
  }
  kept.sort((a, b) => a.at - b.at);
  return kept.length > 0 ? { ...rest, bulkheads: kept } : rest;
}

/** The bulkhead on this segment boundary, if any. */
export function bulkheadAt(hull: Hull, at: number): Bulkhead | undefined {
  return hull.bulkheads?.find((bulkhead) => bulkhead.at === at);
}

/**
 * One tap on a wall slot: none → low → waterline → deck → none. A boundary
 * outside the hull leaves the ship unchanged.
 */
export function cycleBulkhead(ship: Ship, at: number): Ship {
  const { hull } = ship;
  if (!Number.isInteger(at) || at < 1 || at > hull.lengthSegments - 1) {
    return ship;
  }
  const current = bulkheadAt(hull, at);
  const others = (hull.bulkheads ?? []).filter((b) => b.at !== at);
  const height = current ? NEXT_HEIGHT[current.height] : "low";
  const bulkheads = height ? [...others, { at, height }] : others;
  return { ...ship, hull: cleanBulkheads({ ...hull, bulkheads }) };
}
