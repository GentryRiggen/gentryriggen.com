import { performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { RECALL_ACTION, wildShare } from "../design";
import { def, runAtPhaseStart } from "./fixtures";

/** The sky with a fleet out and the dials open. */
function openSky(): RunState {
  const start = runAtPhaseStart(2);
  return tick(
    def,
    {
      ...start,
      owned: { ...start.owned, collector: 3, probe: 1 },
      flags: { ...start.flags, "sky-dials": true },
      resources: { ...start.resources, probes: 20, collectors: 3 },
    },
    1
  );
}

describe("the sky's fleet", () => {
  it("a fleet with strays still grows and never stops, and bringing them home is possible", () => {
    const run = openSky();
    const stray: RunState = {
      ...run,
      resources: { ...run.resources, skWild: 10 },
    };
    expect(tick(def, stray, 1).resources.probes).toBeGreaterThan(
      stray.resources.probes
    );
    const home = performAction(def, stray, RECALL_ACTION);
    expect(home.resources.skRecall).toBeGreaterThan(0);
    expect(wildShare(stray)).toBeGreaterThan(0);
  });
});
