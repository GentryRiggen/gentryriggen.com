import { CELLS_PER_SEGMENT } from "@/lib/ship-builder/model/grid";
import { computeStats } from "@/lib/ship-builder/model/stats";
import { compartmentSpecsOf } from "@/lib/ship-builder/sim/compartments";
import { simShipFromStats } from "@/lib/ship-builder/sim/simShip";
import { timelineEnd } from "@/lib/ship-builder/sim/timeline";
import type { BreakMode, TrialInput } from "@/lib/ship-builder/sim/types";
import { findTemplate } from "@/lib/ship-builder/templates";
import { trialTimelineFor } from "../trialTimeline";

function icebergInput(id: string, breakMode: BreakMode): TrialInput {
  const ship = findTemplate(id)?.build();
  if (!ship) throw new Error(`no template ${id}`);
  return {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "calm",
    funnels: [],
    length: ship.hull.lengthSegments * CELLS_PER_SEGMENT,
    iceberg: {
      compartments: compartmentSpecsOf(ship.hull),
      length: ship.hull.lengthSegments * CELLS_PER_SEGMENT,
      impactX: 5,
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
