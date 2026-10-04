import { cellKey, isInsideHull, parseCellKey, type Occupancy } from "./grid";
import type { Cell, Ship } from "./types";

/** How many steps sideways a cell may be from a grounded cell. */
export const MAX_OVERHANG = 2;

/** Cell key → steps to the nearest grounded cell. Unreachable cells are absent. */
export type SupportMap = Map<string, number>;

const NEIGHBOUR_STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The four same-level neighbours of a cell. */
export function neighbours(cell: Cell): Cell[] {
  return NEIGHBOUR_STEPS.map(([dx, dz]) => ({
    level: cell.level,
    x: cell.x + dx,
    z: cell.z + dz,
  }));
}

function isGroundedBy(
  ship: Ship,
  isOccupied: (key: string) => boolean,
  cell: Cell
): boolean {
  if (cell.level === 0) return isInsideHull(ship, cell);
  return isOccupied(cellKey({ ...cell, level: cell.level - 1 }));
}

/**
 * A cell is grounded when a part sits directly below it, or it's a level-0
 * cell over the hull (wing cells at level 0 have nothing beneath them).
 */
export function isGrounded(
  ship: Ship,
  occupancy: Occupancy,
  cell: Cell
): boolean {
  return isGroundedBy(ship, (key) => occupancy.has(key), cell);
}

/**
 * Multi-source BFS from every grounded occupied cell, walking 4-neighbour
 * through occupied cells on the same level.
 */
export function supportMap(ship: Ship, occupancy: Occupancy): SupportMap {
  const distances: SupportMap = new Map();
  const queue: Cell[] = [];
  for (const key of occupancy.keys()) {
    const cell = parseCellKey(key);
    if (isGrounded(ship, occupancy, cell)) {
      distances.set(key, 0);
      queue.push(cell);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const next = distances.get(cellKey(cell))! + 1;
    for (const neighbour of neighbours(cell)) {
      const key = cellKey(neighbour);
      if (occupancy.has(key) && !distances.has(key)) {
        distances.set(key, next);
        queue.push(neighbour);
      }
    }
  }
  return distances;
}

/**
 * Steps from one cell to the nearest grounded cell, searching no further than
 * `maxSteps`; Infinity when none is that close. Equivalent to the cell's
 * supportMap entry for answers up to `maxSteps`, at a cost independent of
 * the ship's size. `isOccupied` lets callers include a candidate's cells.
 */
export function stepsToSupport(
  ship: Ship,
  isOccupied: (key: string) => boolean,
  start: Cell,
  maxSteps: number
): number {
  const seen = new Set([cellKey(start)]);
  let frontier = [start];
  for (let steps = 0; steps <= maxSteps; steps++) {
    if (frontier.some((cell) => isGroundedBy(ship, isOccupied, cell))) {
      return steps;
    }
    const next: Cell[] = [];
    for (const cell of frontier) {
      for (const neighbour of neighbours(cell)) {
        const key = cellKey(neighbour);
        if (seen.has(key) || !isOccupied(key)) continue;
        seen.add(key);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return Infinity;
}
