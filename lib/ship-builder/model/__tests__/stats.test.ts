import {
  computeSpeed,
  computeStats,
  coverageLevel,
  TITANIC_REFERENCE,
} from "../stats";
import { HULL_ID, type PlacedPart } from "../types";
import { validateShip } from "../placement";
import { attachPart, gridPart, testShip } from "../../testing";

function fillLevel(level: number, lengthCells: number, beam = 4): PlacedPart[] {
  const parts: PlacedPart[] = [];
  for (let x = 0; x < lengthCells; x++) {
    for (let z = 0; z < beam; z++) {
      parts.push(gridPart(`L${level}-${x}-${z}`, "deck-1x1", level, x, z));
    }
  }
  return parts;
}

describe("computeStats", () => {
  it("reports an empty 8-segment hull", () => {
    const stats = computeStats(testShip());
    expect(stats.passengers).toEqual({
      first: 0,
      second: 0,
      third: 0,
      total: 0,
    });
    expect(stats.crew).toBe(480);
    expect(stats.peopleAboard).toBe(480);
    expect(stats.lifeboats).toBe(0);
    expect(stats.lifeboatSeats).toBe(0);
    expect(stats.coverage).toBe(0);
    expect(stats.coverageLevel).toBe("red");
    expect(stats.grossTonnage).toBe(24192);
    expect(stats.topSpeedKnots).toBe(0);
    expect(stats.stability).toBe("Stable");
  });

  it("counts passengers per cabin class", () => {
    const stats = computeStats(
      testShip([
        gridPart("a", "cabin-1st", 0, 0, 0),
        gridPart("b", "cabin-2nd", 0, 1, 0),
        gridPart("c", "cabin-3rd", 0, 2, 0),
        gridPart("d", "cabin-3rd", 0, 3, 0),
      ])
    );
    expect(stats.passengers).toEqual({
      first: 30,
      second: 50,
      third: 240,
      total: 320,
    });
    expect(stats.peopleAboard).toBe(800);
  });

  it("adds stokers per funnel and computes speed", () => {
    const parts = [0, 1, 2, 3].flatMap((i) => [
      gridPart(`d${i}`, "deck-1x1", 0, i * 3, 1),
      attachPart(`f${i}`, "funnel", `d${i}`, "funnel"),
    ]);
    parts.push(
      attachPart("p0", "propeller", HULL_ID, "prop:0"),
      attachPart("p1", "propeller", HULL_ID, "prop:1")
    );
    const stats = computeStats(testShip(parts, 12));
    expect(stats.crew).toBe(12 * 60 + 4 * 40);
    expect(stats.grossTonnage).toBe((576 + 4) * 63);
    // power 4, 2 props use 4: 14 + 4*1.5 + 12*0.25 - 36540/10000 = 19.346
    expect(stats.topSpeedKnots).toBe(19.3);
  });

  it("formats people counts with thousands separators in the warning", () => {
    const cabins = Array.from({ length: 9 }, (_, x) =>
      gridPart(`c${x}`, "cabin-3rd", 0, x, 0)
    );
    const stats = computeStats(testShip(cabins));
    expect(stats.peopleAboard).toBe(480 + 1080);
    const lifeboats = stats.warnings.find((w) => w.code === "lifeboats");
    expect(lifeboats?.message).toContain("of 1,560 aboard");
  });

  it("sums lifeboat seats and coverage", () => {
    const stats = computeStats(
      testShip([
        gridPart("a", "deck-1x1", 0, 2, 0),
        gridPart("b", "deck-1x1", 1, 2, 0),
        attachPart("dv", "davit", "b", "davit:2:0"),
        attachPart("lb", "lifeboat-standard", "dv", "boat"),
        gridPart("c", "deck-1x1", 0, 3, 0),
        gridPart("e", "deck-1x1", 1, 3, 0),
        attachPart("dv2", "davit", "e", "davit:3:0"),
        attachPart("lb2", "lifeboat-collapsible", "dv2", "boat"),
      ])
    );
    expect(stats.lifeboats).toBe(2);
    expect(stats.lifeboatSeats).toBe(112);
    expect(stats.coverage).toBeCloseTo(112 / 480);
  });

  it("classifies stability by center of mass vs beam", () => {
    const len = 12; // 4 segments
    const two = [...fillLevel(0, len), ...fillLevel(1, len)];
    const three = [...two, ...fillLevel(2, len)];
    const four = [...three, ...fillLevel(3, len)];
    expect(computeStats(testShip(two, 4)).stability).toBe("Stable");
    expect(computeStats(testShip(three, 4)).stability).toBe("Top-heavy");
    expect(computeStats(testShip(four, 4)).stability).toBe("Dangerous");
  });

  it("scales an empty hull's tonnage with the beam", () => {
    expect(computeStats(testShip([], 8, 3)).grossTonnage).toBe(18144);
    expect(computeStats(testShip([], 8, 4)).grossTonnage).toBe(24192);
    expect(computeStats(testShip([], 8, 7)).grossTonnage).toBe(42336);
  });

  it("finds the same blocks less stable on a narrow beam", () => {
    const blocks = [0, 1, 2].flatMap((level) => fillLevel(level, 12, 3));
    const narrow = computeStats(testShip(blocks, 4, 3));
    const wide = computeStats(testShip(blocks, 4, 7));
    expect(narrow.stabilityRatio).toBeGreaterThan(wide.stabilityRatio);
    expect(narrow.stability).toBe("Top-heavy");
    expect(wide.stability).toBe("Stable");
  });

  it("warns about lifeboats, bridge, funnels in order", () => {
    expect(computeStats(testShip()).warnings).toEqual([
      {
        code: "lifeboats",
        message: "Lifeboats seat 0 of 480 aboard (480 short)",
      },
      { code: "no-bridge", message: "No bridge — someone has to steer" },
      { code: "no-funnels", message: "No funnels — she isn't going anywhere" },
    ]);
  });

  it("warns when top-heavy", () => {
    const len = 12;
    const parts = [0, 1, 2, 3].flatMap((level) => fillLevel(level, len));
    const codes = computeStats(testShip(parts, 4)).warnings.map((w) => w.code);
    expect(codes).toContain("top-heavy");
  });
});

