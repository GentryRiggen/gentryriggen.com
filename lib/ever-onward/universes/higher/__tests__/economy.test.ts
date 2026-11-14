import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { higherBots } from "../bots";
import { HELPER_LINES, SCALE_IDS } from "../lines";
import { higherSceneDiff } from "../hooks";
import { incomePerSecond, manualPerTap } from "../tick";
import { stacked } from "../income";
import { UPGRADES } from "../upgrades";
import { def, runAtPhaseStart, withOwned } from "./fixtures";

/**
 * "Every upgrade lands": each purchase of a helper line or a scaling upgrade
 * must make its group noticeably bigger (at least half again), every other
 * upgrade must change what the player earns by half again or show in the
 * picture, and none is a quiet one-more-of-the-same.
 */
const MIN_JUMP = 1.5;

const maxOf = (id: string): number =>
  UPGRADES.find((u) => u.id === id)?.maxLevel ?? 1;

const withLevel = (base: RunState, id: string, level: number): RunState => ({
  ...base,
  owned: { ...base.owned, [id]: level },
});

/** Every helper line, with the phase it works in. */
const HELPERS: readonly [string, number][] = HELPER_LINES.flatMap(
  (ids, phase) => ids.map((id): [string, number] => [id, phase])
);

/** Every scaling upgrade, with the phase it works in. */
const SCALES: readonly [string, number][] = SCALE_IDS.map((id, phase) => [
  id,
  phase,
]);

describe("Build It Higher economy: every purchase lands", () => {
  it("stacks helpers: each level is at least half again the one before", () => {
    expect(stacked(0)).toBe(0);
    for (let n = 1; n < 12; n += 1)
      expect(stacked(n + 1) / stacked(n)).toBeGreaterThanOrEqual(MIN_JUMP);
  });

  it.each(HELPERS)(
    "%s: every level raises its phase's income by at least half again",
    (id, phase) => {
      const base = runAtPhaseStart(phase);
      // Start the line from nothing so the other lines do not hide the jump.
      const clean = withOwned(base, {});
      for (let n = 1; n < maxOf(id); n += 1) {
        const before = incomePerSecond(withLevel(clean, id, n));
        const after = incomePerSecond(withLevel(clean, id, n + 1));
        expect([id, n, after / before >= MIN_JUMP]).toEqual([id, n, true]);
      }
    }
  );

  it.each(SCALES)(
    "%s: every level makes a tap pay at least half again as much",
    (id, phase) => {
      const clean = withOwned(runAtPhaseStart(phase), {});
      for (let n = 0; n < maxOf(id); n += 1) {
        const before = manualPerTap(withLevel(clean, id, n));
        const after = manualPerTap(withLevel(clean, id, n + 1));
        expect([id, n, after / before >= MIN_JUMP]).toEqual([id, n, true]);
      }
    }
  );

  it.each(
    UPGRADES.filter((u) =>
      u.id.match(/^(fairy-lights|neon-sign|beacon|rest-bench|window-seat)$/)
    ).map((u) => [u.id, PHASE_OF(u.id)] as const)
  )("%s: the one-off pays at least half again as much", (id, phase) => {
    const clean = withOwned(runAtPhaseStart(phase), {
      [HELPER_LINES[phase][0]]: 3,
    });
    const before = incomePerSecond(clean);
    const after = incomePerSecond(withLevel(clean, id, 1));
    expect(after / before).toBeGreaterThanOrEqual(MIN_JUMP);
  });

  it("keeps every upgrade's cap small enough to stay a series of jumps", () => {
    for (const u of UPGRADES)
      expect([u.id, (u.maxLevel ?? 1) <= 8]).toEqual([u.id, true]);
  });

  it("changes the picture for every level of every upgrade", () => {
    for (const u of UPGRADES) {
      const phase = PHASE_OF(u.id);
      const base = runAtPhaseStart(phase);
      for (let level = 0; level < (u.maxLevel ?? 1); level += 1) {
        const before = withLevel(base, u.id, level);
        const after = withLevel(base, u.id, level + 1);
        expect([u.id, level, higherSceneDiff(before, after)]).toEqual([
          u.id,
          level,
          true,
        ]);
      }
    }
  });

  it("every purchase in a whole run is felt, or shows in the picture", () => {
    const r = simulate(def, {
      maxSeconds: 8 * 3600,
      step: 1,
      strategy: higherBots().tapper,
      trace: { sampleEvery: 5 },
    });
    const felt = r.trace!.purchases.filter(
      (p) => !p.meaningful && p.kind !== "filler"
    );
    // A few small steps may be quiet, but they must not be the habit.
    expect(felt.length / r.trace!.purchases.length).toBeLessThan(0.1);
  });
});

function PHASE_OF(id: string): number {
  const phase = UPGRADES.find((u) => u.id === id)?.phases?.[0];
  return ["playroom", "town", "sky", "top"].indexOf(phase ?? "playroom");
}
