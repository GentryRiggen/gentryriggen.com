import { SHIP_KINDS } from "../../model/kinds";
import { CELLS_PER_SEGMENT } from "../../model/grid";
import { computeStats } from "../../model/stats";
import type { Bulkhead, BulkheadHeight, Ship } from "../../model/types";
import { emptyShip } from "../../model/placement";
import { TEMPLATES, findTemplate } from "../../templates";
import { compartmentSpecsOf, openedBy } from "../compartments";
import { createTrial, runTrial, stepTrial } from "../seaTrial";
import { simShipFromStats } from "../simShip";
import { formatStoryTime, storyMinutes } from "../story";
import type { SimSea, SimState, TrialInput } from "../types";

const HISTORIC_IMPACT_X = 5;

function icebergInput(
  ship: Ship,
  impactX: number,
  sea: SimSea = "calm"
): TrialInput {
  const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
  return {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea,
    iceberg: { compartments: compartmentSpecsOf(ship.hull), length, impactX },
  };
}

function wallsAt(segments: number, height: BulkheadHeight): Bulkhead[] {
  return Array.from({ length: segments - 1 }, (_, i) => ({
    at: i + 1,
    height,
  }));
}

function plainShip(height: BulkheadHeight | null): Ship {
  const ship = emptyShip("liner", "Test", 10, 4);
  return height
    ? { ...ship, hull: { ...ship.hull, bulkheads: wallsAt(10, height) } }
    : ship;
}

function run(ship: Ship, impactX: number, sea: SimSea = "calm"): SimState {
  return runTrial(icebergInput(ship, impactX, sea));
}

function sunkAt(state: SimState): number {
  const event = state.events.find((e) => e.kind === "sunk");
  if (!event) throw new Error("she did not sink");
  return event.at;
}

function hasEvent(state: SimState, kind: string): boolean {
  return state.events.some((e) => e.kind === kind);
}

function templateShip(id: string): Ship {
  const template = findTemplate(id);
  if (!template) throw new Error(`no template ${id}`);
  return template.build();
}

describe("iceberg trial outcomes", () => {
  it("sinks a ship with no bulkheads", () => {
    for (const impactX of [2, 15, 28]) {
      const state = run(plainShip(null), impactX);
      expect(state.outcome).toBe("sank");
      expect(state.reason).toBe("no-bulkheads");
    }
  });

  it("holds when deck-high walls surround the opened compartments", () => {
    const state = run(plainShip("deck"), 9);
    expect(state.outcome).toBe("afloat");
    expect(state.reason).toBe("held");
    expect(hasEvent(state, "flooding")).toBe(true);
    expect(hasEvent(state, "spilled")).toBe(false);
    expect(state.pose.sink).toBeLessThanOrEqual(1.5);
    expect(Math.abs(state.pose.pitch)).toBeLessThanOrEqual(0.12);
    expect(state.phase).toBe("done");
  });

  it("sinks when every wall is low, after water spills over", () => {
    const state = run(plainShip("low"), 9);
    expect(state.outcome).toBe("sank");
    expect(state.reason).toBe("spilled");
    expect(hasEvent(state, "spilled")).toBe(true);
  });

  it("sinks without any spill when the gash opens too many compartments", () => {
    const ship = emptyShip("liner", "Test", 10, 4);
    const walled: Ship = {
      ...ship,
      hull: { ...ship.hull, bulkheads: [{ at: 5, height: "deck" }] },
    };
    const state = run(walled, 15);
    expect(state.outcome).toBe("sank");
    expect(state.reason).toBe("too-many-opened");
    expect(hasEvent(state, "spilled")).toBe(false);
  });

  it("sinks the Titanic in about 160 story minutes", () => {
    const state = run(templateShip("titanic"), HISTORIC_IMPACT_X);
    expect(state.outcome).toBe("sank");
    expect(state.reason).toBe("spilled");
    const minutes = storyMinutes(sunkAt(state));
    expect(minutes).toBeGreaterThanOrEqual(150);
    expect(minutes).toBeLessThanOrEqual(170);
    expect(sunkAt(state)).toBeGreaterThanOrEqual(25);
    expect(sunkAt(state)).toBeLessThanOrEqual(45);
    expect(state.phase).toBe("done");
    expect(state.pose.pitch).toBeLessThan(-0.2);
  });

  it("sinks the Olympic, which has the same walls", () => {
    const state = run(templateShip("olympic"), HISTORIC_IMPACT_X);
    expect(state.outcome).toBe("sank");
  });

  it("keeps the Britannic afloat with her raised walls", () => {
    const state = run(templateShip("britannic"), HISTORIC_IMPACT_X);
    expect(state.outcome).toBe("afloat");
    expect(state.reason).toBe("held");
  });

  it("gives every template walls that hold when struck at the middle", () => {
    for (const kind of SHIP_KINDS) {
      for (const template of TEMPLATES[kind]) {
        const ship = template.build();
        expect([template.id, (ship.hull.bulkheads ?? []).length > 0]).toEqual([
          template.id,
          true,
        ]);
        const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
        const state = run(ship, length / 2);
        expect([template.id, state.outcome]).toEqual([template.id, "afloat"]);
      }
    }
  });
});

describe("iceberg trial mechanics", () => {
  it("opens the compartments the gash touches", () => {
    const ship = plainShip("deck");
    const input = icebergInput(ship, 9);
    const state = createTrial(input);
    const opened = state.compartments.filter((c) => c.opened).map((c) => c.id);
    expect(opened).toEqual(
      openedBy(input.iceberg!.compartments, 9, input.iceberg!.length)
    );
    expect(opened).toHaveLength(2);
    expect(state.compartments.every((c) => c.water === 0)).toBe(true);
  });

  it("floods the opened compartments first and sinks her a little", () => {
    const input = icebergInput(plainShip("deck"), 9);
    let state = createTrial(input);
    for (let i = 0; i < 300; i++) state = stepTrial(input, state);
    expect(state.compartments.some((c) => c.opened && c.water > 0.2)).toBe(
      true
    );
    expect(state.pose.sink).toBeGreaterThan(0);
    expect(state.pose.pitch).toBeLessThan(0);
  });

  it("is deterministic", () => {
    const ship = templateShip("titanic");
    expect(run(ship, HISTORIC_IMPACT_X)).toEqual(run(ship, HISTORIC_IMPACT_X));
  });

  it("does not end an iceberg trial at the waves trial's 9 second mark", () => {
    const input = icebergInput(templateShip("titanic"), HISTORIC_IMPACT_X);
    let state = createTrial(input);
    while (state.time < 10) state = stepTrial(input, state);
    expect(state.phase).not.toBe("done");
  });

  it("formats the sunk time for the result card", () => {
    const state = run(templateShip("titanic"), HISTORIC_IMPACT_X);
    expect(formatStoryTime(storyMinutes(sunkAt(state)))).toMatch(/hours?/);
  });
});
