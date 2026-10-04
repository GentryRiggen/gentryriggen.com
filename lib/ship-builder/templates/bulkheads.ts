import type { Bulkhead, BulkheadHeight } from "../model/types";

/** Walls on every segment boundary from `from` to `to`, all one height. */
export function wallRun(
  from: number,
  to: number,
  height: BulkheadHeight
): Bulkhead[] {
  const walls: Bulkhead[] = [];
  for (let at = from; at <= to; at++) walls.push({ at, height });
  return walls;
}

/**
 * Walls on boundaries 1 to `last`: those up to `lowUntil` only reach the
 * waterline, the rest reach the deck.
 */
export function wallsWithLowBow(last: number, lowUntil: number): Bulkhead[] {
  return [
    ...wallRun(1, lowUntil, "waterline"),
    ...wallRun(lowUntil + 1, last, "deck"),
  ];
}
