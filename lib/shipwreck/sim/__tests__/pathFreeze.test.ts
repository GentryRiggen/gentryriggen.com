import type { Opening, ShipSpec } from "../../ships/types";
import { simulate } from "../run";
import { towerShip } from "./testShips";

/**
 * A ship on a drift path does not freeze (`floating-steady`) while the
 * path still carries her: a frozen hull would glide on through a rock
 * without touching it. The tower ship takes a little water early and is
 * steady long before her path takes her over a rock that comes up to 3 m
 * (under her 7 m draught) at 3,000 s: she must touch it.
 */

const hole: Opening = {
  compartmentId: "h5",
  areaM2: 1,
  zLow: 1,
  zHigh: 2,
  x: 10,
  side: "port",
};

function ship(): ShipSpec {
  return {
    ...towerShip({ seaDepthM: 100 }),
    seabed: {
      shore: [
        [-50000, 20000],
        [50000, 20000],
      ],
      seaSide: -1,
      profile: [[0, 100]],
      // Under her starboard bilge (the box hull bears on its corners).
      rocks: [{ x: 3000, y: -15, radiusM: 60, topDepthM: 3 }],
    },
    headway: {
      startMs: 0,
      path: [
        [0, 0, 0, 0],
        [4000, 4000, 0, 0],
      ],
    },
  };
}

describe("a drift path and the steady freeze", () => {
  it("keeps her live on the path, so she touches the rock in her way", () => {
    const track = simulate(ship(), [hole], { endT: 4500 });
    const touched = track.frames.find((f) => f.groundedParts.length > 0);
    expect(touched).toBeDefined();
    // Over the rock's slope, before the path ends.
    expect(touched!.t).toBeGreaterThan(2500);
    expect(touched!.t).toBeLessThan(3100);
    const steady = track.events.find((e) => e.kind === "floating-steady");
    if (steady) expect(steady.t).toBeGreaterThanOrEqual(touched!.t);
    // Held where she touched (no glide through the rock).
    const last = track.frames[track.frames.length - 1].bodies[0];
    expect(last.x).toBeLessThan(3000);
  });
});
