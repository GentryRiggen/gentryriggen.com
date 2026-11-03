import { cloneRun, manualAction, newRun } from "../../engine/engine";
import { describeChanges } from "../../engine/changes";
import type { OwnedGate } from "../../engine/goal";
import { simulate } from "../../engine/sim";
import type { RunState, UniverseDef } from "../../engine/types";
import { SCORED_UNIVERSES } from "../scored";

/**
 * Nothing the game hands the player may leave them guessing: every currency
 * says what it is for, every tap says what it does and shows what it
 * changed, and anything that needs looking after sits on the HUD.
 */

const UNIVERSES = Object.values(SCORED_UNIVERSES);

/** Runs taken every few minutes through a whole playthrough. */
function snapshots(
  def: UniverseDef,
  bots: () => { dawdler: object }
): RunState[] {
  const out: RunState[] = [];
  let run = newRun(def);
  for (let i = 0; i < 90 && !run.complete; i++) {
    run = simulate(def, {
      strategy: bots().dawdler,
      maxSeconds: run.time + 150,
      startRun: run,
    }).finalRun;
    out.push(cloneRun(run));
  }
  return out;
}

const PLAYS = UNIVERSES.map(({ def, bots }) => ({
  def,
  runs: snapshots(def, bots),
}));

describe.each(UNIVERSES.map(({ def }) => [def.title, def] as const))(
  "%s says what everything is for",
  (_title, def) => {
    test("every part says what a tap does", () => {
      for (const phase of def.phases) expect(phase.tapDoes).toBeTruthy();
    });

    test("every currency a part earns or spends has a purpose", () => {
      def.phases.forEach((phase, index) => {
        const run = newRun(def);
        run.phase = index;
        phase.onEnter?.(run);
        const spent = new Set<string>([phase.manualResource]);
        for (const u of def.upgrades)
          if (!u.phases || u.phases.includes(phase.id)) spent.add(u.currency);
        for (const p of def.projects ?? [])
          if (p.phase === phase.id)
            p.costs.forEach((c) => spent.add(c.resource));
        for (const a of def.actions ?? []) {
          if (a.phases && !a.phases.includes(phase.id)) continue;
          const cost = a.describe(run).cost;
          if (cost) spent.add(cost.resource);
        }
        for (const id of spent) {
          const resource = def.resources.find((r) => r.id === id);
          expect({ phase: phase.id, id, purpose: resource?.purpose }).toEqual({
            phase: phase.id,
            id,
            // Short enough to fit beside its name on a phone's top bar.
            purpose: expect.stringMatching(/^.{4,36}$/),
          });
        }
      });
    });

    test("every hidden milestone can name what unlocks it", () => {
      const goal = def.goalMeter;
      if (!goal) return;
      for (let index = 0; index < def.phases.length; index++) {
        const run = newRun(def);
        run.phase = index;
        def.phases[index].onEnter?.(run);
        const view = goal(run);
        expect(view?.next ?? "").not.toMatch(/Keep buying helpers/);
      }
      // Every gated milestone says what it waits for.
      for (const u of def.upgrades) {
        if (!u.visibleWhen) continue;
        const needs = (u.visibleWhen as Partial<OwnedGate>).needs;
        if (needs)
          expect(def.upgrades.some((o) => o.id === needs.upgradeId)).toBe(true);
      }
    });
  }
);

describe.each(PLAYS.map((p) => [p.def.title, p] as const))(
  "%s through a whole playthrough",
  (_title, { def, runs }) => {
    test("a tap always shows what it changed", () => {
      for (const run of runs) {
        if (run.complete) continue;
        const phase = def.phases[run.phase];
        const lines = describeChanges(
          def,
          run,
          manualAction(def, run),
          phase.manualResource
        );
        expect({ phase: phase.id, t: run.time, lines }).toEqual({
          phase: phase.id,
          t: run.time,
          lines: expect.arrayContaining([expect.stringMatching(/\w/)]),
        });
      }
    });

    test("anything that needs looking after is on the HUD", () => {
      for (const run of runs) {
        if (run.complete) continue;
        for (const c of def.consumables ?? []) {
          if (c.level(run) === null) continue;
          expect({
            id: c.id,
            phase: run.phase,
            gauge: !!def.gauge?.(run),
          }).toEqual({ id: c.id, phase: run.phase, gauge: true });
        }
      }
    });

    test("the goal line always names a step", () => {
      for (const run of runs) {
        if (run.complete) continue;
        const goal = def.goalMeter?.(run);
        expect(goal?.next).toBeTruthy();
        expect(goal?.next).not.toMatch(/Grow your helpers/);
      }
    });
  }
);
