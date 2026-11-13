import { CELLS_PER_SEGMENT } from "../../model/grid";
import { computeStats } from "../../model/stats";
import { emptyShip } from "../../model/placement";
import type { Bulkhead, BulkheadHeight, Ship } from "../../model/types";
import { compartmentSpecsOf } from "../compartments";
import { explainTrial } from "../explain";
import { runTrial } from "../seaTrial";
import { simShipFromStats } from "../simShip";
import { STRIKES, strikeOf } from "../strike";
import type { SimState, StrikeKind, TrialInput } from "../types";

function walledShip(height: BulkheadHeight = "waterline"): Ship {
  const ship = emptyShip("liner", "Test", 10, 4);
  const bulkheads: Bulkhead[] = Array.from({ length: 9 }, (_, i) => ({
    at: i + 1,
    height,
  }));
  return { ...ship, hull: { ...ship.hull, bulkheads } };
}

function input(ship: Ship, strike: StrikeKind, impactX = 10): TrialInput {
  const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
  return {
    ship: simShipFromStats(computeStats(ship), ship.hull.beam),
    sea: "calm",
    funnels: [],
    length,
    iceberg: {
      compartments: compartmentSpecsOf(ship.hull),
      length,
      impactX,
      gashLength: STRIKES[strike].gashLength,
      ...(strike === "iceberg" ? {} : { strike }),
    },
  };
}

function sunkAt(state: SimState): number {
  const sunk = state.events.find((event) => event.kind === "sunk");
  if (!sunk) throw new Error("she did not sink");
  return sunk.at;
}

describe("strikes", () => {
  it("defaults to an iceberg", () => {
    expect(strikeOf(undefined)).toBe("iceberg");
    const plain = input(walledShip(), "iceberg").iceberg;
    expect(strikeOf(plain)).toBe("iceberg");
  });

  it("a mine sinks her fastest, an island slowest", () => {
    const ship = walledShip();
    const mine = sunkAt(runTrial(input(ship, "mine")));
    const berg = sunkAt(runTrial(input(ship, "iceberg")));
    const island = sunkAt(runTrial(input(ship, "island")));
    expect(mine).toBeLessThan(berg);
    expect(berg).toBeLessThan(island);
  });

  it("names what struck her in the result", () => {
    const ship = emptyShip("liner", "Test", 10, 4);
    const trial = input(ship, "mine");
    const state = runTrial(trial);
    const summary = explainTrial(state, trial);
    expect(summary.title).toBe("She sank");
    expect(summary.message).not.toMatch(/iceberg/i);
  });

  it("an island she survives leaves her stuck on the rocks", () => {
    const trial = input(walledShip("deck"), "island", 0);
    const state = runTrial(trial);
    expect(state.outcome).toBe("afloat");
    expect(explainTrial(state, trial).message).toMatch(/aground/);
  });

  it("a mine she survives says it blew a hole in her", () => {
    const trial = input(walledShip("deck"), "mine", 0);
    const state = runTrial(trial);
    expect(state.outcome).toBe("afloat");
    expect(explainTrial(state, trial).message).toMatch(/mine/);
  });
});
