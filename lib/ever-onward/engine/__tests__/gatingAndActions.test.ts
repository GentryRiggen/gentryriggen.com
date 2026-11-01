import {
  buy,
  canPerformAction,
  hasUnrevealedUpgrades,
  newRun,
  performAction,
  previewUpgrade,
  tick,
  visibleActions,
  visibleUpgrades,
} from "../engine";
import type { RunState, UniverseDef, UpgradeDef } from "../types";
import { fixture } from "./fixtures";

const shopItem = (id: string, extra: Partial<UpgradeDef> = {}): UpgradeDef => ({
  id,
  name: id,
  description: id,
  phases: ["dim"],
  currency: "coins",
  baseCost: 1,
  costGrowth: 1,
  ...extra,
});

function withCoins(run: RunState, coins: number): RunState {
  return { ...run, resources: { ...run.resources, coins } };
}

describe("maxVisible gating", () => {
  const gated: UniverseDef = {
    ...fixture,
    maxVisible: 2,
    upgrades: [
      shopItem("a"),
      shopItem("b"),
      shopItem("c"),
      shopItem("d", { maxLevel: 5 }),
      shopItem("late", { visibleWhen: (run) => run.resources.total >= 50 }),
    ],
  };
  const ids = (run: RunState) => visibleUpgrades(gated, run).map((u) => u.id);

  it("reveals no more than maxVisible unbought upgrades at once", () => {
    expect(ids(newRun(gated))).toEqual(["a", "b"]);
  });

  it("reveals the next one when one is bought", () => {
    const run = buy(gated, withCoins(newRun(gated), 10), "a");
    expect(ids(run)).toEqual(["a", "b", "c"]);
  });

  it("does not count a repeatable once it has been bought", () => {
    let run = withCoins(newRun(gated), 100);
    run = buy(gated, run, "a");
    run = buy(gated, run, "b");
    expect(ids(run)).toEqual(["a", "b", "c", "d"]);
    run = buy(gated, run, "d");
    // d is owned (and not maxed), so it no longer holds a slot
    expect(ids(run)).toEqual(["a", "b", "c", "d"]);
  });

  it("waits for a milestone even with a free slot", () => {
    let run = withCoins(newRun(gated), 100);
    for (const id of ["a", "b", "c", "d"]) run = buy(gated, run, id);
    expect(ids(run)).not.toContain("late");
    run = { ...run, resources: { ...run.resources, total: 60 } };
    run = tick(gated, run, 0.1);
    expect(ids(run)).toContain("late");
  });

  it("says when more upgrades are still to come", () => {
    const run = newRun(gated);
    expect(hasUnrevealedUpgrades(gated, run)).toBe(true);
    const all = { ...run, revealed: gated.upgrades.map((u) => u.id) };
    expect(hasUnrevealedUpgrades(gated, all)).toBe(false);
  });

  it("is unlimited when maxVisible is omitted", () => {
    const open: UniverseDef = { ...gated, maxVisible: undefined };
    expect(visibleUpgrades(open, newRun(open))).toHaveLength(4);
  });
});

describe("effect previews", () => {
  const def: UniverseDef = {
    ...fixture,
    upgrades: [
      shopItem("x", { effectPreview: (run) => `Coins ${run.resources.total}` }),
      shopItem("y"),
    ],
  };

  it("returns the card's line, or null when it has none", () => {
    const run = newRun(def);
    expect(previewUpgrade(def, run, "x")).toBe("Coins 0");
    expect(previewUpgrade(def, run, "y")).toBeNull();
  });
});

describe("actions", () => {
  const def: UniverseDef = {
    ...fixture,
    actions: [
      {
        id: "boost",
        phases: ["dim"],
        visibleWhen: (run) => run.resources.total >= 5,
        describe: (run) => ({
          label: "Boost",
          cost: { resource: "coins", amount: 10 },
          isBlocked: run.flags.boosted === true,
        }),
        perform: (run) => {
          run.flags.boosted = true;
          run.resources.total += 100;
        },
      },
      {
        id: "free",
        describe: () => ({ label: "Free" }),
        perform: (run) => {
          run.resources.coins += 1;
        },
      },
    ],
  };
  const rich = (): RunState => ({
    ...withCoins(newRun(def), 50),
    resources: { ...newRun(def).resources, coins: 50, total: 20 },
  });

  it("shows an action only once its milestone is reached", () => {
    expect(visibleActions(def, newRun(def)).map((a) => a.id)).toEqual(["free"]);
    expect(visibleActions(def, rich()).map((a) => a.id)).toEqual([
      "boost",
      "free",
    ]);
  });

  it("takes the cost and applies the effect", () => {
    const run = performAction(def, rich(), "boost");
    expect(run.resources.coins).toBe(40);
    expect(run.resources.total).toBe(120);
  });

  it("does nothing when you can't pay, or it is blocked, or hidden", () => {
    const poor = { ...rich(), resources: { ...rich().resources, coins: 3 } };
    expect(performAction(def, poor, "boost")).toBe(poor);
    const once = performAction(def, rich(), "boost");
    expect(canPerformAction(def, once, "boost")).toBe(false);
    const hidden = newRun(def);
    expect(canPerformAction(def, hidden, "boost")).toBe(false);
  });

  it("lets a free action through whatever you hold", () => {
    const run = performAction(def, newRun(def), "free");
    expect(run.resources.coins).toBe(1);
  });

  it("is off once the run is complete", () => {
    expect(canPerformAction(def, { ...rich(), complete: true }, "free")).toBe(
      false
    );
  });
});
