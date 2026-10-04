import type { Hull } from "../../model/types";
import { compartmentSpecsOf, gashOf, openedBy } from "../compartments";
import { formatStoryTime, storyMinutes } from "../story";

function hull(bulkheads?: Hull["bulkheads"]): Hull {
  return {
    lengthSegments: 6,
    beam: 4,
    bow: "straight",
    stern: "counter",
    bulkheads,
  };
}

describe("compartmentSpecsOf", () => {
  it("is one sealed compartment without bulkheads", () => {
    expect(compartmentSpecsOf(hull())).toEqual([
      { id: "c0", fromX: 0, toX: 18, bowWall: 1, sternWall: 1 },
    ]);
  });

  it("splits at each bulkhead, bow first, with its height", () => {
    const specs = compartmentSpecsOf(
      hull([
        { at: 4, height: "deck" },
        { at: 2, height: "low" },
      ])
    );
    expect(specs).toEqual([
      { id: "c0", fromX: 0, toX: 6, bowWall: 1, sternWall: 0.45 },
      { id: "c1", fromX: 6, toX: 12, bowWall: 0.45, sternWall: 1 },
      { id: "c2", fromX: 12, toX: 18, bowWall: 1, sternWall: 1 },
    ]);
  });

  it("ignores walls outside the hull and doubles", () => {
    const specs = compartmentSpecsOf(
      hull([
        { at: 0, height: "deck" },
        { at: 6, height: "deck" },
        { at: 3, height: "waterline" },
        { at: 3, height: "low" },
      ])
    );
    expect(specs.map((s) => [s.fromX, s.toX, s.sternWall])).toEqual([
      [0, 9, 0.75],
      [9, 18, 1],
    ]);
  });
});

describe("gash", () => {
  it("is centred on the impact and clamped inside the hull", () => {
    expect(gashOf(9, 18)).toEqual({ fromX: 6, toX: 12 });
    expect(gashOf(0, 18)).toEqual({ fromX: 0, toX: 6 });
    expect(gashOf(18, 18)).toEqual({ fromX: 12, toX: 18 });
  });

  it("opens every compartment it overlaps", () => {
    const specs = compartmentSpecsOf(
      hull([
        { at: 1, height: "deck" },
        { at: 2, height: "deck" },
        { at: 3, height: "deck" },
        { at: 4, height: "deck" },
        { at: 5, height: "deck" },
      ])
    );
    // Gash 6..12 lines up with walls: exactly two compartments.
    expect(openedBy(specs, 9, 18)).toEqual(["c2", "c3"]);
    // Off the walls it spans three.
    expect(openedBy(specs, 8, 18)).toEqual(["c1", "c2", "c3"]);
  });
});

describe("story time", () => {
  it("scales sim seconds to whole story minutes", () => {
    expect(storyMinutes(0)).toBe(0);
    expect(storyMinutes(10)).toBe(50);
  });

  it("formats hours and minutes in plain words", () => {
    expect(formatStoryTime(160)).toBe("2 hours 40 minutes");
    expect(formatStoryTime(60)).toBe("1 hour");
    expect(formatStoryTime(61)).toBe("1 hour 1 minute");
    expect(formatStoryTime(35)).toBe("35 minutes");
    expect(formatStoryTime(0)).toBe("0 minutes");
  });
});
