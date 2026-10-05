import { CELLS_PER_SEGMENT } from "../../model/grid";
import { computeStats } from "../../model/stats";
import type { Ship } from "../../model/types";
import { findTemplate } from "../../templates";
import {
  ALWAYS_BREAK_PITCH,
  BOW_FINAL_PITCH,
  HALF_UNDER_DEPTH,
  HULL_STRENGTH,
  NO_WALLS_BREAK_FRACTION,
  REF_LENGTH,
  STERN_FINAL_PITCH,
  STERN_HANG_S,
  STERN_RISE_S,
  STERN_SETTLE_S,
  breakPositionOf,
  bowSpan,
  shallowestDepth,
  sternSpan,
  strainOf,
  strengthFor,
} from "../breakup";
import { compartmentSpecsOf } from "../compartments";
import { PLUNGE_DEPTH, PLUNGE_PITCH } from "../flooding";
import { createTrial, runTrial, stepTrial } from "../seaTrial";
import { simShipFromStats } from "../simShip";
import type {
  BreakMode,
  Compartment,
  CompartmentSpec,
  HalfPose,
  SimPose,
  SimState,
  TrialInput,
} from "../types";

type Vec = [number, number, number];

function templateShip(id: string): Ship {
  const template = findTemplate(id);
  if (!template) throw new Error(`no template ${id}`);
  return template.build();
}

function withoutWalls(ship: Ship): Ship {
  return { ...ship, hull: { ...ship.hull, bulkheads: [] } };
}

function icebergInput(
  ship: Ship,
  impactX: number,
  breakMode?: BreakMode
): TrialInput {
  const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
  return {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "calm",
    iceberg: {
      compartments: compartmentSpecsOf(ship.hull),
      length,
      impactX,
      ...(breakMode ? { breakMode } : {}),
    },
  };
}

/** Every state of a trial, from the first step to done. */
function statesOf(input: TrialInput): SimState[] {
  const states = [createTrial(input)];
  while (states[states.length - 1].phase !== "done") {
    states.push(stepTrial(input, states[states.length - 1]));
  }
  return states;
}

/** three.js Euler XYZ rotation (roll about x, pitch about z) of a point. */
function rotate([x, y, z]: Vec, roll: number, pitch: number): Vec {
  const x1 = x * Math.cos(pitch) - y * Math.sin(pitch);
  const y1 = x * Math.sin(pitch) + y * Math.cos(pitch);
  return [
    x1,
    y1 * Math.cos(roll) - z * Math.sin(roll),
    y1 * Math.sin(roll) + z * Math.cos(roll),
  ];
}

function wholeWorld(point: Vec, pose: SimPose): Vec {
  const [x, y, z] = rotate(point, pose.roll, pose.pitch);
  return [x, y - pose.sink, z];
}

/** The contract: T(driftX, -sink, 0) T(px) R T(-px). */
function halfWorld(point: Vec, half: HalfPose, length: number): Vec {
  const px = length / 2 - half.pivotX;
  const [x, y, z] = rotate(
    [point[0] - px, point[1], point[2]],
    half.roll,
    half.pitch
  );
  return [x + px + half.driftX, y - half.sink, z];
}

function expectNear(a: Vec, b: Vec, tolerance: number): void {
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(a[i] - b[i])).toBeLessThan(tolerance);
  }
}

function spec(id: string, fromX: number, toX: number): CompartmentSpec {
  return { id, fromX, toX, bowWall: 1, sternWall: 1 };
}

function wet(...water: number[]): Compartment[] {
  return water.map((w, i) => ({ id: `c${i}`, water: w, opened: false }));
}

describe("strain and strength", () => {
  it("grows with the pitch and the square of the length", () => {
    expect(strainOf(-0.3, REF_LENGTH)).toBeCloseTo(0.3);
    expect(strainOf(0.3, REF_LENGTH)).toBeCloseTo(0.3);
    expect(strainOf(-0.3, REF_LENGTH / 2)).toBeCloseTo(0.075);
  });

  it("uses the hull strength in real mode, and when no mode is given", () => {
    expect(strengthFor("real", 30)).toBe(HULL_STRENGTH);
    expect(strengthFor(undefined, 30)).toBe(HULL_STRENGTH);
  });

  it("breaks any ship at the always pitch, and none when told not to", () => {
    for (const length of [12, 30, 60]) {
      expect(strainOf(ALWAYS_BREAK_PITCH, length)).toBeGreaterThanOrEqual(
        strengthFor("always", length)
      );
      expect(strainOf(ALWAYS_BREAK_PITCH * 0.99, length)).toBeLessThan(
        strengthFor("always", length)
      );
    }
    expect(strengthFor("never", 60)).toBe(Infinity);
  });

  it("lets the liner reach her limit in a plunge but not a short ship", () => {
    expect(strainOf(PLUNGE_PITCH, 60)).toBeGreaterThanOrEqual(HULL_STRENGTH);
    expect(strainOf(PLUNGE_PITCH, 54)).toBeLessThan(HULL_STRENGTH);
  });
});

