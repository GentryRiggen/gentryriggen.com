import { SHIP_KINDS } from "../../model/kinds";
import {
  CELLS_PER_SEGMENT,
  MAX_SEGMENTS,
  MIN_SEGMENTS,
} from "../../model/grid";
import { computeStats } from "../../model/stats";
import type { Bulkhead, BulkheadHeight, Ship } from "../../model/types";
import { emptyShip } from "../../model/placement";
import { TEMPLATES } from "../../templates";
import { compartmentSpecsOf } from "../compartments";
import { startDescent } from "../descent";
import { explainTrial } from "../explain";
import { STORM_START_S } from "../flooding";
import {
  STORM_NO_CAPSIZE_S,
  createTrial,
  runTrial,
  stepTrial,
} from "../seaTrial";
import { WAVES, WILD_WAVES } from "../seaWaves";
import { simShipFromStats } from "../simShip";
import { buildTimeline } from "../timeline";
import type { SimSea, SimShip, SimState, TrialInput } from "../types";

function stormInput(ship: Ship, simShip?: SimShip): TrialInput {
  const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
  return {
    ship: simShip ?? simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "wild",
    funnels: [],
    length,
    storm: { compartments: compartmentSpecsOf(ship.hull), length },
  };
}

function wallsAt(segments: number, height: BulkheadHeight): Bulkhead[] {
  return Array.from({ length: segments - 1 }, (_, i) => ({
    at: i + 1,
    height,
  }));
}

function plainShip(segments: number, height: BulkheadHeight | null): Ship {
  const ship = emptyShip("liner", "Test", segments, 4);
  return height
    ? { ...ship, hull: { ...ship.hull, bulkheads: wallsAt(segments, height) } }
    : ship;
}

function sunkAt(state: SimState): number {
  const event = state.events.find((e) => e.kind === "sunk");
  if (!event) throw new Error(`she did not sink (${state.outcome})`);
  return event.at;
}

function expectSinksInWindow(input: TrialInput): void {
  const state = runTrial(input);
  expect(state.outcome).toBe("sank");
  expect(state.reason).toBe("storm");
  const at = sunkAt(state);
  expect(at).toBeGreaterThanOrEqual(60);
  expect(at).toBeLessThanOrEqual(120);
}

const templates = SHIP_KINDS.flatMap((kind) =>
  TEMPLATES[kind].map((template) => [template.id, template] as const)
);

