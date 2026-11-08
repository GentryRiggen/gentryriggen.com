import { newRun, reconcileRun } from "../../../engine/engine";
import { def } from "./fixtures";
import { marketOilPrice, rushFactor, tankCapacity } from "../tick";
import { TUNING } from "../tuning";

const C = TUNING.coast;

function coast(seed = 3): ReturnType<typeof newRun> {
  const run = newRun(def, undefined, seed);
  run.owned = { ...run.owned, keeper: 8, lighthouse: 2, lens: 2 };
  def.tick(run, 0.1);
  return run;
}

describe("old saves with more keepers than the Coast now has", () => {
  /** What 40 keepers really cost when each was bought at the old 1.18 growth. */
  const paidFor = (from: number, to: number): number => {
    const base = def.upgrades.find((u) => u.id === "keeper")!.baseCost;
    let sum = 0;
    for (let level = from; level < to; level += 1) sum += base * 1.18 ** level;
    return sum;
  };

  it.each([20, 30, 40])(
    "refunds %i keepers at what was paid, not at today's steeper prices",
    (keepers) => {
      const run = newRun(def);
      run.owned.keeper = keepers;
      run.resources.coins = 0;
      const fixed = reconcileRun(def, run);
      expect(fixed.owned.keeper).toBe(C.keeperMax);
      expect(fixed.resources.coins).toBeCloseTo(
        paidFor(C.keeperMax, keepers),
        0
      );
    }
  );

  it("never refunds more than the levels above the cap cost at the old price", () => {
    const run = newRun(def);
    run.owned.keeper = 40;
    run.resources.coins = 0;
    const refund = reconcileRun(def, run).resources.coins;
    // today's growth would have handed back more than nine million
    expect(refund).toBeLessThan(paidFor(C.keeperMax, 40) * 1.001);
    expect(refund).toBeLessThan(2_000_000);
  });
});

describe("the oil market on old saves", () => {
  it("starts from the saved price, not a jump to the old mean", () => {
    const run = newRun(def);
    run.resources.oilPrice = 0.8;
    delete (run.resources as Record<string, number>).oilBase;
    const next = reconcileRun(def, run);
    expect(marketOilPrice(next)).toBeCloseTo(0.8, 6);
    def.tick(next, 1);
    expect(marketOilPrice(next)).toBeLessThan(1.4);
  });
});

describe("the rush order", () => {
  it("costs more only when the tank is nearly empty, and not from a tanker", () => {
    const run = coast();
    run.resources.oil = tankCapacity(run) * 0.5;
    def.tick(run, 1);
    expect(rushFactor(run)).toBe(1);
    expect(run.resources.oilPrice).toBeCloseTo(marketOilPrice(run), 6);
    run.resources.oil = tankCapacity(run) * (C.rushBelow / 2);
    def.tick(run, 0.1);
    expect(rushFactor(run)).toBe(C.rushMult);
    expect(run.resources.oilPrice).toBeCloseTo(
      marketOilPrice(run) * C.rushMult,
      6
    );
  });
});
