import { prestigeUpgradeCost } from "../../../engine/prestige";
import { newUniverseSave } from "../../../engine/prestige";
import { simulate } from "../../../engine/sim";
import type { UpgradeDef } from "../../../engine/types";
import { ACTIVE, def, MODEST_PRESTIGE, REALISTIC } from "./fixtures";

const MIN = 60;
/**
 * Target phase lengths in seconds: ~25 / 45 / 45 / 20 minutes. The Coast was
 * 40 minutes of waiting; the rework (a purchase every 10 to 20 seconds early,
 * a lighthouse every few minutes) makes it a quick, felt opening.
 */
const TARGETS = [25 * MIN, 45 * MIN, 45 * MIN, 20 * MIN];
/**
 * The least median gap between new cards, per part. The Coast is hands-on and
 * its cards arrive with the keepers in the first minutes, so it is shorter.
 */
const MIN_REVEAL_GAP: Record<string, number> = { coast: 40 };
const PHASE_IDS = def.phases.map((p) => p.id);

type Result = ReturnType<typeof simulate>;

function phaseLengths(result: Result): number[] {
  const marks = [0, ...result.phases.map((p) => p.t), result.finishTime ?? 0];
  return TARGETS.map((_, i) => marks[i + 1] - marks[i]);
}

/** When each upgrade of `phaseId` first showed up, in order. */
function revealTimes(
  result: Result,
  phaseId: string,
  isCounted: (u: UpgradeDef) => boolean = () => true
): number[] {
  const inPhase = new Set(
    def.upgrades
      .filter((u) => u.phases?.includes(phaseId) && isCounted(u))
      .map((u) => u.id)
  );
  return result.unlocks
    .filter((u) => inPhase.has(u.id))
    .map((u) => u.t)
    .sort((a, b) => a - b);
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** The most reveals that fall inside any window of `seconds`. */
function mostInWindow(times: number[], seconds: number): number {
  return Math.max(
    0,
    ...times.map((t) => times.filter((x) => x >= t && x < t + seconds).length)
  );
}

const fractionAtLeast = (counts: number[], n: number): number =>
  counts.filter((c) => c >= n).length / counts.length;

function expectOnTarget(result: Result) {
  expect(result.finished).toBe(true);
  expect(result.finishTime!).toBeGreaterThanOrEqual(1.5 * 3600);
  expect(result.finishTime!).toBeLessThanOrEqual(4 * 3600);
  phaseLengths(result).forEach((seconds, i) => {
    expect(seconds).toBeGreaterThanOrEqual(TARGETS[i] * 0.5);
    expect(seconds).toBeLessThanOrEqual(TARGETS[i] * 2);
  });
  expect(result.longestMilestoneGap.seconds).toBeLessThanOrEqual(4 * MIN);
}

describe("Keep the Light On balance", () => {
  // Taps a lot for the first 10 minutes of each phase, then mostly watches;
  // shops every 10 seconds; buys oil when it is cheap.
  const realistic = simulate(def, {
    maxSeconds: 6 * 3600,
    step: 1,
    strategy: REALISTIC,
  });
  const active = simulate(def, {
    maxSeconds: 5 * 3600,
    step: 1,
    strategy: ACTIVE,
  });
  const second = simulate(def, {
    maxSeconds: 5 * 3600,
    step: 1,
    strategy: REALISTIC,
    prestige: MODEST_PRESTIGE,
  });

  it("finishes on target for a player who mostly watches after the start", () => {
    expectOnTarget(realistic);
  });

  it("finishes on target for a player who taps all the time", () => {
    expectOnTarget(active);
  });

  it("is a lot faster with a modest prestige purchase", () => {
    expect(second.finished).toBe(true);
    expect(second.finishTime! / realistic.finishTime!).toBeLessThanOrEqual(0.7);
    expect(second.longestMilestoneGap.seconds).toBeLessThanOrEqual(4 * MIN);
  });

  describe("new upgrades arrive slowly", () => {
    it.each(PHASE_IDS)("%s: a minute or more between reveals", (phaseId) => {
      const times = revealTimes(realistic, phaseId);
      const gaps = times.slice(1).map((t, i) => t - times[i]);
      expect(times.length).toBeGreaterThan(3);
      expect(median(gaps)).toBeGreaterThanOrEqual(
        MIN_REVEAL_GAP[phaseId] ?? MIN
      );
    });

    it.each(PHASE_IDS)("%s: at most 6 reveals in any 5 minutes", (phaseId) => {
      // The battery chain has a place of its own (one step on offer at a
      // time, so it never takes a slot from the shop's three cards): the
      // shop's cards are counted here, and the chain below.
      const times = revealTimes(realistic, phaseId, (u) => !u.hasOwnSlot);
      // The Coast is a hands-on opening: its cards arrive with the keepers.
      const most = phaseId === "coast" ? 8 : 6;
      expect(mostInWindow(times, 5 * MIN)).toBeLessThanOrEqual(most);
    });

    it("night: with the battery chain too, at most 9 reveals in any 5 minutes", () => {
      expect(
        mostInWindow(revealTimes(realistic, "night"), 5 * MIN)
      ).toBeLessThanOrEqual(9);
    });
  });

  describe("the shop stays scarce", () => {
    it("rarely has 3 things affordable at once", () => {
      expect(fractionAtLeast(realistic.affordableAtShop, 3)).toBeLessThan(0.1);
      expect(fractionAtLeast(active.affordableAtShop, 3)).toBeLessThan(0.1);
    });

    it("has 2 things affordable only some of the time", () => {
      expect(fractionAtLeast(realistic.affordableAtShop, 2)).toBeLessThan(0.3);
      expect(fractionAtLeast(active.affordableAtShop, 2)).toBeLessThan(0.3);
    });

    it("is a few dozen purchases a phase, not hundreds", () => {
      expect(realistic.purchases.length).toBeLessThan(150);
      expect(active.purchases.length).toBeLessThan(150);
    });
  });

  it("has the player buy oil by hand during the coast", () => {
    expect(realistic.actionsDone.some((a) => a.id === "buy-oil")).toBe(true);
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
