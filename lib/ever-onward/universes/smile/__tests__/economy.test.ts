import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { smileBots } from "../bots";
import { sceneInfo } from "../scene";
import {
  HELPER_IDS,
  SCALE_IDS,
  incomePerSecond,
  manualPerTap,
  stacked,
} from "../tick";
import { UPGRADES } from "../upgrades";
import { def, runAtPhaseStart } from "./fixtures";

/**
 * "Every upgrade lands": each purchase of a helper line or a scaling upgrade
 * must make its group noticeably bigger (at least half again), and every
 * upgrade must show in the picture. No level is a quiet one-more-of-the-same.
 */
const MIN_JUMP = 1.5;

const maxOf = (id: string): number =>
  UPGRADES.find((u) => u.id === id)?.maxLevel ?? 1;

const withLevel = (base: RunState, id: string, level: number): RunState => ({
  ...base,
  owned: { ...base.owned, [id]: level },
});

const HELPER_LINES = HELPER_IDS.flatMap((ids, phase) =>
  ids.map((id) => [id, phase] as const)
);
const SCALE_LINES = SCALE_IDS.map((id, phase) => [id, phase] as const);

describe("Smile economy: every purchase lands", () => {
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

  it("gives every upgrade a clear new capability or a big step", () => {
    for (const u of UPGRADES) {
      const isLine = HELPER_LINES.some(([id]) => id === u.id);
      const isScale = SCALE_IDS.includes(u.id);
      expect([u.id, isLine || isScale || u.kind === "mechanic"]).toEqual([
        u.id,
        true,
      ]);
    }
  });

  it("every purchase in a whole run is felt, or shows in the picture", () => {
    const r = simulate(def, {
      maxSeconds: 6 * 3600,
      step: 1,
      strategy: smileBots().tapper,
      trace: { sampleEvery: 600 },
    });
    expect(r.finished).toBe(true);
    const purchases = r.trace!.purchases;
    expect(purchases.length).toBeGreaterThan(80);
    const unfelt = purchases.filter(
      (p) => !p.meaningful && !p.sceneChanged && p.kind !== "mechanic"
    );
    expect(unfelt.map((p) => `${p.id} L${p.level}`)).toEqual([]);
    const felt = purchases.filter((p) => p.effectRatio >= 0.1).length;
    expect(felt / purchases.length).toBeGreaterThan(0.5);
  });
});

describe("Smile scene: every upgrade is visible", () => {
  it.each(UPGRADES.map((u) => [u.id, u] as const))(
    "%s changes the picture",
    (_id, upgrade) => {
      const phase = def.phases.findIndex((p) => p.id === upgrade.phases?.[0]);
      const base = runAtPhaseStart(phase);
      const clean: RunState = { ...base, owned: {} };
      const before = sceneInfo(withLevel(clean, upgrade.id, 0));
      // Some drawings only show once a part is under way, so look at every level.
      const levels = Array.from({ length: maxOf(upgrade.id) }, (_, i) =>
        sceneInfo(withLevel(clean, upgrade.id, i + 1))
      );
      expect(
        levels.some((info) => JSON.stringify(info) !== JSON.stringify(before))
      ).toBe(true);
    }
  );
});