describe("where she breaks", () => {
  const specs = [
    spec("c0", 0, 9),
    spec("c1", 9, 18),
    spec("c2", 18, 27),
    spec("c3", 27, 36),
    spec("c4", 36, 60),
  ];

  it("breaks at the stern wall of the stern-most flooded compartment", () => {
    expect(breakPositionOf(specs, wet(0.9, 0.8, 0.6, 0.2, 0), 60)).toBe(27);
    expect(breakPositionOf(specs, wet(0.9, 0.8, 0.6, 0.7, 0), 60)).toBe(36);
  });

  it("keeps the break away from the ends", () => {
    expect(breakPositionOf(specs, wet(0.9, 0, 0, 0, 0), 60)).toBe(21);
    expect(breakPositionOf(specs, wet(1, 1, 1, 1, 1), 60)).toBe(42);
  });

  it("breaks a hull with no walls at 0.6 of her length", () => {
    expect(breakPositionOf([spec("c0", 0, 30)], wet(1), 30)).toBe(
      NO_WALLS_BREAK_FRACTION * 30
    );
  });
});

describe("the break", () => {
  const input = icebergInput(templateShip("titanic"), 5);
  const states = statesOf(input);
  const breakIndex = states.findIndex((s) => s.breakup !== null);
  const before = states[breakIndex - 1];
  const at = states[breakIndex];

  it("breaks the Titanic in two near 17 degrees, behind the flooded bow", () => {
    expect(at.breakup).not.toBeNull();
    expect(at.breakup!.angle).toBeLessThan(-0.29);
    expect(at.breakup!.angle).toBeGreaterThan(-0.32);
    expect(at.breakup!.atX).toBe(27);
    expect(at.events.filter((e) => e.kind === "broke")).toEqual([
      { at: at.time, kind: "broke" },
    ]);
    expect(at.halves!.bow.pivotX).toBe(27);
    expect(at.halves!.stern.pivotX).toBe(27);
  });

  it("starts both halves exactly where the whole ship was", () => {
    // The contract is exact for an upright ship; take the roll out.
    const upright = { ...before, pose: { ...before.pose, roll: 0 } };
    const next = stepTrial(input, upright);
    const length = input.iceberg!.length;
    const bowTip: Vec = [length / 2, 0, 0];
    const sternTip: Vec = [-length / 2, 0, 0];
    expectNear(
      halfWorld(bowTip, next.halves!.bow, length),
      wholeWorld(bowTip, upright.pose),
      1e-6
    );
    expectNear(
      halfWorld(sternTip, next.halves!.stern, length),
      wholeWorld(sternTip, upright.pose),
      1e-6
    );
  });

  it("does not visibly jump with the little roll she has left", () => {
    const length = input.iceberg!.length;
    for (const tip of [length / 2, -length / 2]) {
      const half = tip > 0 ? at.halves!.bow : at.halves!.stern;
      expectNear(
        halfWorld([tip, 0, 0], half, length),
        wholeWorld([tip, 0, 0], before.pose),
        0.01
      );
    }
  });

  it("moves exactly as an unbroken ship until she breaks", () => {
    const held = statesOf(icebergInput(templateShip("titanic"), 5, "never"));
    for (let i = 0; i < breakIndex; i++) {
      expect(held[i].pose).toEqual(states[i].pose);
    }
  });

  it("takes her lights out first", () => {
    expect(at.power).toBe("out");
    const kinds = at.events.map((e) => e.kind);
    expect(kinds.indexOf("power-out")).toBeLessThan(kinds.indexOf("broke"));
  });
});

