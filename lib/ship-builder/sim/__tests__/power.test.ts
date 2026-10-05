import { CELLS_PER_SEGMENT } from "../../model/grid";
import { computeStats } from "../../model/stats";
import type { Ship } from "../../model/types";
import { emptyShip } from "../../model/placement";
import { findTemplate } from "../../templates";
import { compartmentSpecsOf } from "../compartments";
import { PLUNGE_DEPTH } from "../flooding";
import {
  FLICKER_FLOODED,
  FLOODED_WATER,
  middleCompartmentOf,
  shouldFlicker,
  withPower,
} from "../power";
import { createTrial, runTrial, stepTrial } from "../seaTrial";
import { simShipFromStats } from "../simShip";
import type {
  BreakMode,
  CompartmentSpec,
  SimEvent,
  SimState,
  TrialInput,
} from "../types";

function templateShip(id: string): Ship {
  const template = findTemplate(id);
  if (!template) throw new Error(`no template ${id}`);
  return template.build();
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

function powerEvents(state: SimState): SimEvent["kind"][] {
  return state.events
    .map((e) => e.kind)
    .filter((k) => k === "power-flicker" || k === "power-out" || k === "broke");
}

function eventAt(state: SimState, kind: SimEvent["kind"]): number {
  const event = state.events.find((e) => e.kind === kind);
  if (!event) throw new Error(`no ${kind}`);
  return event.at;
}

const specs: CompartmentSpec[] = [
  { id: "c0", fromX: 0, toX: 10, bowWall: 1, sternWall: 1 },
  { id: "c1", fromX: 10, toX: 20, bowWall: 1, sternWall: 1 },
  { id: "c2", fromX: 20, toX: 30, bowWall: 1, sternWall: 1 },
];

function stateWithWater(...water: number[]): SimState {
  const input: TrialInput = {
    ship: { stabilityRatio: 0, listAngle: 0, beam: 4 },
    sea: "calm",
  };
  return {
    ...createTrial(input),
    compartments: water.map((w, i) => ({
      id: `c${i}`,
      water: w,
      opened: false,
    })),
  };
}

describe("when the lights fail", () => {
  it("finds the engine room in the middle of the hull", () => {
    expect(middleCompartmentOf(specs, 30)).toBe(1);
    expect(middleCompartmentOf([specs[0], { ...specs[1], toX: 30 }], 30)).toBe(
      1
    );
  });

  it("flickers once the engine room floods", () => {
    expect(shouldFlicker(stateWithWater(0, FLOODED_WATER, 0), specs, 30)).toBe(
      false
    );
    expect(
      shouldFlicker(stateWithWater(0, FLOODED_WATER + 0.01, 0), specs, 30)
    ).toBe(true);
  });

  it("flickers once enough of the hull floods, wherever it is", () => {
    const share = FLICKER_FLOODED * 3;
    expect(shouldFlicker(stateWithWater(share - 0.01, 0, 0), specs, 30)).toBe(
      false
    );
    expect(shouldFlicker(stateWithWater(share, 0, 0), specs, 30)).toBe(true);
  });

  it("never turns the lights back on, and logs each change once", () => {
    const on = stateWithWater(0, 0, 0);
    const dark = withPower(on, "out", 3);
    expect(dark.power).toBe("out");
    expect(dark.events).toEqual([
      { at: 3, kind: "power-flicker" },
      { at: 3, kind: "power-out" },
    ]);
    expect(withPower(dark, "flickering", 4)).toBe(dark);
    expect(withPower(dark, "out", 4)).toBe(dark);
  });
});

describe("the lights in a trial", () => {
  it("flicker, go out, then she breaks", () => {
    const state = runTrial(icebergInput(templateShip("titanic"), 5));
    expect(powerEvents(state)).toEqual(["power-flicker", "power-out", "broke"]);
    expect(eventAt(state, "power-out")).toBeLessThan(eventAt(state, "broke"));
    expect(state.power).toBe("out");
  });

  it("go out a third of the way down when she holds together", () => {
    const input = icebergInput(templateShip("titanic"), 5, "never");
    let state = createTrial(input);
    while (state.power !== "out") {
      const next = stepTrial(input, state);
      if (next.power === "out") {
        expect(next.pose.sink).toBeGreaterThanOrEqual(PLUNGE_DEPTH / 3);
        expect(state.pose.sink).toBeLessThan(PLUNGE_DEPTH / 3);
      }
      state = next;
    }
    expect(powerEvents(runTrial(input))).toEqual([
      "power-flicker",
      "power-out",
    ]);
  });

  it("only flicker when she stays afloat with a flooded engine room", () => {
    const ship = emptyShip("liner", "Test", 10, 4);
    const walled: Ship = {
      ...ship,
      hull: {
        ...ship.hull,
        bulkheads: [
          { at: 4, height: "deck" },
          { at: 6, height: "deck" },
        ],
      },
    };
    const state = runTrial(icebergInput(walled, 15));
    expect(state.outcome).toBe("afloat");
    expect(state.power).toBe("flickering");
    expect(powerEvents(state)).toEqual(["power-flicker"]);
  });

  it("stay on through a waves trial", () => {
    const input: TrialInput = {
      ship: { stabilityRatio: 0.45, listAngle: 0, beam: 4 },
      sea: "stormy",
    };
    const state = runTrial(input);
    expect(state.outcome).toBe("capsized");
    expect(state.power).toBe("on");
    expect(powerEvents(state)).toEqual([]);
  });
});
