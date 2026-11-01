import { simulate, type Strategy } from "../../../engine/sim";
import { prestigeUpgradeCost } from "../../../engine/prestige";
import { newUniverseSave } from "../../../engine/prestige";
import { def, MODEST_PRESTIGE } from "./fixtures";

const MIN = 60;
/** Target phase lengths in seconds: ~40 / 45 / 45 / 20 minutes. */
const TARGETS = [40 * MIN, 45 * MIN, 45 * MIN, 20 * MIN];

function phaseLengths(result: ReturnType<typeof simulate>): number[] {
  const marks = [0, ...result.phases.map((p) => p.t), result.finishTime ?? 0];
  return TARGETS.map((_, i) => marks[i + 1] - marks[i]);
}

/** Taps a lot for the first 10 minutes of each phase, then mostly watches. */
const REALISTIC: Strategy = {
  tapRate: (run) => {
    const phaseStart = run.transitions.at(-1)?.at ?? 0;
    return run.time - phaseStart < 10 * MIN ? 3 : 0.3;
  },
};

function expectOnTarget(result: ReturnType<typeof simulate>) {
  expect(result.finished).toBe(true);
  expect(result.finishTime!).toBeGreaterThanOrEqual(1.5 * 3600);
  expect(result.finishTime!).toBeLessThanOrEqual(4 * 3600);
  phaseLengths(result).forEach((seconds, i) => {
    expect(seconds).toBeGreaterThanOrEqual(TARGETS[i] * 0.5);
    expect(seconds).toBeLessThanOrEqual(TARGETS[i] * 2);
  });
  expect(result.longestMilestoneGap.seconds).toBeLessThanOrEqual(3 * MIN);
}

describe("Keep the Light On balance", () => {
  const realistic = simulate(def, {
    maxSeconds: 6 * 3600,
    step: 1,
    strategy: REALISTIC,
  });
  it("finishes on target for a player who mostly watches after the start", () => {
    expectOnTarget(realistic);
  });

  const first = simulate(def, { maxSeconds: 5 * 3600, step: 1 });
  const second = simulate(def, {
    maxSeconds: 5 * 3600,
    step: 1,
    prestige: MODEST_PRESTIGE,
  });

  it("finishes the first run on target for a player who taps all the time", () => {
    expectOnTarget(first);
  });

  it("never goes 3 minutes without a purchase or something new", () => {
    expect(first.longestMilestoneGap.seconds).toBeLessThanOrEqual(3 * MIN);
    expect(second.longestMilestoneGap.seconds).toBeLessThanOrEqual(3 * MIN);
  });

  it("is a lot faster with a modest prestige purchase", () => {
    expect(second.finished).toBe(true);
    expect(second.finishTime! / first.finishTime!).toBeLessThanOrEqual(0.7);
  });

  it("keeps that purchase within the embers one run earns", () => {
    const save = newUniverseSave(def);
    const cost = Object.entries(MODEST_PRESTIGE).reduce(
      (sum, [id, levels]) =>
        sum +
        Array.from({ length: levels }).reduce<number>(
          (acc, _, i) =>
            acc +
            (prestigeUpgradeCost(
              def,
              { ...save, prestigeUpgrades: { [id]: i } },
              id
            ) ?? 0),
          0
        ),
      0
    );
    const earned =
      def.phases.length * def.prestige.phaseEmbers +
      def.prestige.completionEmbers;
    expect(cost).toBeLessThanOrEqual(earned);
  });
});
