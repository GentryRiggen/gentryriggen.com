import {
  outcomeOf,
  sumTiers,
  trackFlightEnd,
  trackFlightQuit,
} from "../analytics";
import { LEVELS } from "../levels";
import { STARTER_TIERS } from "../plane/catalog";
import { launch, type FlightState } from "../sim/flight";
import { planeStats } from "../plane/stats";
import { trackGame } from "@/lib/analytics/trackGame";

jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));

function state(over: Partial<FlightState>): FlightState {
  const level = LEVELS.meadow;
  return {
    ...launch(level, planeStats(level.plane, STARTER_TIERS), {
      pitch: 0,
      yaw: 0,
      power: 0.5,
    }),
    ...over,
  };
}

describe("outcomeOf", () => {
  it.each([
    [{ finished: true, endReason: "landed" as const }, "finish"],
    [{ finished: false, endReason: "crash" as const }, "crash"],
    [{ finished: false, endReason: "runout" as const }, "out_of_fuel"],
    [{ finished: false, endReason: "stalled" as const }, "stalled"],
    [{ finished: false, endReason: "landed" as const }, "landed"],
    [{ finished: false, endReason: "timeout" as const }, "timeout"],
    [{ finished: false, endReason: null }, "timeout"],
  ])("maps %j to %s", (input, expected) => {
    expect(outcomeOf(input)).toBe(expected);
  });
});

describe("trackFlightEnd", () => {
  it("buckets a crash to 50 m and names the obstacle", () => {
    trackFlightEnd(
      state({
        finished: false,
        endReason: "crash",
        crashKind: "tree",
        x: 1234,
        maxX: 1500,
      }),
      LEVELS.meadow,
      { ...STARTER_TIERS, wings: 2, fuel: 1 },
      true
    );
    expect(trackGame).toHaveBeenCalledWith("flight_end", {
      world: "meadow",
      outcome: "crash",
      dist: 7,
      crashX: 1200,
      obstacle: "tree",
      tiers: 3,
      daily: 1,
    });
  });

  it("sends -1 and no obstacle when the flight did not crash", () => {
    trackFlightEnd(
      state({ finished: true, endReason: "landed", maxX: 2000 }),
      LEVELS.meadow,
      STARTER_TIERS,
      false
    );
    expect(trackGame).toHaveBeenLastCalledWith(
      "flight_end",
      expect.objectContaining({ crashX: -1, obstacle: "none", dist: 10 })
    );
  });
});

it("sums the tiers", () => {
  expect(sumTiers({ ...STARTER_TIERS, body: 8, engine: 8 })).toBe(16);
});

describe("trackFlightQuit flush", () => {
  it("forwards the page-hide flag to trackGame", () => {
    const state = { maxX: 10 } as never;
    const level = { id: "meadow", finishDistance: 100 } as never;
    (trackGame as jest.Mock).mockClear();
    trackFlightQuit(state, level);
    trackFlightQuit(state, level, true);
    expect((trackGame as jest.Mock).mock.calls.map((c) => c[2])).toEqual([
      false,
      true,
    ]);
  });
});
