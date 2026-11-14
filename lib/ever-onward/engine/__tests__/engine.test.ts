import {
  affordableUpgrades,
  buy,
  canBuy,
  manualAction,
  manualGain,
  newRun,
  reconcileRun,
  tick,
  upgradeCost,
  visibleUpgrades,
} from "../engine";
import { nextRandom } from "../rng";
import type { RunState } from "../types";
import { fixture as def } from "./fixtures";

const upgrade = (id: string) => def.upgrades.find((u) => u.id === id)!;

/** Coins in hand, with the dim phase's upgrades already popped in. */
function withCoins(run: RunState, coins: number, total = 50): RunState {
  return {
    ...run,
    resources: { ...run.resources, coins, total },
    revealed: ["gen", "lens"],
  };
}

describe("newRun", () => {
  it("starts in the first phase with initial resources and the intro story", () => {
    const run = newRun(def);
    expect(run.phase).toBe(0);
    expect(run.resources).toEqual({ coins: 0, total: 0, glow: 0 });
    expect(run.story).toEqual(["hello"]);
  });

  it("is JSON serializable", () => {
    const run = tick(def, manualAction(def, newRun(def)), 0.5);
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});

describe("tick", () => {
  it("produces by the universe's rule and advances time without mutating", () => {
    let run = withCoins(newRun(def), 100, 100);
    run = { ...run, owned: { gen: 2 } };
    const before = JSON.stringify(run);
    const next = tick(def, run, 0.5);
    expect(JSON.stringify(run)).toBe(before);
    expect(next.time).toBe(0.5);
    expect(next.resources.coins).toBeCloseTo(102);
  });

  it("clamps dt to one second", () => {
    const run = { ...newRun(def), owned: { gen: 1 } };
    const next = tick(def, run, 3600);
    expect(next.time).toBe(1);
    expect(next.resources.coins).toBeCloseTo(2);
  });

  it("ignores zero or negative dt", () => {
    const run = newRun(def);
    expect(tick(def, run, 0)).toBe(run);
    expect(tick(def, run, -5)).toBe(run);
  });
});

describe("buy and costs", () => {
  it("scales the cost with each level and spends the currency", () => {
    let run = withCoins(newRun(def), 1000);
    expect(upgradeCost(run, upgrade("gen"))).toBe(15);
    run = buy(def, run, "gen");
    expect(run.owned.gen).toBe(1);
    expect(run.resources.coins).toBe(985);
    expect(upgradeCost(run, upgrade("gen"))).toBeCloseTo(18);
    run = buy(def, run, "gen");
    expect(upgradeCost(run, upgrade("gen"))).toBeCloseTo(21.6);
  });

  it("refuses when it is too expensive, returning the same run", () => {
    const run = withCoins(newRun(def), 5);
    expect(canBuy(def, run, "gen")).toBe(false);
    expect(buy(def, run, "gen")).toBe(run);
  });

  it("stops at maxLevel", () => {
    let run = withCoins(newRun(def), 1e6);
    run = buy(def, run, "lens");
    expect(buy(def, run, "lens")).not.toBe(run);
    for (let i = 0; i < 6; i += 1) run = buy(def, run, "lens");
    expect(run.owned.lens).toBe(5);
    expect(canBuy(def, run, "lens")).toBe(false);
  });

  it("applies the run's costMult mod", () => {
    const run = { ...newRun(def), mods: { costMult: 0.5 } };
    expect(upgradeCost(run, upgrade("gen"))).toBe(7.5);
  });

  it.each([0, -1, NaN, Infinity])("treats costMult %s as 1", (costMult) => {
    const run = { ...newRun(def), mods: { costMult } };
    expect(upgradeCost(run, upgrade("gen"))).toBe(15);
  });

  it("throws on an unknown upgrade id", () => {
    expect(() => buy(def, newRun(def), "nope")).toThrow("Unknown upgrade");
  });
});

describe("visibility", () => {
  it("pops an upgrade in once its condition holds and keeps it", () => {
    let run = newRun(def);
    expect(visibleUpgrades(def, run).map((u) => u.id)).toEqual(["gen"]);
    for (let i = 0; i < 5; i += 1) run = manualAction(def, run);
    expect(visibleUpgrades(def, run).map((u) => u.id)).toEqual(["lens", "gen"]);
    run = { ...run, resources: { ...run.resources, total: 0 } };
    run = tick(def, run, 0.1);
    expect(visibleUpgrades(def, run).map((u) => u.id)).toContain("lens");
  });

  it("does not allow buying an upgrade that has not popped in", () => {
    const run = withCoins(newRun(def), 1e6);
    const hidden = { ...run, revealed: ["gen"] };
    expect(canBuy(def, hidden, "lens")).toBe(false);
  });

  it("lists affordable upgrades", () => {
    const run = withCoins(newRun(def), 12);
    expect(affordableUpgrades(def, run).map((u) => u.id)).toEqual(["lens"]);
  });
});

describe("phases", () => {
  function reachBright(): RunState {
    return tick(def, withCoins(newRun(def), 100, 100), 0.1);
  }

  it("advances when the phase is done and records the transition", () => {
    const run = reachBright();
    expect(run.phase).toBe(1);
    expect(run.transitions).toEqual([{ from: "dim", to: "bright", at: 0.1 }]);
  });

  it("hides the old phase's upgrades and shows the new phase's", () => {
    const run = reachBright();
    expect(visibleUpgrades(def, run).map((u) => u.id)).toEqual(["beam"]);
  });

  it("completes the run in the last phase", () => {
    let run = reachBright();
    run = { ...run, resources: { ...run.resources, glow: 300 } };
    run = tick(def, run, 0.1);
    expect(run.complete).toBe(true);
    expect(tick(def, run, 1)).toBe(run);
    expect(manualAction(def, run)).toBe(run);
  });
});

describe("manual action", () => {
  it("always earns the phase's resource, even with nothing else", () => {
    let run = newRun(def);
    expect(manualGain(def, run)).toBeGreaterThan(0);
    run = tick(def, withCoins(run, 100, 100), 0.1);
    expect(run.phase).toBe(1);
    expect(manualGain(def, run)).toBeGreaterThan(0);
    const broke = { ...run, resources: { coins: 0, total: 0, glow: 0 } };
    expect(manualGain(def, broke)).toBeGreaterThan(0);
  });

  it("counts taps", () => {
    const run = manualAction(def, manualAction(def, newRun(def)));
    expect(run.taps).toBe(2);
    expect(run.resources.coins).toBe(2);
  });
});

describe("story", () => {
  it("fires each message once, in order", () => {
    let run = newRun(def);
    for (let i = 0; i < 60; i += 1) run = manualAction(def, run);
    expect(run.story).toEqual(["hello", "halfway"]);
    run = tick(def, run, 0.1);
    run = tick(def, run, 0.1);
    expect(run.story).toEqual(["hello", "halfway"]);
  });

  it("fires phase-bound messages on entering the phase", () => {
    const run = tick(def, withCoins(newRun(def), 100, 100), 0.1);
    expect(run.story).toEqual(["hello", "halfway", "bright"]);
  });
});

describe("rng", () => {
  it("is deterministic and in [0, 1)", () => {
    const a = { rng: 42 };
    const b = { rng: 42 };
    const seq = Array.from({ length: 50 }, () => nextRandom(a));
    expect(seq).toEqual(Array.from({ length: 50 }, () => nextRandom(b)));
    expect(seq.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(seq).size).toBeGreaterThan(40);
  });
});

describe("non-finite resources", () => {
  it("resets a resource a hook left as NaN or Infinity to 0", () => {
    const broken = {
      ...def,
      tick: () => undefined,
      manualAction: (run: RunState) => {
        run.resources.coins = NaN;
        run.resources.total = Infinity;
      },
    };
    const run = manualAction(broken, newRun(broken));
    expect(run.resources.coins).toBe(0);
    expect(run.resources.total).toBe(0);
    const ticked = tick(
      {
        ...broken,
        tick: (r: RunState) => {
          r.resources.glow = -Infinity;
        },
      },
      run,
      1
    );
    expect(ticked.resources.glow).toBe(0);
  });
});

describe("reconcileRun", () => {
  it("fills resources a newer release added with their defaults", () => {
    const old = newRun(def);
    delete old.resources.glow;
    const run = reconcileRun(def, old);
    expect(run.resources.glow).toBe(0);
    expect(run.resources.coins).toBe(old.resources.coins);
  });

  it("uses a resource's initial value", () => {
    const withInitial = {
      ...def,
      resources: [...def.resources, { id: "new", label: "New", initial: 7 }],
    };
    expect(reconcileRun(withInitial, newRun(def)).resources.new).toBe(7);
  });

  it("replaces non-finite numbers and drops odd mods", () => {
    const old = newRun(def);
    const damaged = JSON.parse(
      JSON.stringify({
        ...old,
        time: NaN,
        resources: { ...old.resources, coins: NaN },
        owned: { lens: -2, gen: 3 },
        mods: { mult: NaN, costMult: -4, other: 2 },
      })
    );
    const run = reconcileRun(def, damaged);
    expect(run.time).toBe(0);
    expect(run.resources.coins).toBe(0);
    expect(run.owned).toEqual({ gen: 3 });
    expect(run.mods).toEqual({ other: 2 });
  });

  it.each([5, -1, 1.5, NaN])("starts a fresh run for phase %s", (phase) => {
    const run = reconcileRun(def, { ...newRun(def), phase, taps: 99 });
    expect(run.phase).toBe(0);
    expect(run.taps).toBe(0);
  });

  it("leaves a healthy run as it was", () => {
    const run = buy(def, withCoins(newRun(def), 100), "gen");
    expect(reconcileRun(def, run)).toEqual(run);
  });
});
