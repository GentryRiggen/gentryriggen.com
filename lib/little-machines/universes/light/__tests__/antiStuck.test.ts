import { manualGain } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { def, drain, runAtPhaseStart, runAtTime } from "./fixtures";

const MIN = 60;

/** Variants of a state at the start of a phase, each worse than the last. */
function adversarialStates(phase: number): { name: string; run: RunState }[] {
  const start = runAtPhaseStart(phase);
  const wiped = drain(start);
  // Also lose everything bought in this phase.
  const phaseId = def.phases[phase].id;
  const owned = { ...wiped.owned };
  for (const upgrade of def.upgrades) {
    if (upgrade.phases?.includes(phaseId)) delete owned[upgrade.id];
  }
  return [
    { name: "phase start", run: start },
    { name: "resources drained", run: wiped },
    { name: "drained and nothing built", run: { ...wiped, owned } },
  ];
}

describe("never stuck: adversarial states", () => {
  for (let phase = 0; phase < def.phases.length; phase += 1) {
    describe(`phase ${def.phases[phase].id}`, () => {
      for (const { name, run } of adversarialStates(phase)) {
        it(`${name}: a tap always earns something`, () => {
          expect(manualGain(def, run)).toBeGreaterThan(0);
        });

        it(`${name}: tapping reaches a purchase within 5 minutes`, () => {
          const result = simulate(def, {
            startRun: run,
            maxSeconds: 5 * MIN,
            step: 1,
          });
          const progressed =
            result.purchases.length > 0 ||
            result.phases.length > 0 ||
            result.finished;
          expect(progressed).toBe(true);
        });
      }
    });
  }

  it("Phase 4 can always be finished from the worst state", () => {
    const worst = adversarialStates(3).at(-1)!.run;
    const result = simulate(def, {
      startRun: worst,
      maxSeconds: 2 * 3600,
      step: 1,
    });
    expect(result.finished).toBe(true);
  });
});

describe("never stuck: drained states from a real run", () => {
  const FRACTIONS = [0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 0.97];
  const total = simulate(def, { maxSeconds: 5 * 3600, step: 1 }).finishTime!;

  it.each(FRACTIONS)("at %s of the run, drained, it still finishes", (f) => {
    const sample = runAtTime(total * f);
    const drained = drain(sample);
    expect(manualGain(def, drained)).toBeGreaterThan(0);
    const remaining = total - sample.time;
    const result = simulate(def, {
      startRun: drained,
      maxSeconds: remaining * 1.5 + 15 * MIN,
      step: 1,
    });
    expect(result.finished).toBe(true);
    expect(result.longestGap.seconds).toBeLessThanOrEqual(5 * MIN);
  });
});
