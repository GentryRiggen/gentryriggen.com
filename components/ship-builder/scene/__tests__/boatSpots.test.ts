import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { gridLength } from "@/lib/ship-builder/model/grid";
import type { PlacedPart, Ship } from "@/lib/ship-builder/model/types";
import { planCrowd } from "@/lib/ship-builder/crowd/plan";
import {
  BOAT_SHOWN_MAX,
  planEvacuation,
} from "@/lib/ship-builder/crowd/evacuation";
import { compartmentSpecsOf } from "@/lib/ship-builder/sim/compartments";
import { simShipFromStats } from "@/lib/ship-builder/sim/simShip";
import {
  buildTimeline,
  extendWithDescent,
  stateAt,
  timelineEnd,
} from "@/lib/ship-builder/sim/timeline";
import { trialFunnelsOf } from "@/lib/ship-builder/sim/trialFunnels";
import { attachPart, gridPart, testShip } from "@/lib/ship-builder/testing";
import { walkGridOf } from "@/lib/ship-builder/walk";
import { boatSpotsOf } from "../boatSpots";
import { boatSeatOffsets } from "../crowdView";
import { LIFEBOAT_HULLS } from "../lifeboatHulls";

/** A cabin block with a boat deck, a davit and a boat of `type` every third cell. */
function boatShip(type: string): Ship {
  const segments = 12;
  const length = segments * 3;
  const parts: PlacedPart[] = [];
  for (let x = 2; x < length - 2; x++) {
    for (let z = 0; z < 4; z++) {
      parts.push(gridPart(`c${x}_${z}`, "cabin-3rd", 0, x, z));
    }
  }
  for (let x = 4; x < length - 4; x += 3) {
    for (const z of [0, 3]) {
      parts.push(
        attachPart(`d${x}_${z}`, "davit", `c${x}_${z}`, `davit:${x}:${z}`),
        attachPart(`b${x}_${z}`, type as never, `d${x}_${z}`, "boat")
      );
    }
  }
  return testShip(parts, segments, 4);
}

describe("boatSpotsOf", () => {
  it("gives riders of a rib-boat seat spots and its own hull size", () => {
    const ship = boatShip("rib-boat");
    const grid = walkGridOf(ship);
    const crowd = planCrowd(ship, grid, analyzeShip(ship).stats);
    const length = gridLength(ship);
    const input = {
      ship: simShipFromStats(analyzeShip(ship).stats, ship.hull.beam),
      sea: "calm" as const,
      length,
      funnels: trialFunnelsOf(ship),
      iceberg: {
        compartments: compartmentSpecsOf(ship.hull),
        length,
        impactX: Math.round(length * 0.2),
        breakMode: "never" as const,
      },
    };
    const timeline = extendWithDescent(buildTimeline(input), input);
    const plan = planEvacuation(ship, grid, crowd, {
      input,
      stateAt: (t: number) => stateAt(timeline, t),
      end: timelineEnd(timeline),
    });
    const launches = (plan?.launches ?? []).filter((l) => l.riders.length > 0);
    expect(launches.length).toBeGreaterThan(0);

    const spots = boatSpotsOf(ship);
    for (const launch of launches) {
      const spot = spots.get(launch.boatId);
      expect(spot).toBeDefined();
      expect(spot!.hull).toEqual(LIFEBOAT_HULLS["rib-boat"]);
      expect(spot!.hull).not.toEqual(LIFEBOAT_HULLS["lifeboat-standard"]);
      expect(boatSeatOffsets(launch.riders.length, spot!.hull).length).toBe(
        Math.min(launch.riders.length, BOAT_SHOWN_MAX)
      );
    }
  });

  it("covers every seated boat, rib-boats and rowboats included", () => {
    expect(boatSpotsOf(boatShip("rowboat")).size).toBeGreaterThan(0);
    expect([...boatSpotsOf(boatShip("rowboat")).values()][0].hull).toEqual(
      LIFEBOAT_HULLS.rowboat
    );
  });
});