describe("computeSpeed", () => {
  it("clamps to the sane range", () => {
    // 14 + 8*1.5 + 20*0.25 = 31 before tonnage loss
    expect(computeSpeed(8, 4, 20, 0)).toBe(30);
    // 14 + 1.5 + 4*0.25 - 20 = -3.5
    expect(computeSpeed(1, 1, 4, 200000)).toBe(8);
  });

  it("is 0 with no funnels or no propellers", () => {
    expect(computeSpeed(0, 3, 12, 0)).toBe(0);
    expect(computeSpeed(2, 0, 12, 0)).toBe(0);
  });

  it("counts only the power the propellers can use", () => {
    expect(computeSpeed(4, 1, 8, 0)).toBe(computeSpeed(2, 1, 8, 0));
    expect(computeSpeed(4, 1, 8, 0)).toBeLessThan(computeSpeed(4, 2, 8, 0));
  });
});

describe("coverageLevel", () => {
  it("uses red / amber / green thresholds", () => {
    expect(coverageLevel(0.49)).toBe("red");
    expect(coverageLevel(0.5)).toBe("amber");
    expect(coverageLevel(0.99)).toBe("amber");
    expect(coverageLevel(1)).toBe("green");
  });
});

describe("TITANIC_REFERENCE", () => {
  it("matches the historical figures", () => {
    expect(TITANIC_REFERENCE).toEqual({
      grossTonnage: 46328,
      topSpeedKnots: 21,
      lifeboats: 20,
      lifeboatSeats: 1178,
      peopleAboard: 2224,
    });
  });
});

