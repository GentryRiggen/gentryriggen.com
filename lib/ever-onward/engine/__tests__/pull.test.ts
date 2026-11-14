import {
  GENERIC_NO_EFFECT_REASON,
  newRun,
  previewBiggestChange,
  previewChangesNothing,
  upgradeNoEffectReason,
} from "../engine";
import { pickNextUpgrade, primaryResourceId, progressPercent } from "../pull";
import { lightUniverse } from "@/lib/ever-onward/universes/light";

function runWithCoins(coins: number) {
  const run = newRun(lightUniverse);
  run.resources.coins = coins;
  run.revealed = lightUniverse.upgrades
    .filter((u) => !u.phases || u.phases.includes("coast"))
    .map((u) => u.id);
  return run;
}

describe("progressPercent", () => {
  it("floors, and only reaches 100 when affordable", () => {
    expect(progressPercent(0, 10)).toBe(0);
    expect(progressPercent(7.2, 10)).toBe(72);
    expect(progressPercent(9.99, 10)).toBe(99);
    expect(progressPercent(10, 10)).toBe(100);
    expect(progressPercent(50, 10)).toBe(100);
    expect(progressPercent(-5, 10)).toBe(0);
  });
});

describe("pickNextUpgrade", () => {
  it("uses the phase's manual resource as the primary one", () => {
    expect(primaryResourceId(lightUniverse, newRun(lightUniverse))).toBe(
      "coins"
    );
  });

  it("points at the cheapest upgrade that is not affordable yet", () => {
    const run = runWithCoins(0);
    const next = pickNextUpgrade(lightUniverse, run);
    expect(next).not.toBeNull();
    expect(next?.isReady).toBe(false);
    expect(next?.percent).toBe(0);
    const half = runWithCoins((next?.cost ?? 0) / 2);
    expect(pickNextUpgrade(lightUniverse, half)?.upgrade.id).toBe(
      next?.upgrade.id
    );
    expect(pickNextUpgrade(lightUniverse, half)?.percent).toBe(50);
  });

  it("keeps a sticky pick once it turns affordable", () => {
    const first = pickNextUpgrade(lightUniverse, runWithCoins(0));
    const run = runWithCoins(first?.cost ?? 0);
    const next = pickNextUpgrade(lightUniverse, run, first?.upgrade.id);
    expect(next?.upgrade.id).toBe(first?.upgrade.id);
    expect(next?.isReady).toBe(true);
    expect(next?.percent).toBe(100);
  });

  it("returns null when nothing is visible", () => {
    const run = newRun(lightUniverse);
    run.revealed = [];
    expect(pickNextUpgrade(lightUniverse, run)).toBeNull();
  });
});

describe("upgrades that would change nothing", () => {
  it("reads a same-before-and-after preview as nothing", () => {
    expect(previewChangesNothing("Picks/sec 388 -> 388")).toBe(true);
    expect(previewChangesNothing("A 1 → 1 · B 2 → 2")).toBe(true);
    expect(previewChangesNothing("A 1 → 1 · B 2 → 3")).toBe(false);
    expect(previewChangesNothing(null)).toBe(false);
  });

  it("is never the next goal, and gives a reason instead", () => {
    const run = runWithCoins(0);
    const first = pickNextUpgrade(lightUniverse, run)?.upgrade;
    if (!first) throw new Error("expected an upgrade");
    const dead = {
      ...lightUniverse,
      upgrades: lightUniverse.upgrades.map((u) =>
        u.id === first.id ? { ...u, effectPreview: () => "Coins 5 -> 5" } : u
      ),
    };
    const deadUpgrade = dead.upgrades.find((u) => u.id === first.id);
    if (!deadUpgrade) throw new Error("missing");
    expect(pickNextUpgrade(dead, run)?.upgrade.id).not.toBe(first.id);
    expect(upgradeNoEffectReason(run, deadUpgrade)).toBe(
      GENERIC_NO_EFFECT_REASON
    );
    expect(
      upgradeNoEffectReason(run, {
        ...deadUpgrade,
        noEffectReason: () => "Soon.",
      })
    ).toBe("Soon.");
  });
});

describe("upgrades that barely help", () => {
  it("measures the biggest change in a preview", () => {
    expect(previewBiggestChange("Picks/sec 388 -> 390")).toBeCloseTo(0.005, 3);
    expect(previewBiggestChange("A 1.50K → 1.53K · B 2 → 3")).toBe(0.5);
    expect(previewBiggestChange("Coins 0 -> 4")).toBe(Infinity);
    expect(previewBiggestChange("no arrow here")).toBeNull();
  });

  it("is skipped and explained only when it declares a reason", () => {
    const run = runWithCoins(0);
    const first = pickNextUpgrade(lightUniverse, run)?.upgrade;
    if (!first) throw new Error("expected an upgrade");
    const tiny = { ...first, effectPreview: () => "Picks/sec 388 -> 390" };
    expect(upgradeNoEffectReason(run, tiny)).toBeNull();
    const kind = { ...tiny, noEffectReason: () => "At their limit." };
    expect(upgradeNoEffectReason(run, kind)).toBe("At their limit.");
    const withKind = {
      ...lightUniverse,
      upgrades: lightUniverse.upgrades.map((u) =>
        u.id === first.id ? kind : u
      ),
    };
    expect(pickNextUpgrade(withKind, run)?.upgrade.id).not.toBe(first.id);
  });
});
