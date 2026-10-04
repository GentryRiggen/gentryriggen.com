import { cleanBulkheads, cycleBulkhead } from "../bulkheads";
import { setHullSize } from "../placement";
import type { Hull, Ship } from "../types";

function ship(bulkheads?: Hull["bulkheads"]): Ship {
  return {
    v: 6,
    kind: "liner",
    name: "Test",
    hull: {
      lengthSegments: 6,
      beam: 4,
      bow: "straight",
      stern: "counter",
      bulkheads,
    },
    parts: [],
  };
}

describe("cycleBulkhead", () => {
  it("steps none → low → waterline → deck → none", () => {
    let s = ship();
    const heights: (string | undefined)[] = [];
    for (let i = 0; i < 4; i += 1) {
      s = cycleBulkhead(s, 2);
      heights.push(s.hull.bulkheads?.[0]?.height);
    }
    expect(heights).toEqual(["low", "waterline", "deck", undefined]);
    expect(s.hull).not.toHaveProperty("bulkheads");
  });

  it("keeps the list sorted bow first", () => {
    const s = cycleBulkhead(cycleBulkhead(ship(), 4), 1);
    expect(s.hull.bulkheads?.map((b) => b.at)).toEqual([1, 4]);
  });

  it("ignores boundaries outside the hull", () => {
    const s = ship();
    expect(cycleBulkhead(s, 0)).toBe(s);
    expect(cycleBulkhead(s, 6)).toBe(s);
  });
});

describe("cleanBulkheads", () => {
  it("drops walls outside the hull and doubles, and sorts", () => {
    const { hull } = ship([
      { at: 5, height: "deck" },
      { at: 9, height: "deck" },
      { at: 2, height: "low" },
      { at: 2, height: "deck" },
      { at: 1.5, height: "deck" },
    ]);
    expect(cleanBulkheads(hull).bulkheads).toEqual([
      { at: 2, height: "low" },
      { at: 5, height: "deck" },
    ]);
  });

  it("removes an empty list", () => {
    expect(cleanBulkheads(ship([]).hull)).not.toHaveProperty("bulkheads");
  });
});

describe("resizing the hull", () => {
  it("drops walls past the new stern", () => {
    const s = ship([
      { at: 2, height: "deck" },
      { at: 5, height: "deck" },
    ]);
    const shorter = setHullSize(s, { lengthSegments: 5 });
    expect(shorter.hull.bulkheads).toEqual([{ at: 2, height: "deck" }]);
  });
});
