import { MeshStandardMaterial } from "three";
import type { SimState } from "@/lib/ship-builder/sim/types";
import { CELLS_PER_SEGMENT } from "@/lib/ship-builder/model/grid";
import { emptyShip } from "@/lib/ship-builder/model/placement";
import { computeStats } from "@/lib/ship-builder/model/stats";
import { compartmentSpecsOf } from "@/lib/ship-builder/sim/compartments";
import { simShipFromStats } from "@/lib/ship-builder/sim/simShip";
import {
  buildTimeline,
  extendWithDescent,
  stateAt as timelineStateAt,
  timelineEnd,
} from "@/lib/ship-builder/sim/timeline";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import { rustAmount, withRust } from "../rust";
import {
  resetPlayback,
  writeTimelinePlayback,
  type TrialPlayback,
} from "../trialPlayback";

function stateAt(time: number, landedAt?: number): SimState {
  return {
    time,
    events:
      landedAt === undefined
        ? []
        : [{ at: landedAt, kind: "touched-bottom", body: "ship" }],
  } as unknown as SimState;
}

describe("rustAmount", () => {
  it("is 0 with no state", () => {
    expect(rustAmount(null)).toBe(0);
  });
  it("is 0 before touching bottom", () => {
    expect(rustAmount(stateAt(30))).toBe(0);
  });
  it("eases in after landing", () => {
    expect(rustAmount(stateAt(10, 10))).toBe(0);
    const mid = rustAmount(stateAt(12, 10));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(rustAmount(stateAt(14, 10))).toBe(1);
    expect(rustAmount(stateAt(20, 10))).toBe(1);
  });
});

describe("withRust", () => {
  it("patches once", () => {
    const m = new MeshStandardMaterial();
    withRust(m);
    const first = m.onBeforeCompile;
    withRust(m);
    expect(m.onBeforeCompile).toBe(first);
  });
});

describe("rust over a whole sunk timeline", () => {
  const ship = emptyShip("liner", "Test", 10, 4);
  const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
  const iceberg: TrialInput = {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "calm",
    funnels: [],
    length,
    iceberg: {
      compartments: compartmentSpecsOf(ship.hull),
      length,
      impactX: 5,
    },
  };
  const weather: TrialInput = {
    ship: { stabilityRatio: 0.45, listAngle: 0, beam: 4 },
    sea: "stormy",
    funnels: [],
    length: 30,
  };

  it.each([
    ["iceberg", iceberg],
    ["weather", weather],
  ])("fully rusts her by the end of a %s sinking", (_name, input) => {
    const timeline = extendWithDescent(buildTimeline(input), input);
    const last = timeline.states[timeline.states.length - 1];
    expect(last.events.some((e) => e.kind === "touched-bottom")).toBe(true);
    expect(rustAmount(last)).toBe(1);

    // Playback (what RustDriver reads) follows the scrubbed time.
    const playback = {} as TrialPlayback;
    resetPlayback(playback);
    writeTimelinePlayback(timeline, timelineEnd(timeline), playback);
    expect(rustAmount(playback)).toBe(1);
    const landed = last.events.find((e) => e.kind === "touched-bottom")!;
    writeTimelinePlayback(timeline, landed.at - 0.5, playback);
    expect(rustAmount(playback)).toBe(0);
    writeTimelinePlayback(timeline, landed.at + 2, playback);
    const mid = rustAmount(playback);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(timelineStateAt(timeline, landed.at + 2).time).toBeCloseTo(
      landed.at + 2,
      1
    );
  });
});
