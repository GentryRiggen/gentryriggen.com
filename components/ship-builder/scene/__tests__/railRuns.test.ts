import type { Occupancy } from "@/lib/ship-builder/model/grid";
import type { PlacedPart } from "@/lib/ship-builder/model/types";
import {
  pathLength,
  pointAlong,
  railPaths,
  railRuns,
  stanchionOffsets,
} from "../railRuns";

describe("railPaths", () => {
  const plan = {
    lengthCells: 6,
    beam: 3,
    bow: "straight",
    stern: "counter",
  } as const;

  it("joins both sides round the bow and stern into one closed rail", () => {
    const paths = railPaths(
      [
        { start: 0, end: 6, side: 1 },
        { start: 0, end: 6, side: -1 },
      ],
      plan,
      0.05
    );
    expect(paths).toHaveLength(1);
    expect(paths[0].isClosed).toBe(true);
    expect(paths[0].points.flat().every(Number.isFinite)).toBe(true);
  });

  it("keeps a mid-ship run on its edge, inset from the hull", () => {
    const [path] = railPaths([{ start: 2, end: 4, side: 1 }], plan, 0.05);
    expect(path.points).toEqual([
      [1, 1.45],
      [-1, 1.45],
    ]);
  });

  it("carries a run that reaches the bow round to the tip", () => {
    const [path] = railPaths([{ start: 0, end: 3, side: -1 }], plan, 0.05);
    expect(path.points[0][1]).toBeCloseTo(0);
    expect(path.points[0][0]).toBeGreaterThan(3);
  });
});

describe("pointAlong", () => {
  it("walks the route by distance", () => {
    const route: [number, number][] = [
      [0, 0],
      [2, 0],
      [2, 2],
    ];
    expect(pathLength(route, false)).toBe(4);
    expect(pointAlong(route, 3, false)).toEqual([2, 1]);
  });
});

const part: PlacedPart = {
  id: "b",
  type: "deck-1x1",
  anchor: { kind: "grid", level: 0, x: 0, z: 0 },
  rotation: 0,
};
const decor: PlacedPart = { ...part, id: "c", type: "deckchair" };

function occupy(...keys: string[]): Occupancy {
  return new Map(keys.map((key) => [key, part]));
}

describe("railRuns", () => {
  it("covers the whole edge when it is empty", () => {
    expect(railRuns(occupy(), 6, 0)).toEqual([{ start: 0, end: 6 }]);
  });

  it("splits runs around blocks on the edge cell", () => {
    expect(railRuns(occupy("0:2:0", "0:3:0"), 6, 0)).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 6 },
    ]);
  });

  it("ignores blocks on other levels and other rows", () => {
    expect(railRuns(occupy("1:2:0", "0:2:1"), 4, 0)).toEqual([
      { start: 0, end: 4 },
    ]);
  });

  it("keeps the rail behind decor on an edge cell", () => {
    const occupancy: Occupancy = new Map([["0:2:0", decor]]);
    expect(railRuns(occupancy, 4, 0)).toEqual([{ start: 0, end: 4 }]);
  });

  it("returns nothing when every edge cell is covered", () => {
    expect(railRuns(occupy("0:0:3", "0:1:3"), 2, 3)).toEqual([]);
  });
});

describe("stanchionOffsets", () => {
  it("places posts at both ends, no further apart than the spacing", () => {
    const offsets = stanchionOffsets(2, 0.5);
    expect(offsets[0]).toBe(0);
    expect(offsets[offsets.length - 1]).toBe(2);
    expect(offsets).toHaveLength(5);
  });

  it("still gives a short run two posts", () => {
    expect(stanchionOffsets(0.2, 0.5)).toEqual([0, 0.2]);
  });
});
