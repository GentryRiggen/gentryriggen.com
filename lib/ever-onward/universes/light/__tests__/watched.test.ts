import { canPerformAction, performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { gridFactor, headingFactor } from "../tick";
import { def, runAtPhaseStart } from "./fixtures";

/** The night with enough power made that the grid is in play. */
function strainedNight(): RunState {
  const start = runAtPhaseStart(1);
  return {
    ...start,
    owned: { ...start.owned, gen1: 3 },
    resources: { ...start.resources, grid: 20, supply: 9 },
  };
}

/** The sky with a probe out, so the fleet can drift. */
function driftingSky(): RunState {
  const start = runAtPhaseStart(2);
  return {
    ...start,
    owned: { ...start.owned, collector: 1 },
    resources: { ...start.resources, probes: 20, heading: 10, collectors: 1 },
  };
}

describe("the watched numbers (grid in the night, heading in the sky)", () => {
  it("a strained grid dims cities but never to zero", () => {
    const run = strainedNight();
    run.resources.grid = 0;
    expect(gridFactor(run)).toBeGreaterThan(0);
    expect(tick(def, run, 1).resources.power).toBeGreaterThan(
      run.resources.power
    );
  });

  it("balancing the grid is free and restores it", () => {
    const run = strainedNight();
    expect(canPerformAction(def, run, "balance-grid")).toBe(true);
    const fixed = performAction(def, run, "balance-grid");
    expect(fixed.resources.grid).toBe(100);
    expect(canPerformAction(def, fixed, "balance-grid")).toBe(false);
  });

  it("the smart grid fixes the strain by itself and retires the button", () => {
    const run = strainedNight();
    run.owned["grid-1"] = 1;
    run.owned["grid-2"] = 1;
    const later = tick(def, run, 1);
    expect(later.resources.grid).toBeGreaterThan(80);
    expect(canPerformAction(def, later, "balance-grid")).toBe(false);
  });

  it("a drifting fleet slows down but never stops, and a correction is free", () => {
    const run = driftingSky();
    expect(headingFactor(run)).toBeGreaterThan(0);
    expect(tick(def, run, 1).resources.probes).toBeGreaterThan(
      run.resources.probes
    );
    const fixed = performAction(def, run, "correct-course");
    expect(fixed.resources.heading).toBe(100);
  });

  it("an evening rush and a solar flare pay a bonus when claimed", () => {
    const night = strainedNight();
    night.resources.rush = 30;
    const afterRush = performAction(def, night, "ride-rush");
    expect(afterRush.resources.power).toBeGreaterThan(night.resources.power);
    expect(afterRush.resources.rush).toBe(0);

    const sky = driftingSky();
    sky.resources.flare = 30;
    const afterFlare = performAction(def, sky, "catch-flare");
    expect(afterFlare.resources.energy).toBeGreaterThan(sky.resources.energy);
  });
});
