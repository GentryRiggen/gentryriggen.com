import type { Obstacle } from "../../levels/types";
import {
  CHUNK_LENGTH,
  chunkObstacles,
  chunkSpan,
  isChunkInRange,
} from "../chunks";

function at(x: number, halfX = 1): Obstacle {
  return {
    kind: "tree",
    center: { x, y: 0, z: 0 },
    half: { x: halfX, y: 1, z: 1 },
    hard: false,
  };
}

describe("chunkObstacles", () => {
  it("keeps every obstacle exactly once, in course order", () => {
    const items = [
      at(CHUNK_LENGTH * 6 + 5),
      at(10),
      at(CHUNK_LENGTH + 5),
      at(12),
    ];
    const chunks = chunkObstacles(items);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 6]);
    expect(chunks.flatMap((c) => c.items)).toHaveLength(items.length);
    expect(chunks[0].items).toHaveLength(2);
  });

  it("puts obstacles on a boundary in the later chunk", () => {
    expect(chunkObstacles([at(CHUNK_LENGTH)])[0].index).toBe(1);
  });

  it("handles no obstacles and negative x", () => {
    expect(chunkObstacles([])).toEqual([]);
    expect(chunkObstacles([at(-5)])[0].index).toBe(-1);
  });
});

describe("chunkSpan and isChunkInRange", () => {
  it("covers obstacle widths", () => {
    expect(chunkSpan([at(10, 4), at(30, 2)])).toEqual([6, 32]);
  });

  it("is in range ahead and behind, out of range beyond the distance", () => {
    expect(isChunkInRange(100, 120, 0, 150)).toBe(true);
    expect(isChunkInRange(100, 120, 200, 150)).toBe(true);
    expect(isChunkInRange(100, 120, 0, 50)).toBe(false);
    expect(isChunkInRange(100, 120, 400, 150)).toBe(false);
  });
});
