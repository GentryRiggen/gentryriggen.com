import { REFERENCE_SHIPS, SHIP_KINDS } from "../kinds";
import {
  computeSpeed,
  DRIVETRAINS,
  computeStats,
  coverageLevel,
  TITANIC_REFERENCE,
} from "../stats";
import {
  HULL_ID,
  type BowShape,
  type PlacedPart,
  type SternShape,
} from "../types";
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

  it("counts crew berths without adding passengers", () => {
    const stats = computeStats(
      testShip([
        gridPart("a", "cabin-crew", 0, 0, 0),
        gridPart("b", "cabin-crew", 0, 1, 0),
      ])
    );
    expect(stats.crewBerths).toBe(120);
    expect(stats.passengers.total).toBe(0);
    expect(stats.peopleAboard).toBe(480);
  });

  it("warns until every crew member has a bed", () => {
    const find = (count: number) =>
      computeStats(
        testShip(
          Array.from({ length: count }, (_, x) =>
            gridPart(`q${x}`, "cabin-crew", 0, x, 0)
          )
        )
      ).warnings.find((w) => w.code === "crew-berths");
    expect(find(0)?.message).toBe("Crew need beds: 0 of 480");
    expect(find(7)?.message).toBe("Crew need beds: 420 of 480");
    expect(find(8)).toBeUndefined();
  });

  it("weighs crew quarters like other cabins", () => {
    const withCrew = computeStats(
      testShip([gridPart("a", "cabin-crew", 0, 0, 0)])
    );
    const withCabin = computeStats(
      testShip([gridPart("a", "cabin-1st", 0, 0, 0)])
    );
    expect(withCrew.stabilityRatio).toBe(withCabin.stabilityRatio);
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

  it("warns about bridge, funnels, lifeboats, crew beds in build order", () => {
    expect(computeStats(testShip()).warnings).toEqual([
      { code: "no-bridge", message: "No bridge — someone has to steer" },
      { code: "no-funnels", message: "No funnels — she isn't going anywhere" },
      {
        code: "lifeboats",
        message: "Lifeboats seat 0 of 480 aboard (480 short)",
      },
      { code: "crew-berths", message: "Crew need beds: 0 of 480" },
    ]);
  });

  it.each(["bridge-3", "bridge", "bridge-5", "bridge-6", "bridge-7"] as const)(
    "counts %s as a bridge for the warning",
    (type) => {
      const stats = computeStats(
        testShip([gridPart("br", type, 0, 1, 0)], 8, 7)
      );
      expect(stats.warnings.map((w) => w.code)).not.toContain("no-bridge");
    }
  );

  it("warns when top-heavy", () => {
    const len = 12;
    const parts = [0, 1, 2, 3].flatMap((level) => fillLevel(level, len));
    const codes = computeStats(testShip(parts, 4)).warnings.map((w) => w.code);
    expect(codes).toContain("top-heavy");
  });
});

