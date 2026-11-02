import {
  canPerformAction,
  canStartProject,
  newRun,
  performAction,
  reconcileRun,
  shownProjects,
  startProject,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import {
  OVERDRIVE_ACTION,
  isOverdriveOn,
  isOverdriveOpen,
  overdriveCost,
} from "../overdrive";
import {
  appetite,
  collectorEnergyPerSecond,
  driftPerSecond,
  knowhowPerSecond,
  powerPerSecond,
  strainPerSecond,
} from "../tick";
import { TUNING } from "../tuning";

const O = TUNING.overdrive;

/** A night run with the plants going, the grid steady and know-how in hand. */
function nightRun(knowhow = 100): RunState {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    phase: 1,
    owned: { gen1: 5, gen2: 3 },
    resources: { ...base.resources, night: 99, power: 5000, knowhow },
  });
}

/** A sky run with collectors, one probe and know-how in hand. */
function skyRun(knowhow = 300): RunState {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    phase: 2,
    owned: { collector: 6, probe: 1, "copy-1": 1 },
    resources: {
      ...base.resources,
      energy: 50000,
      probes: 20,
      collectors: 6,
      knowhow,
    },
  });
}

describe("know-how has two hungry sinks", () => {
  it("is earned in the sky too, and shown there", () => {
    const sky = skyRun();
    expect(knowhowPerSecond(sky)).toBeGreaterThan(0);
    const later = tick(def, sky, 10);
    expect(later.resources.knowhow).toBeGreaterThan(sky.resources.knowhow);
    expect(def.resources.find((r) => r.id === "knowhow")?.phases).toEqual([
      "night",
      "sky",
    ]);
  });

  it("can pay for a project or a minute of overdrive, not both", () => {
    // Enough for Smart meters (50) or overdrive (30), but not for both.
    const run = nightRun(60);
    expect(canStartProject(def, run, "smart-meters")).toBe(true);
    expect(canPerformAction(def, run, OVERDRIVE_ACTION)).toBe(true);
    const driven = performAction(def, run, OVERDRIVE_ACTION);
    expect(driven.resources.knowhow).toBeCloseTo(60 - O.nightCost);
    expect(canStartProject(def, driven, "smart-meters")).toBe(false);
    const started = startProject(def, run, "smart-meters");
    expect(started.resources.knowhow).toBeCloseTo(10);
    expect(canPerformAction(def, started, OVERDRIVE_ACTION)).toBe(false);
  });

  it("is not offered before the plants (or the first probe) are there", () => {
    expect(isOverdriveOpen(newRun(def))).toBe(false);
    const young = reconcileRun(def, {
      ...nightRun(),
      owned: { gen1: 5, gen2: 1 },
    });
    expect(canPerformAction(def, young, OVERDRIVE_ACTION)).toBe(false);
    const noProbe = reconcileRun(def, {
      ...skyRun(),
      owned: { collector: 6 },
    });
    expect(isOverdriveOpen(noProbe)).toBe(false);
    expect(isOverdriveOpen(skyRun())).toBe(true);
  });
});

describe("overdrive", () => {
  it("doubles what the night pays and triples the grid's strain, for a minute", () => {
    const run = nightRun();
    const before = powerPerSecond(run);
    const strain = strainPerSecond(run);
    const driven = performAction(def, run, OVERDRIVE_ACTION);
    expect(isOverdriveOn(driven)).toBe(true);
    expect(powerPerSecond(driven)).toBeCloseTo(before * O.boost, 5);
    expect(strainPerSecond(driven)).toBeCloseTo(strain * O.strain, 5);
    let t = driven;
    for (let i = 0; i < O.seconds; i += 1) t = tick(def, t, 1);
    expect(isOverdriveOn(t)).toBe(false);
    expect(t.resources.odRuns).toBe(1);
  });

  it("gives half the know-how back to a run that held steady", () => {
    let run = performAction(def, nightRun(100), OVERDRIVE_ACTION);
    for (let i = 0; i < O.seconds + 1; i += 1) {
      // A player who tends the grid every few seconds.
      if (i % 5 === 0)
        run = { ...run, resources: { ...run.resources, grid: 100 } };
      run = tick(def, run, 1);
    }
    const spent = 100 - O.nightCost;
    const gained = run.resources.knowhow - spent;
    // The plants also teach a little while they run.
    expect(gained).toBeGreaterThanOrEqual(O.nightCost * O.refund);
    expect(run.resources.odCleanRuns).toBe(1);
    expect(run.resources.odKind).toBe(1);
  });

  it("gives nothing back when the grid slips, and the plants still paid double", () => {
    let run = performAction(def, nightRun(100), OVERDRIVE_ACTION);
    run = { ...run, resources: { ...run.resources, grid: O.cleanAbove - 5 } };
    const power = run.resources.power;
    for (let i = 0; i < O.seconds + 1; i += 1) run = tick(def, run, 1);
    expect(run.resources.odCleanRuns ?? 0).toBe(0);
    expect(run.resources.odKind).toBe(2);
    expect(run.resources.power).toBeGreaterThan(power);
  });

  it("works the same way in the sky, on the fleet's heading", () => {
    const run = skyRun();
    const energy = collectorEnergyPerSecond(run);
    const drift = driftPerSecond(run);
    const driven = performAction(def, run, OVERDRIVE_ACTION);
    expect(overdriveCost(run)).toBe(O.skyCost);
    expect(collectorEnergyPerSecond(driven)).toBeCloseTo(energy * O.boost, 5);
    expect(driftPerSecond(driven)).toBeCloseTo(drift * O.strain, 5);
    let t = driven;
    t = { ...t, resources: { ...t.resources, heading: 10 } };
    for (let i = 0; i < O.seconds + 1; i += 1) t = tick(def, t, 1);
    expect(t.resources.odKind).toBe(2);
  });

  it("is never read as income by the scorecard's probes", () => {
    const run = performAction(def, nightRun(), OVERDRIVE_ACTION);
    const view = def.incomeView?.(run);
    expect(view && isOverdriveOn(view)).toBe(false);
  });

  it("reads an old save with no overdrive as never run", () => {
    const run = nightRun();
    const old: RunState = { ...run, resources: { ...run.resources } };
    for (const id of ["odLeft", "odClean", "odRuns", "odKind", "flaresCaught"])
      delete old.resources[id];
    const loaded = reconcileRun(def, old);
    expect(isOverdriveOn(loaded)).toBe(false);
    expect(canPerformAction(def, loaded, OVERDRIVE_ACTION)).toBe(true);
  });
});

describe("the sky's projects", () => {
  it("are offered by milestones, in the sky only", () => {
    const sky = skyRun();
    const ids = shownProjects(def, sky).map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["star-atlas", "mirror-polish", "probe-school"])
    );
    expect(shownProjects(def, nightRun()).map((p) => p.id)).not.toContain(
      "star-atlas"
    );
  });

  it("each does what it says, and carries its catch", () => {
    const sky = skyRun();
    const withProject = (id: string): RunState => startProject(def, sky, id);
    expect(appetite(withProject("star-atlas"))).toBeCloseTo(
      appetite(sky) * TUNING.projects.sky.atlasBoost
    );
    const polished = withProject("mirror-polish");
    expect(collectorEnergyPerSecond(polished)).toBeCloseTo(
      collectorEnergyPerSecond(sky) * TUNING.projects.sky.polishBoost
    );
    expect(driftPerSecond(polished)).toBeGreaterThan(driftPerSecond(sky));
    for (const project of shownProjects(def, sky))
      expect(project.tradeOff).toBeTruthy();
  });
});
