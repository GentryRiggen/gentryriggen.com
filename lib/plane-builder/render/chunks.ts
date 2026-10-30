import type { Obstacle } from "../levels/types";

/** Metres of course (along x) in one culling chunk. */
export const CHUNK_LENGTH = 150;

export interface ObstacleChunk {
  /** Chunk index along the course: floor(x / CHUNK_LENGTH). */
  index: number;
  items: Obstacle[];
}

/**
 * Splits obstacles into slices along the course (x). Each slice gets its own
 * instanced mesh and bounding sphere, so the renderer culls the slices that
 * are behind or beside the camera instead of drawing the whole level.
 */
export function chunkObstacles(
  items: readonly Obstacle[],
  chunkLength: number = CHUNK_LENGTH
): ObstacleChunk[] {
  const byIndex = new Map<number, Obstacle[]>();
  for (const o of items) {
    const index = Math.floor(o.center.x / chunkLength);
    const list = byIndex.get(index);
    if (list) list.push(o);
    else byIndex.set(index, [o]);
  }
  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, list]) => ({ index, items: list }));
}

/** The x range a chunk's obstacles can reach, including their half widths. */
export function chunkSpan(items: readonly Obstacle[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const o of items) {
    min = Math.min(min, o.center.x - o.half.x);
    max = Math.max(max, o.center.x + o.half.x);
  }
  return [min, max];
}

/**
 * Whether a chunk spanning minX..maxX is within `distance` metres of the
 * camera along the course (ahead or behind).
 */
export function isChunkInRange(
  minX: number,
  maxX: number,
  cameraX: number,
  distance: number
): boolean {
  return maxX >= cameraX - distance && minX <= cameraX + distance;
}
