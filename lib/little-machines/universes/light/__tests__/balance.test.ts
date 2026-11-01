import { simulate } from "../../../engine/sim";
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

describe("Keep the Light On balance", () => {
  const first = simulate(def, { maxSeconds: 5 * 3600, step: 1 });
  const second = simulate(def, {
    maxSeconds: 5 * 3600,
    step: 1,
    prestige: MODEST_PRESTIGE,
  });

  it("finishes the first run in 1.5 to 4 hours", () => {
    expect(first.finished).toBe(true);
    expect(first.finishTime!).toBeGreaterThanOrEqual(1.5 * 3600);
    expect(first.finishTime!).toBeLessThanOrEqual(4 * 3600);
  });

  it("keeps each phase within half to double its target", () => {
    const lengths = phaseLengths(first);
    lengths.forEach((seconds, i) => {
      expect(seconds).toBeGreaterThanOrEqual(TARGETS[i] * 0.5);
      expect(seconds).toBeLessThanOrEqual(TARGETS[i] * 2);
    });
  });

  it("never goes 3 minutes without a purchase or something new", () => {
    expect(first.longestGap.seconds).toBeLessThanOrEqual(3 * MIN);
    expect(second.longestGap.seconds).toBeLessThanOrEqual(3 * MIN);
  });

  it("is a lot faster with a modest prestige purchase", () => {
    expect(second.finished).toBe(true);
    expect(second.finishTime! / first.finishTime!).toBeLessThanOrEqual(0.8);
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
