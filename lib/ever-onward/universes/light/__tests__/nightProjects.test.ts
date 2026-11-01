import {
  newRun,
  reconcileRun,
  shownProjects,
  startProject,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { NIGHT_PROJECTS } from "../projects";
import {
  crankPower,
  demandMW,
  knowhowPerSecond,
  powerPerSecond,
  strainPerSecond,
} from "../tick";

const nightRun = (
  owned: Record<string, number> = {},
  resources: Record<string, number> = {}
): RunState => {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    phase: 1,
    owned: { gen1: 5, gen2: 5, gen3: 4, gen4: 1, ...owned },
    resources: {
      ...base.resources,
      night: 80,
      grid: 90,
      knowhow: 10_000,
      power: 1e6,
      rushRides: 5,
      ...resources,
    },
  });
};

describe("No More Night projects", () => {
  it("has 8 to 12, each with a catch and a visible effect", () => {
    expect(NIGHT_PROJECTS.length).toBeGreaterThanOrEqual(8);
    expect(NIGHT_PROJECTS.length).toBeLessThanOrEqual(12);
    const run = nightRun();
    for (const project of NIGHT_PROJECTS) {
      expect(project.tradeOff).toBeTruthy();
      expect(project.effectPreview?.(run)).toBeTruthy();
      expect(project.costs[0].resource).toBe("knowhow");
    }
  });

  it("reveals none on a timer: a night with nothing built offers nothing", () => {
    let run = nightRun(
      { gen1: 0, gen2: 0, gen3: 0, gen4: 0 },
      { rushRides: 0 }
    );
    for (let i = 0; i < 600; i += 1) run = tick(def, run, 1);
    expect(shownProjects(def, run)).toEqual([]);
  });

  it("earns know-how from every plant, and from grid work", () => {
    const run = nightRun({}, { knowhow: 0 });
    expect(knowhowPerSecond(run)).toBeGreaterThan(0);
    expect(tick(def, run, 1).resources.knowhow).toBeGreaterThan(0);
  });

  it("does what each card says", () => {
    const base = nightRun();
    const done = (id: string): RunState => ({
      ...base,
      flags: { ...base.flags, [`project-${id}`]: true },
    });
    expect(
      startProject(def, base, "night-school").flags["project-night-school"]
    ).toBe(true);
    expect(powerPerSecond(done("smart-meters"))).toBeGreaterThan(
      powerPerSecond(base)
    );
    expect(demandMW(done("smart-meters"))).toBeGreaterThan(demandMW(base));
    expect(demandMW(done("lamplighters"))).toBeLessThan(demandMW(base));
    expect(strainPerSecond(done("line-patrols"))).toBeLessThan(
      strainPerSecond(base)
    );
    expect(knowhowPerSecond(done("night-school"))).toBeGreaterThan(
      knowhowPerSecond(base)
    );
  });

  it("loads an old night save with nothing done and the cards on offer", () => {
    const old = nightRun({}, { knowhow: 0 });
    const loaded = reconcileRun(def, old);
    expect(shownProjects(def, loaded).length).toBe(3);
  });

  it("keeps a crank turn worth something however big the grid gets", () => {
    const run = nightRun({ gen4: 8 });
    expect((crankPower(run) * 3) / powerPerSecond(run)).toBeGreaterThan(0.005);
  });
});
