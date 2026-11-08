import { performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { headingFactor } from "../tick";
import { def, runAtPhaseStart } from "./fixtures";

/** The sky with a probe out, so the fleet can drift. */
function driftingSky(): RunState {
  const start = runAtPhaseStart(2);
  return {
    ...start,
    owned: { ...start.owned, collector: 1 },
    resources: { ...start.resources, probes: 20, heading: 10, collectors: 1 },
  };
}

describe("the watched numbers (heading in the sky)", () => {
  it("a drifting fleet slows down but never stops, and a correction is free", () => {
    const run = driftingSky();
    expect(headingFactor(run)).toBeGreaterThan(0);
    expect(tick(def, run, 1).resources.probes).toBeGreaterThan(
      run.resources.probes
    );
    const fixed = performAction(def, run, "correct-course");
    expect(fixed.resources.heading).toBe(100);
  });

  it("a solar flare pays a bonus when claimed", () => {
    const sky = driftingSky();
    sky.resources.flare = 30;
    const afterFlare = performAction(def, sky, "catch-flare");
    expect(afterFlare.resources.energy).toBeGreaterThan(sky.resources.energy);
  });
});
