import {
  cellKey,
  isDecor,
  type Occupancy,
} from "@/lib/ship-builder/model/grid";

/** A stretch of rail over cells [start, end) along the hull's length. */
export interface RailRun {
  start: number;
  end: number;
}

/**
 * Merges consecutive edge cells with no level-0 block into runs. `edgeZ` is the
 * model z of the edge cell (0, or beam - 1).
 */
export function railRuns(
  occupancy: Occupancy,
  lengthCells: number,
  edgeZ: number
): RailRun[] {
  const runs: RailRun[] = [];
  let start: number | null = null;
  for (let x = 0; x <= lengthCells; x++) {
    const occupant = occupancy.get(cellKey({ level: 0, x, z: edgeZ }));
    const isOpen = x < lengthCells && (!occupant || isDecor(occupant));
    if (isOpen && start === null) start = x;
    if (!isOpen && start !== null) {
      runs.push({ start, end: x });
      start = null;
    }
  }
  return runs;
}

/** Stanchion offsets from a run's start, at most `spacing` apart. */
export function stanchionOffsets(length: number, spacing: number): number[] {
  const gaps = Math.max(1, Math.ceil(length / spacing));
  return Array.from({ length: gaps + 1 }, (_, i) => (i * length) / gaps);
}
