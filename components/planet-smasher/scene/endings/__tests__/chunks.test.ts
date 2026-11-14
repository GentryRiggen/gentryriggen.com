import { SphereGeometry } from "three";
import {
  CHUNK_COUNT,
  assignChunks,
  buildChunkGeometries,
  fibonacciSeeds,
} from "../chunks";

describe("fibonacciSeeds", () => {
  it("returns unit vectors, the same for the same seed", () => {
    const a = fibonacciSeeds(24, 0.2, 1);
    expect(a).toHaveLength(24);
    for (const s of a) {
      expect(Math.hypot(s.x, s.y, s.z)).toBeCloseTo(1, 5);
    }
    expect(fibonacciSeeds(24, 0.2, 1)).toEqual(a);
    expect(fibonacciSeeds(24, 0.2, 2)).not.toEqual(a);
  });
});

describe("chunks", () => {
  const seeds = fibonacciSeeds(CHUNK_COUNT, 0.2, 1);
  const base = new SphereGeometry(1, 96, 48).toNonIndexed();
  const positions = base.attributes.position.array as Float32Array;

  it("assigns every triangle a chunk and uses every chunk", () => {
    const ids = assignChunks(positions, seeds);
    expect(ids).toHaveLength(positions.length / 9);
    const used = new Set<number>();
    for (const id of ids) {
      expect(id).toBeLessThan(CHUNK_COUNT);
      used.add(id);
    }
    expect(used.size).toBe(CHUNK_COUNT);
  });

  it("builds one solid geometry per chunk", () => {
    const geos = buildChunkGeometries(1, seeds);
    expect(geos).toHaveLength(CHUNK_COUNT);
    for (const g of geos) {
      expect(g.attributes.position.count).toBeGreaterThan(0);
      // Two groups: the planet surface, then the inner faces.
      expect(g.groups).toHaveLength(2);
      expect(g.groups[1].count).toBeGreaterThan(0);
    }
  });
});
