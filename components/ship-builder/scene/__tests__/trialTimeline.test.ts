import { CELLS_PER_SEGMENT } from "@/lib/ship-builder/model/grid";
import { computeStats } from "@/lib/ship-builder/model/stats";
import { compartmentSpecsOf } from "@/lib/ship-builder/sim/compartments";
import { simShipFromStats } from "@/lib/ship-builder/sim/simShip";
import { timelineEnd } from "@/lib/ship-builder/sim/timeline";
import type { BreakMode, TrialInput } from "@/lib/ship-builder/sim/types";
import { findTemplate } from "@/lib/ship-builder/templates";
import {
  clearTrialTimeline,
  trialEvacuationFor,
  trialTimelineFor,
} from "../trialTimeline";

function icebergInput(
  id: string,
  breakMode: BreakMode,
  ship = findTemplate(id)?.build(),
  impactX = 5
): TrialInput {
  if (!ship) throw new Error(`no template ${id}`);
  return {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "calm",
    funnels: [],
    length: ship.hull.lengthSegments * CELLS_PER_SEGMENT,
    iceberg: {
      compartments: compartmentSpecsOf(ship.hull),
      length: ship.hull.lengthSegments * CELLS_PER_SEGMENT,
      impactX,
      breakMode,
    },
  };
}

describe("trialTimelineFor with the descent", () => {
  it("ends where the plain timeline ends when she does not sink", () => {
    const input = icebergInput("britannic", "real");
    const plain = trialTimelineFor(input, false);
    const last = plain.states[plain.states.length - 1];
    expect(last.outcome).not.toBe("sank");

    const descending = trialTimelineFor(input, true);
    const end = descending.states[descending.states.length - 1];
    expect(timelineEnd(descending)).toBe(timelineEnd(plain));
    expect(end.outcome).toBe(last.outcome);
  });

  it("carries on past the sinking to the sea floor when she sinks", () => {
    const input = icebergInput("titanic", "never");
    const plain = trialTimelineFor(input, false);
    const descending = trialTimelineFor(input, true);
    expect(descending.descended).toBe(true);
    expect(timelineEnd(descending)).toBeGreaterThan(timelineEnd(plain));
  });
});

describe("trialEvacuationFor", () => {
  const ship = findTemplate("titanic")!.build();
  const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
  const input = icebergInput(
    "titanic",
    "never",
    ship,
    Math.round(length * 0.2)
  );

  it("plans the sinking once per input and ship, beside the timeline", () => {
    const plan = trialEvacuationFor(input, ship, true);
    expect(plan).not.toBeNull();
    expect(plan!.launches.length).toBeGreaterThan(0);
    expect(trialEvacuationFor(input, ship, true)).toBe(plan);
    // The plain timeline gets its own plan.
    expect(trialEvacuationFor(input, ship, false)).not.toBe(plan);
  });

  it("is forgotten with the timeline", () => {
    const plan = trialEvacuationFor(input, ship, true);
    clearTrialTimeline();
    expect(trialEvacuationFor(input, ship, true)).not.toBe(plan);
  });

  it("is null for a weather trial", () => {
    const { iceberg, ...weather } = input;
    expect(iceberg).toBeDefined();
    expect(trialEvacuationFor(weather, ship, true)).toBeNull();
  });
});
