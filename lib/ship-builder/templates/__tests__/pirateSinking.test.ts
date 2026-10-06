import { CELLS_PER_SEGMENT } from "../../model/grid";
import { computeStats } from "../../model/stats";
import { compartmentSpecsOf } from "../../sim/compartments";
import { runTrial } from "../../sim/seaTrial";
import { simShipFromStats } from "../../sim/simShip";
import type { SimSea } from "../../sim/types";
import { PIRATE_TEMPLATES } from "../pirate";

/** Mirrors SINK_IMPACT_FRACTION in state/store.ts ("Hit with an iceberg"). */
const WALK_IMPACT_FRACTION = 0.2;
const SEAS: SimSea[] = ["calm", "choppy", "stormy"];

describe("hitting a pirate ship with an iceberg while walking", () => {
  it.each(
    PIRATE_TEMPLATES.flatMap((template) =>
      SEAS.map((sea) => [template.id, sea, template] as const)
    )
  )("sinks %s in %s seas", (_id, sea, template) => {
    const ship = template.build();
    const length = ship.hull.lengthSegments * CELLS_PER_SEGMENT;
    const state = runTrial({
      ship: simShipFromStats(computeStats(ship), ship.hull.beam),
      sea,
      iceberg: {
        compartments: compartmentSpecsOf(ship.hull),
        length,
        impactX: length * WALK_IMPACT_FRACTION,
        breakMode: "real",
      },
    });
    expect(state.outcome).toBe("sank");
  });
});
