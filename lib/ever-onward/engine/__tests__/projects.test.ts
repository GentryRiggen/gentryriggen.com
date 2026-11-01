import {
  canStartProject,
  doneProjects,
  isProjectDone,
  newRun,
  reconcileRun,
  shownProjects,
  startProject,
  tick,
  waitingProjectCount,
} from "../engine";
import { simulate } from "../sim";
import type { ProjectDef, RunState, UniverseDef } from "../types";
import { fixture } from "./fixtures";

const project = (id: string, extra: Partial<ProjectDef> = {}): ProjectDef => ({
  id,
  phase: "dim",
  name: id,
  description: "",
  costs: [{ resource: "know", amount: 5 }],
  ...extra,
});

const def: UniverseDef = {
  ...fixture,
  resources: [...fixture.resources, { id: "know", label: "Know-how" }],
  tick: (run, dt) => {
    fixture.tick(run, dt);
    run.resources.know = (run.resources.know ?? 0) + dt;
  },
  maxProjects: 2,
  projects: [
    project("first", {
      onDone: (run) => {
        run.mods.bonus = 1;
      },
    }),
    project("second", { costs: [{ resource: "coins", amount: 3 }] }),
    project("third"),
    project("later", { revealWhen: (run) => run.resources.know >= 20 }),
    project("elsewhere", { phase: "bright" }),
  ],
};

const withKnow = (run: RunState, know: number): RunState => ({
  ...run,
  resources: { ...run.resources, know },
});

describe("projects", () => {
  it("offers at most maxProjects, in order, and only in their phase", () => {
    const run = newRun(def);
    expect(shownProjects(def, run).map((p) => p.id)).toEqual([
      "first",
      "second",
    ]);
    expect(waitingProjectCount(def, run)).toBe(3);
  });

  it("reveals on a milestone, never before", () => {
    let run = newRun(def);
    expect(run.flags["project-seen-later"]).toBeUndefined();
    for (let i = 0; i < 25; i += 1) run = tick(def, run, 1);
    expect(run.flags["project-seen-later"]).toBe(true);
  });

  it("pays every cost, applies the effect and frees a slot", () => {
    const run = withKnow(newRun(def), 7);
    expect(canStartProject(def, run, "first")).toBe(true);
    const next = startProject(def, run, "first");
    expect(next.resources.know).toBe(2);
    expect(next.mods.bonus).toBe(1);
    expect(isProjectDone(next, "first")).toBe(true);
    expect(doneProjects(def, next).map((p) => p.id)).toEqual(["first"]);
    expect(shownProjects(def, next).map((p) => p.id)).toEqual([
      "second",
      "third",
    ]);
    // Done once: a second start does nothing.
    expect(startProject(def, withKnow(next, 50), "first").resources.know).toBe(
      50
    );
  });

  it("refuses what is unaffordable, not on offer, or in another phase", () => {
    const run = withKnow(newRun(def), 4);
    expect(startProject(def, run, "first")).toBe(run);
    expect(canStartProject(def, withKnow(run, 9), "third")).toBe(false);
    expect(canStartProject(def, withKnow(run, 9), "elsewhere")).toBe(false);
  });

  it("loads an old save with no project flags as nothing done", () => {
    const old = newRun(fixture);
    const loaded = reconcileRun(def, old);
    expect(doneProjects(def, loaded)).toEqual([]);
    expect(shownProjects(def, loaded).length).toBe(2);
  });

  it("lets a bot start the best affordable project", () => {
    const result = simulate(def, {
      maxSeconds: 60,
      strategy: { projects: "best", shopEvery: 5 },
    });
    expect(result.projectsDone.length).toBeGreaterThan(0);
    expect(isProjectDone(result.finalRun, result.projectsDone[0].id)).toBe(
      true
    );
  });

  it("never starts one for a bot without a project policy", () => {
    const result = simulate(def, { maxSeconds: 60 });
    expect(result.projectsDone).toEqual([]);
  });
});