describe("drivetrains", () => {
  it("keeps liners on 1910s steam figures", () => {
    expect(computeSpeed(8, 3, 20, 84924)).toBe(
      computeSpeed(8, 3, 20, 84924, 0, DRIVETRAINS.liner)
    );
  });

  it("lets modern kinds use more power per propeller and lose less to size", () => {
    const steam = computeSpeed(10, 2, 20, 180000, 0, DRIVETRAINS.liner);
    const modern = computeSpeed(10, 2, 20, 180000, 0, DRIVETRAINS.cruise);
    expect(modern).toBeGreaterThan(steam + 10);
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

describe("hull end speed modifiers", () => {
  const movingShip = (bow: BowShape, stern: SternShape) => {
    const parts = [0, 1, 2, 3].flatMap((i) => [
      gridPart(`d${i}`, "deck-1x1", 0, i * 3, 1),
      attachPart(`f${i}`, "funnel", `d${i}`, "funnel"),
    ]);
    parts.push(
      attachPart("p0", "propeller", HULL_ID, "prop:0"),
      attachPart("p1", "propeller", HULL_ID, "prop:1")
    );
    const ship = testShip(parts, 12);
    return { ...ship, hull: { ...ship.hull, bow, stern } };
  };
  const speed = (bow: BowShape, stern: SternShape) =>
    computeStats(movingShip(bow, stern)).topSpeedKnots;

  it("adds the bulbous, cruiser and icebreaker modifiers", () => {
    // The default hull makes 19.346 before rounding.
    expect(speed("straight", "counter")).toBe(19.3);
    expect(speed("bulbous", "counter")).toBe(20.3);
    expect(speed("straight", "cruiser")).toBe(19.8);
    expect(speed("icebreaker", "counter")).toBe(17.8);
    expect(speed("bulbous", "cruiser")).toBe(20.8);
  });

  it("leaves the other shapes cosmetic", () => {
    for (const bow of ["clipper"] as const) {
      expect(speed(bow, "counter")).toBe(19.3);
    }
    for (const stern of ["transom", "canoe"] as const) {
      expect(speed("straight", stern)).toBe(19.3);
    }
  });

  it("applies the modifier before the clamp", () => {
    // 14 + 8*1.5 + 20*0.25 = 31: clamps to 30 even with the icebreaker's -1.5.
    expect(computeSpeed(8, 4, 20, 0, -1.5)).toBe(29.5);
    expect(computeSpeed(8, 4, 20, 0, 1)).toBe(30);
    // The floor holds against a penalty too.
    expect(computeSpeed(1, 1, 4, 200000, -1.5)).toBe(8);
  });

  it("never gives a ship that can't move any speed", () => {
    expect(computeSpeed(0, 3, 12, 0, 1)).toBe(0);
    expect(computeSpeed(2, 0, 12, 0, 1)).toBe(0);
    const still = testShip();
    const bulbous = {
      ...still,
      hull: { ...still.hull, bow: "bulbous" as const },
    };
    expect(computeStats(bulbous).topSpeedKnots).toBe(0);
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

describe("REFERENCE_SHIPS", () => {
  it("keeps the liner figures in step with the Titanic", () => {
    const figures = Object.fromEntries(
      REFERENCE_SHIPS.liner.figures.map((f) => [f.metric, f.value])
    );
    expect(figures).toEqual({
      tonnage: TITANIC_REFERENCE.grossTonnage,
      speed: TITANIC_REFERENCE.topSpeedKnots,
      seats: TITANIC_REFERENCE.lifeboatSeats,
      people: TITANIC_REFERENCE.peopleAboard,
    });
  });

  it("has comparable figures for every kind", () => {
    for (const kind of SHIP_KINDS) {
      expect(REFERENCE_SHIPS[kind].figures.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("checks", () => {
  const codes = (ship: ReturnType<typeof testShip>) =>
    computeStats(ship).checks.map((c) => c.code);
  const failing = (ship: ReturnType<typeof testShip>) =>
    computeStats(ship)
      .checks.filter((c) => !c.ok)
      .map((c) => c.code);

  it("lists the always-applicable goals for a blank ship, all failing", () => {
    const { checks } = computeStats(testShip());
    expect(checks.map((c) => c.code)).toEqual([
      "no-bridge",
      "no-funnels",
      "lifeboats",
      "crew-berths",
      "top-heavy",
    ]);
    expect(checks.filter((c) => !c.ok)).toHaveLength(4);
    expect(checks.find((c) => c.code === "top-heavy")).toEqual({
      code: "top-heavy",
      label: "Stays upright",
      ok: true,
    });
  });

  it("gives a failing check today's warning message as its detail", () => {
    const bridge = computeStats(testShip()).checks[0];
    expect(bridge).toEqual({
      code: "no-bridge",
      label: "Bridge to steer from",
      ok: false,
      detail: "No bridge — someone has to steer",
    });
  });

  it("passes a check with a positive label and no detail", () => {
    const stats = computeStats(testShip([gridPart("br", "bridge", 0, 1, 0)]));
    expect(stats.checks[0]).toEqual({
      code: "no-bridge",
      label: "Bridge to steer from",
      ok: true,
    });
  });

  it("maps every warning to exactly one failing check, in order", () => {
    const ships = [
      testShip(),
      testShip([attachPart("p", "propeller", HULL_ID, "prop:0")]),
      testShip([gridPart("br", "bridge", 0, 1, 0)]),
      testShip(
        [0, 1, 2, 3].flatMap((level) => fillLevel(level, 12)),
        4
      ),
    ];
    for (const ship of ships) {
      const stats = computeStats(ship);
      expect(stats.warnings.map((w) => w.code)).toEqual(failing(ship));
      expect(stats.warnings.map((w) => w.message)).toEqual(
        stats.checks.filter((c) => !c.ok).map((c) => c.detail)
      );
    }
  });

  it("only checks propellers, power match and rudder when they apply", () => {
    expect(codes(testShip())).not.toContain("no-propellers");
    expect(codes(testShip())).not.toContain("needs-propellers");
    expect(codes(testShip())).not.toContain("no-rudder");

    const propeller = attachPart("p", "propeller", HULL_ID, "prop:0");
    const withProp = testShip([propeller]);
    expect(codes(withProp)).toContain("no-propellers");
    expect(failing(withProp)).not.toContain("no-propellers");
    expect(codes(withProp)).not.toContain("needs-propellers");
    expect(failing(withProp)).toContain("no-rudder");
  });

  it("uses the kind's drivetrain for the propeller power match", () => {
    const parts = [
      gridPart("a", "deck-1x1", 0, 4, 1),
      gridPart("b", "deck-1x1", 0, 7, 0),
      attachPart("f", "funnel-large", "a", "funnel-lg:4:1"),
      attachPart("f2", "funnel", "b", "funnel"),
      attachPart("p", "propeller", HULL_ID, "prop:0"),
    ];
    const liner = testShip(parts);
    const cruise = { ...liner, kind: "cruise" as const };
    expect(failing(liner)).toContain("needs-propellers");
    expect(failing(cruise)).not.toContain("needs-propellers");
  });

  it("passes a stable ship's stability check and fails a top-heavy one", () => {
    const tall = testShip(
      [0, 1, 2, 3].flatMap((level) => fillLevel(level, 12)),
      4
    );
    expect(failing(tall)).toContain("top-heavy");
    expect(failing(testShip())).not.toContain("top-heavy");
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

  it("warns when there are propellers but no rudder", () => {
    const propeller = attachPart("p", "propeller", HULL_ID, "prop:0");
    const noRudder = computeStats(testShip([propeller])).warnings.find(
      (w) => w.code === "no-rudder"
    );
    expect(noRudder?.message).toBe("No rudder — she can't steer");
    const withRudder = [
      propeller,
      attachPart("r", "rudder", HULL_ID, "rudder"),
    ];
    expect(codes(withRudder)).not.toContain("no-rudder");
  });

  it("stays quiet about the rudder with no propellers", () => {
    expect(codes([])).not.toContain("no-rudder");
    expect(codes([attachPart("r", "rudder", HULL_ID, "rudder")])).not.toContain(
      "no-rudder"
    );
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

describe("watertightCompartments", () => {
  it("is one for a ship with no walls", () => {
    expect(computeStats(testShip()).watertightCompartments).toBe(1);
  });

  it("is one more than the number of walls and leaves stability alone", () => {
    const ship = testShip();
    const walled = {
      ...ship,
      hull: {
        ...ship.hull,
        bulkheads: [
          { at: 2, height: "low" as const },
          { at: 5, height: "deck" as const },
        ],
      },
    };
    const stats = computeStats(walled);
    expect(stats.watertightCompartments).toBe(3);
    expect(stats.stabilityRatio).toBe(computeStats(ship).stabilityRatio);
  });
});