describe("propulsion", () => {
  const deckAt = (id: string, x: number, z: number) =>
    gridPart(id, "deck-1x1", 0, x, z);
  const square = (id: string, x: number): PlacedPart[] => [
    deckAt(`${id}a`, x, 1),
    deckAt(`${id}b`, x + 1, 1),
    deckAt(`${id}c`, x, 2),
    deckAt(`${id}d`, x + 1, 2),
  ];
  const codes = (parts: PlacedPart[]) =>
    computeStats(testShip(parts)).warnings.map((w) => w.code);

  it("has no speed without propellers, and warns", () => {
    const parts = [
      ...square("s", 4),
      attachPart("f", "funnel", "sa", "funnel"),
    ];
    const stats = computeStats(testShip(parts));
    expect(stats.topSpeedKnots).toBe(0);
    expect(codes(parts)).toContain("no-propellers");
    expect(codes(parts)).not.toContain("no-funnels");
  });

  it("has no speed without funnels", () => {
    const parts = [attachPart("p", "propeller", HULL_ID, "prop:0")];
    expect(computeStats(testShip(parts)).topSpeedKnots).toBe(0);
    expect(codes(parts)).toContain("no-funnels");
    expect(codes(parts)).not.toContain("no-propellers");
  });

  it("warns when funnels out-power the propellers", () => {
    const parts = [
      ...square("s", 4),
      attachPart("f", "funnel-large", "sa", "funnel-lg:4:1"),
      deckAt("e", 7, 0),
      attachPart("f2", "funnel", "e", "funnel"),
      attachPart("p", "propeller", HULL_ID, "prop:0"),
    ];
    // power 3 > 1 propeller * 2
    expect(codes(parts)).toContain("needs-propellers");
    expect(codes(parts)).not.toContain("no-propellers");
    const enough = [...parts, attachPart("p2", "propeller", HULL_ID, "prop:1")];
    expect(codes(enough)).not.toContain("needs-propellers");
  });

  it("counts a large funnel as two power and 75 stokers", () => {
    const parts = [
      ...square("s", 4),
      attachPart("f", "funnel-large", "sa", "funnel-lg:4:1"),
      attachPart("p", "propeller", HULL_ID, "prop:0"),
    ];
    const stats = computeStats(testShip(parts));
    expect(stats.crew).toBe(8 * 60 + 75);
    expect(stats.topSpeedKnots).toBeGreaterThan(0);
  });

  it("counts a large lifeboat's 150 seats", () => {
    const parts = [
      gridPart("a2", "deck-1x1", 0, 2, 0),
      gridPart("a3", "deck-1x1", 0, 3, 0),
      gridPart("b2", "deck-1x1", 1, 2, 0),
      gridPart("b3", "deck-1x1", 1, 3, 0),
      attachPart("dv2", "davit", "b2", "davit:2:0"),
      attachPart("dv3", "davit", "b3", "davit:3:0"),
      attachPart("big", "lifeboat-large", "dv2", "big-boat"),
    ];
    const stats = computeStats(testShip(parts));
    expect(stats.lifeboats).toBe(1);
    expect(stats.lifeboatSeats).toBe(150);
  });

  it("puts a Titanic-like ship near 21 knots", () => {
    // 20 segments, beam 4, a two-level superstructure, three large funnels
    // on deck blocks and three propellers.
    const parts: PlacedPart[] = [];
    for (let level = 0; level <= 1; level++) {
      for (let x = 6; x < 42; x++) {
        for (let z = 0; z < 4; z++) {
          parts.push(gridPart(`L${level}-${x}-${z}`, "deck-1x1", level, x, z));
        }
      }
    }
    for (const x of [10, 20, 30]) {
      parts.push(
        attachPart(`f${x}`, "funnel-large", `L1-${x}-0`, `funnel-lg:${x}:0`)
      );
    }
    for (let i = 0; i < 3; i++) {
      parts.push(attachPart(`p${i}`, "propeller", HULL_ID, `prop:${i}`));
    }
    const ship = testShip(parts, 20, 4);
    expect(validateShip(ship)).toEqual({ ok: true });
    const { topSpeedKnots } = computeStats(ship);
    expect(topSpeedKnots).toBeGreaterThanOrEqual(19);
    expect(topSpeedKnots).toBeLessThanOrEqual(23);
  });
});
