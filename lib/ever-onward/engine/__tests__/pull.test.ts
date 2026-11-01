import { newRun } from "../engine";
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