describe("the halves", () => {
  const input = icebergInput(templateShip("titanic"), 5);
  const states = statesOf(input);
  const broken = states.filter((s) => s.halves !== null);
  const breakAt = broken[0].breakup!.at;
  const atX = broken[0].breakup!.atX;
  const length = input.iceberg!.length;
  const when = (seconds: number) =>
    broken.find((s) => s.time >= breakAt + seconds)!;

  it("dives the bow toward its final pitch", () => {
    expect(when(3).halves!.bow.pitch).toBeLessThan(BOW_FINAL_PITCH + 0.05);
    expect(when(3).halves!.bow.sink).toBeGreaterThan(
      broken[0].halves!.bow.sink
    );
  });

  it("settles the stern back toward level first", () => {
    const settled = when(STERN_SETTLE_S - 0.05).halves!.stern;
    expect(Math.abs(settled.pitch)).toBeLessThan(0.05);
    expect(settled.sink).toBeLessThan(broken[0].halves!.stern.sink);
  });

  it("then rears the stern up nearly upright and hangs there", () => {
    const hangStart = STERN_SETTLE_S + STERN_RISE_S;
    for (const t of [hangStart + 0.2, hangStart + STERN_HANG_S - 0.05]) {
      expect(when(t).halves!.stern.pitch).toBeCloseTo(STERN_FINAL_PITCH, 1);
      expect(
        shallowestDepth(
          when(t).halves!.stern.sink,
          when(t).halves!.stern.pitch,
          sternSpan(atX, length)
        )
      ).toBeLessThan(-20);
    }
  });

  it("ends with sunk once both halves are under", () => {
    const last = states[states.length - 1];
    expect(last.phase).toBe("done");
    expect(last.outcome).toBe("sank");
    expect(last.events[last.events.length - 1].kind).toBe("sunk");
    const { bow, stern } = last.halves!;
    expect(
      shallowestDepth(bow.sink, bow.pitch, bowSpan(atX))
    ).toBeGreaterThanOrEqual(HALF_UNDER_DEPTH);
    expect(
      shallowestDepth(stern.sink, stern.pitch, sternSpan(atX, length))
    ).toBeGreaterThanOrEqual(HALF_UNDER_DEPTH);
    const prev = states[states.length - 2];
    expect(
      shallowestDepth(
        prev.halves!.stern.sink,
        prev.halves!.stern.pitch,
        sternSpan(atX, length)
      )
    ).toBeLessThan(HALF_UNDER_DEPTH);
  });

  it("is the same every run", () => {
    expect(runTrial(input)).toEqual(runTrial(input));
  });
});

describe("holding together", () => {
  it("keeps the never plunge as it always was", () => {
    const input = icebergInput(templateShip("titanic"), 5, "never");
    const state = runTrial(input);
    expect(state.breakup).toBeNull();
    expect(state.halves).toBeNull();
    expect(state.pose.sink).toBe(PLUNGE_DEPTH);
    expect(state.pose.pitch).toBeCloseTo(PLUNGE_PITCH, 5);
    expect(state.events[state.events.length - 1].kind).toBe("sunk");
  });
});

/**
 * The tuning table (also in README.md). The smallest template keeps the
 * water out wherever she is struck, so she sails here without her walls.
 */
const TABLE: [string, boolean, number, BreakMode, boolean][] = [
  ["titanic", true, 5, "real", true],
  ["titanic", true, 5, "always", true],
  ["titanic", true, 5, "never", false],
  ["titanic", true, 55, "real", false],
  ["ever-given", false, 5, "real", true],
  ["lusitania", true, 49, "real", false],
  ["lusitania", true, 49, "always", true],
  ["arleigh-burke", false, 5, "real", false],
  ["coast-guard-cutter", false, 5, "real", false],
  ["coast-guard-cutter", false, 5, "always", true],
  ["coast-guard-cutter", false, 5, "never", false],
];

describe("tuning table across the templates", () => {
  it.each(TABLE)(
    "%s (walls %s) struck at x=%d in %s mode breaks: %s",
    (id, walls, impactX, mode, breaks) => {
      const ship = walls ? templateShip(id) : withoutWalls(templateShip(id));
      const state = runTrial(icebergInput(ship, impactX, mode));
      expect(state.outcome).toBe("sank");
      expect(state.breakup !== null).toBe(breaks);
      expect(state.phase).toBe("done");
    }
  );
});
