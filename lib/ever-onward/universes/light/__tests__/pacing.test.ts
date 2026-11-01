import {
  buy,
  canPerformAction,
  manualGain,
  newRun,
  performAction,
  previewUpgrade,
  tick,
  visibleUpgrades,
  upgradeLevel,
} from "../../../engine/engine";
import { upkeepRate } from "../../../engine/rate";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { def, REALISTIC } from "./fixtures";

const withResources = (
  run: RunState,
  resources: Record<string, number>
): RunState => ({ ...run, resources: { ...run.resources, ...resources } });

/** A coast run past the first minutes, with the oil button on offer. */
const coastRun = (resources: Record<string, number> = {}): RunState =>
  withResources(newRun(def), { ships: 30, coins: 1000, ...resources });

describe("upgrades are few and gated", () => {
  it("has no filler upgrades", () => {
    expect(def.upgrades.some((u) => u.id.startsWith("boon"))).toBe(false);
    expect(def.maxVisible).toBe(3);
  });

  it("never offers more than 3 unbought upgrades in a real run", () => {
    let worst = 0;
    simulate(def, {
      maxSeconds: 6 * 3600,
      step: 1,
      strategy: REALISTIC,
      stopWhen: (run) => {
        const offered = visibleUpgrades(def, run).filter(
          (u) => upgradeLevel(run, u.id) === 0 && (u.maxLevel ?? 1) >= 1
        );
        worst = Math.max(worst, offered.length);
        return false;
      },
    });
    expect(worst).toBeLessThanOrEqual(3);
  });

  it("keeps repeatables to a handful per phase", () => {
    for (const phase of def.phases) {
      const repeatables = def.upgrades.filter(
        (u) => u.phases?.includes(phase.id) && (u.maxLevel ?? 1) > 1
      );
      expect(repeatables.length).toBeLessThanOrEqual(7);
    }
  });

  it("starts the coast with just a couple of cards", () => {
    expect(visibleUpgrades(def, newRun(def)).map((u) => u.id)).toEqual([
      "lens",
    ]);
  });
});

describe("effect previews", () => {
  it("gives every upgrade a before-to-after line", () => {
    const run = newRun(def);
    for (const upgrade of def.upgrades) {
      expect(upgrade.effectPreview).toBeDefined();
      expect(previewUpgrade(def, run, upgrade.id)).toEqual(expect.any(String));
    }
  });

  it("shows what one more lens does", () => {
    const run = newRun(def);
    expect(previewUpgrade(def, run, "lens")).toBe(
      "Ships per flash 1 → 2 · Coins per flash 1 → 2"
    );
  });

  it("shows the new total for a keeper", () => {
    const run = withResources(newRun(def), { coins: 1000, ships: 30 });
    const bought = buy(def, { ...run, revealed: ["keeper"] }, "keeper");
    expect(previewUpgrade(def, run, "keeper")).toMatch(
      /^Coins\/sec 0 → 1(\.\d+)?$/
    );
    expect(upgradeLevel(bought, "keeper")).toBe(1);
  });

  it("agrees with what the purchase really does", () => {
    const run = withResources(newRun(def), { coins: 1e6 });
    const before = run.resources.oil;
    expect(previewUpgrade(def, run, "lighthouse")).toContain(
      "Lighthouses 1 → 2"
    );
    const after = buy(
      def,
      { ...run, revealed: [...run.revealed, "lighthouse"] },
      "lighthouse"
    );
    expect(after.resources.lighthouses).toBe(2);
    expect(after.resources.oil).toBe(before);
  });
});

describe("oil is a decision", () => {
  it("is not restocked by anyone: the lamp runs dry", () => {
    let run = coastRun({ oil: 5 });
    for (let i = 0; i < 100; i += 1) run = tick(def, run, 1);
    expect(run.resources.oil).toBe(0);
  });

  it("is bought by hand at the current price", () => {
    const run = coastRun({ oil: 0, oilPrice: 2 });
    expect(canPerformAction(def, run, "buy-oil")).toBe(true);
    const bought = performAction(def, run, "buy-oil");
    expect(bought.resources.oil).toBeGreaterThan(10);
    expect(bought.resources.coins).toBeCloseTo(
      1000 - bought.resources.oil * 2,
      5
    );
  });

  it("costs more when the price is high", () => {
    const cheap = performAction(
      def,
      coastRun({ oil: 0, oilPrice: 1 }),
      "buy-oil"
    );
    const dear = performAction(
      def,
      coastRun({ oil: 0, oilPrice: 4 }),
      "buy-oil"
    );
    expect(1000 - dear.resources.coins).toBeGreaterThan(
      (1000 - cheap.resources.coins) * 3
    );
  });

  it("can't overfill the tank, or be bought with no coins", () => {
    expect(canPerformAction(def, coastRun({ oil: 40 }), "buy-oil")).toBe(false);
    expect(
      canPerformAction(def, coastRun({ oil: 0, coins: 1 }), "buy-oil")
    ).toBe(false);
  });

  it("only shows up after a few ships", () => {
    expect(canPerformAction(def, newRun(def), "buy-oil")).toBe(false);
  });

  it("dims the lamp when dry but a tap still earns", () => {
    const lit = coastRun({ oil: 10, coins: 0 });
    const dry = coastRun({ oil: 0, coins: 0 });
    expect(manualGain(def, dry)).toBeGreaterThan(0);
    expect(manualGain(def, dry)).toBeLessThan(manualGain(def, lit));
  });

  it("counts the oil burned against the net rate", () => {
    const run = coastRun({ oil: 20, oilPrice: 2 });
    expect(upkeepRate(def, run, "coins")).toBeGreaterThan(0);
    expect(upkeepRate(def, coastRun({ oil: 0 }), "coins")).toBe(0);
  });

  it("is bought for you after the merchant contract, when it is cheap", () => {
    const withContract = (price: number): RunState => ({
      ...coastRun({ oil: 5, oilPrice: price, coins: 500 }),
      owned: { contract: 1 },
    });
    // keep the price put for this one step
    const cheap = tick(def, { ...withContract(1.2), mods: { calm: 0.9 } }, 0.1);
    const dear = tick(def, { ...withContract(4), mods: { calm: 0.9 } }, 0.1);
    expect(cheap.resources.oil).toBeGreaterThan(20);
    expect(dear.resources.oil).toBeLessThan(5);
  });

  it("even the contract tops up a nearly dry tank at a high price", () => {
    const run: RunState = {
      ...coastRun({ oil: 0.5, oilPrice: 4, coins: 500 }),
      owned: { contract: 1 },
      mods: { calm: 0.9 },
    };
    expect(tick(def, run, 0.1).resources.oil).toBeGreaterThan(5);
  });
});
