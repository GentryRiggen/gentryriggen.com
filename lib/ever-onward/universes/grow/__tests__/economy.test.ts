import type { RunState } from "../../../engine/types";
import { UPGRADES } from "../upgrades";
import { incomePerSecond, manualPerTap, stacked } from "../tick";
import { runAtPhaseStart } from "./fixtures";

/**
 * "Every upgrade lands": each purchase of a helper line or a scaling upgrade
 * must make its group noticeably bigger (at least half again), so no level is
 * a quiet one-more-of-the-same.
 */
const MIN_JUMP = 1.5;

/** A helper line, by upgrade id and the phase it works in. */
const HELPER_LINES: readonly [string, number][] = [
  ["sprinkler", 0],
  ["bee-hive", 0],
  ["scarecrow", 1],
  ["tractor", 1],
  ["glasshouse", 1],
  ["seed-drone", 1],
  ["windbreak", 2],
  ["planting-rover", 2],
  ["sky-seeder", 2],
  ["trellis", 3],
  ["wind-chime", 3],
  ["dew-collector", 3],
];

/** A scaling upgrade (multiplies taps and helpers), by id and phase. */
const SCALE_LINES: readonly [string, number][] = [
  ["mulch", 0],
  ["compost", 1],
  ["rain-makers", 2],
  ["sunny-sill", 3],
];

const maxOf = (id: string): number =>
  UPGRADES.find((u) => u.id === id)?.maxLevel ?? 1;

const withLevel = (base: RunState, id: string, level: number): RunState => ({
  ...base,
  owned: { ...base.owned, [id]: level },
});

describe("Grow economy: every purchase lands", () => {
  it("stacks helpers: each level is at least half again the one before", () => {
    expect(stacked(0)).toBe(0);
    for (let n = 1; n < 12; n += 1)
      expect(stacked(n + 1) / stacked(n)).toBeGreaterThanOrEqual(MIN_JUMP);
  });

  it.each(HELPER_LINES)(
    "%s: every level raises its phase's income by at least half again",
    (id, phase) => {
      const base = runAtPhaseStart(phase);
      // Start the line from nothing so the other lines do not hide the jump.
      const clean: RunState = {
        ...base,
        owned: {},
        resources: { ...base.resources },
      };
      for (let n = 1; n < maxOf(id); n += 1) {
        const before = incomePerSecond(withLevel(clean, id, n));
        const after = incomePerSecond(withLevel(clean, id, n + 1));
        expect([id, n, after / before >= MIN_JUMP]).toEqual([id, n, true]);
      }
    }
  );

  it.each(SCALE_LINES)(
    "%s: every level makes a tap pay at least half again as much",
    (id, phase) => {
      const base = runAtPhaseStart(phase);
      const clean: RunState = { ...base, owned: {} };
      for (let n = 0; n < maxOf(id); n += 1) {
        const before = manualPerTap(withLevel(clean, id, n));
        const after = manualPerTap(withLevel(clean, id, n + 1));
        expect([id, n, after / before >= MIN_JUMP]).toEqual([id, n, true]);
      }
    }
  );

  it("keeps every upgrade's cap small enough to stay a series of jumps", () => {
    for (const u of UPGRADES)
      expect([u.id, (u.maxLevel ?? 1) <= 8]).toEqual([u.id, true]);
  });
});
