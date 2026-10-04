import type { Occupancy } from "@/lib/ship-builder/model/grid";
import type { PlacedPart } from "@/lib/ship-builder/model/types";
import { railRuns, stanchionOffsets } from "../railRuns";

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