describe("the storm trial", () => {
  it.each(templates)("storm sinks %s inside the window", (_id, template) => {
    expectSinksInWindow(stormInput(template.build()));
  });

  it("storm sinks degenerate builds", () => {
    const oneBlock = emptyShip("liner", "Tiny", MIN_SEGMENTS, 1);
    const builds: Ship[] = [
      oneBlock,
      plainShip(10, null),
      plainShip(10, "deck"),
      plainShip(MIN_SEGMENTS, null),
      plainShip(MIN_SEGMENTS, "deck"),
      plainShip(MAX_SEGMENTS, null),
      plainShip(MAX_SEGMENTS, "deck"),
      plainShip(MAX_SEGMENTS, "low"),
    ];
    for (const ship of builds) expectSinksInWindow(stormInput(ship));
  });

  it("no capsize before 30 s", () => {
    const dangerous: SimShip = {
      stabilityRatio: 0.45,
      listAngle: 0.25,
      beam: 4,
    };
    for (const listAngle of [0.25, -0.25, 0.1, 0.35, -0.35]) {
      const state = runTrial(
        stormInput(plainShip(10, null), { ...dangerous, listAngle })
      );
      const capsized = state.events.find((e) => e.kind === "capsized");
      expect(capsized).toBeDefined();
      expect(capsized!.at).toBeGreaterThanOrEqual(STORM_NO_CAPSIZE_S);
      expect(state.outcome).toBe("sank");
      expect(state.reason).toBe("storm");
      expect(state.events.some((e) => e.kind === "sunk")).toBe(true);
    }
  });

  it("deck-high walls buy at least 8 s over no walls", () => {
    for (const segments of [MIN_SEGMENTS, 10, MAX_SEGMENTS]) {
      const bare = sunkAt(runTrial(stormInput(plainShip(segments, null))));
      const walled = sunkAt(runTrial(stormInput(plainShip(segments, "deck"))));
      expect(walled - bare).toBeGreaterThanOrEqual(8);
    }
  });

  it("keeps moving while she is held from capsizing", () => {
    const input = stormInput(plainShip(10, null), {
      stabilityRatio: 0.45,
      listAngle: 0.35,
      beam: 4,
    });
    let state = createTrial(input);
    const rolls: number[] = [];
    let pinned = 0;
    let longestPin = 0;
    while (state.time < STORM_NO_CAPSIZE_S - 0.5) {
      state = stepTrial(input, state);
      rolls.push(state.pose.roll);
      pinned = state.rollVelocity === 0 ? pinned + 1 : 0;
      longestPin = Math.max(longestPin, pinned);
    }
    expect(state.phase).toBe("sailing");
    expect(longestPin).toBeLessThan(5);
    const late = rolls.slice(-300);
    expect(Math.max(...late) - Math.min(...late)).toBeGreaterThan(0.001);
  });

  it("a capsized storm ship stays upside down on the way down", () => {
    const input = stormInput(plainShip(10, null), {
      stabilityRatio: 0.45,
      listAngle: 0.25,
      beam: 4,
    });
    let state = startDescent(runTrial(input));
    expect(state.phase).toBe("descending");
    expect(state.events.some((e) => e.kind === "capsized")).toBe(true);
    const over = Math.abs(state.pose.roll);
    expect(over).toBeGreaterThan(1.5);
    let steps = 0;
    while (state.phase !== "done" && steps++ < 20000) {
      state = stepTrial(input, state);
      expect(Math.abs(state.pose.roll)).toBeGreaterThan(over - 0.05);
    }
    expect(state.phase).toBe("done");
  });

  it("storm is deterministic", () => {
    const input = stormInput(plainShip(MAX_SEGMENTS, "low"));
    expect(buildTimeline(input)).toEqual(buildTimeline(input));
  });

  it("does not take water before the storm builds", () => {
    const input = stormInput(plainShip(10, null));
    let state = createTrial(input);
    while (state.time < STORM_START_S - 0.1) state = stepTrial(input, state);
    expect(state.compartments.every((c) => c.water === 0)).toBe(true);
    expect(state.phase).toBe("sailing");
  });

  it("keeps sailing past the waves trial's timeout", () => {
    const input = stormInput(plainShip(10, "deck"));
    let state = createTrial(input);
    while (state.time < 20) state = stepTrial(input, state);
    expect(state.phase).toBe("sailing");
    expect(state.outcome).toBeNull();
  });

  it("explains a storm sinking in kid words", () => {
    const input = stormInput(plainShip(10, "deck"));
    const summary = explainTrial(runTrial(input), input);
    expect(summary.title).toBe("She sank");
    expect(summary.message).toBe(
      "The storm was too strong. Waves filled her up until she sank."
    );
    expect(summary.lights).toBeDefined();
    expect(summary.breakup).toBeDefined();
  });

  it("explains a storm capsize as rolling over", () => {
    const input = stormInput(plainShip(10, null), {
      stabilityRatio: 0.45,
      listAngle: 0.25,
      beam: 4,
    });
    const state = runTrial(input);
    expect(state.events.some((e) => e.kind === "capsized")).toBe(true);
    const summary = explainTrial(state, input);
    expect(summary.title).toBe("She sank");
    expect(summary.message).toBe("Big waves rolled her over and she sank.");
  });
});

describe("the wild sea", () => {
  function maxRoll(sea: SimSea): number {
    const input: TrialInput = {
      ship: { stabilityRatio: 0.06, listAngle: 0, beam: 6 },
      sea,
      funnels: [],
      length: 30,
    };
    let state = createTrial(input);
    let peak = 0;
    while (state.time < 20 && state.phase === "sailing") {
      state = stepTrial(input, state);
      peak = Math.max(peak, Math.abs(state.pose.roll));
    }
    return peak;
  }

  it("wild sea rolls harder than stormy", () => {
    expect(maxRoll("wild")).toBeGreaterThan(maxRoll("stormy"));
  });

  it("is a cross sea of more waves than the others", () => {
    expect(WILD_WAVES.length).toBeGreaterThanOrEqual(5);
    expect(WILD_WAVES.length).toBeLessThanOrEqual(6);
    const weights = WILD_WAVES.reduce((sum, w) => sum + w.weight, 0);
    expect(weights).toBeCloseTo(1, 6);
    const omegas = new Set(WILD_WAVES.map((w) => w.omega));
    expect(omegas.size).toBe(WILD_WAVES.length);
    const directions = new Set(
      WILD_WAVES.map((w) => Math.round(Math.atan2(w.dirY, w.dirX) * 10))
    );
    expect(directions.size).toBe(WILD_WAVES.length);
    expect(WAVES).toHaveLength(3);
  });
});
