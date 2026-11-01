import { newRun, tick } from "../engine";
import {
  buyPrestigeUpgrade,
  canRestart,
  emberReward,
  endRun,
  newUniverseSave,
  prestigeLabel,
  prestigeSingular,
  prestigeUpgradeCost,
} from "../prestige";
import type { RunState } from "../types";
import { fixture as def } from "./fixtures";

function finished(): RunState {
  let run = newRun(def);
  run = tick(def, { ...run, resources: { ...run.resources, total: 100 } }, 0.1);
  run = { ...run, resources: { ...run.resources, glow: 300 } };
  return tick(def, run, 0.1);
}

describe("prestige", () => {
  it("names the currency, Embers unless the universe says otherwise", () => {
    expect(prestigeLabel(def)).toBe("Embers");
    expect(
      prestigeLabel({ ...def, prestige: { ...def.prestige, label: "Acorns" } })
    ).toBe("Acorns");
  });

  it("names one of the currency: the setting, else the plural minus its s", () => {
    expect(prestigeSingular(def)).toBe("Ember");
    const berries = { ...def.prestige, label: "Berries" };
    expect(prestigeSingular({ ...def, prestige: berries })).toBe("Berrie");
    expect(
      prestigeSingular({
        ...def,
        prestige: { ...berries, labelSingular: "Berry" },
      })
    ).toBe("Berry");
  });

  it("awards completion plus every phase cleared", () => {
    const run = finished();
    expect(run.complete).toBe(true);
    expect(emberReward(def, run)).toBe(5 + 2);
  });

  it("awards only cleared phases when restarting mid-run, from phase 2 on", () => {
    expect(canRestart(newRun(def))).toBe(false);
    const mid = tick(
      def,
      { ...newRun(def), resources: { coins: 0, total: 100, glow: 0 } },
      0.1
    );
    expect(canRestart(mid)).toBe(true);
    expect(emberReward(def, mid)).toBe(1);
  });

  it("endRun banks embers, records the best time and starts fresh", () => {
    const save = { ...newUniverseSave(def), run: finished() };
    const next = endRun(def, save);
    expect(next.embers).toBe(7);
    expect(next.completions).toBe(1);
    expect(next.best).toBeCloseTo(0.2);
    expect(next.run.phase).toBe(0);
    expect(next.run.time).toBe(0);
  });

  it("keeps the better of two completion times", () => {
    const slow = { ...finished(), time: 500 };
    const save = { ...newUniverseSave(def), run: slow, best: 100 };
    expect(endRun(def, save).best).toBe(100);
  });

  it("does not end a run that is still in phase 1", () => {
    const save = newUniverseSave(def);
    expect(endRun(def, save)).toBe(save);
  });

  it("spends embers on levels with growing cost and shapes the next run", () => {
    let save = { ...newUniverseSave(def), embers: 10 };
    expect(prestigeUpgradeCost(def, save, "spark")).toBe(2);
    save = buyPrestigeUpgrade(def, save, "spark");
    expect(save.embers).toBe(8);
    expect(prestigeUpgradeCost(def, save, "spark")).toBe(3);
    save = { ...save, run: finished() };
    const next = endRun(def, save);
    expect(next.run.mods.mult).toBe(1.5);
    expect(next.embers).toBe(8 + 7);
  });

  it("refuses when short of embers, maxed or unknown", () => {
    const poor = newUniverseSave(def);
    expect(buyPrestigeUpgrade(def, poor, "spark")).toBe(poor);
    expect(buyPrestigeUpgrade(def, poor, "nope")).toBe(poor);
    const maxed = {
      ...poor,
      embers: 100,
      prestigeUpgrades: { spark: 3 },
    };
    expect(prestigeUpgradeCost(def, maxed, "spark")).toBeNull();
    expect(buyPrestigeUpgrade(def, maxed, "spark")).toBe(maxed);
  });
});
