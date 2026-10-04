import {
  computeSpeed,
  computeStats,
  coverageLevel,
  TITANIC_REFERENCE,
} from "../stats";
import type { PlacedPart } from "../types";
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
    const stats = computeStats(testShip(parts, 12));
    expect(stats.crew).toBe(12 * 60 + 4 * 40);
    expect(stats.grossTonnage).toBe((576 + 4) * 63);
    // 14 + 4*2.2 + 12*0.25 - 36540/10000 = 22.146
    expect(stats.topSpeedKnots).toBe(22.1);
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
    // 14 + 6*2.2 + 12*0.25 = 30.2 before tonnage loss
    expect(computeSpeed(6, 12, 0)).toBe(30);
    // 14 + 2.2 + 4*0.25 - 20 = -2.8
    expect(computeSpeed(1, 4, 200000)).toBe(8);
  });

  it("is 0 with no funnels", () => {
    expect(computeSpeed(0, 12, 0)).toBe(0);
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
