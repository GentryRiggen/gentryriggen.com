import {
  canPerformAction,
  manualAction,
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import { def, runAtPhaseStart } from "./fixtures";
import { BEAM_STEPS, bestBeamStep, beamNumbers } from "../beam";
import { isFundOpen } from "../fund";
import { FORKS } from "../forks";
import { lightGoal } from "../goal";
import { isTideOpen } from "../tide";
import {
  autoFlashRate,
  beamStep,
  burnPerSecond,
  isBeamOpen,
  lampFactor,
  setBeam,
  shipsPerFlash,
  tankCapacity,
} from "../tick";
import { TUNING } from "../tuning";
import { COAST_LIGHTHOUSES } from "../resources";

const C = TUNING.coast;

const coast = (
  owned: Record<string, number> = {},
  resources: Record<string, number> = {}
): RunState => {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    owned,
    resources: { ...base.resources, ...resources },
  });
};

describe("the goal meter", () => {
  it("is the lighthouses, on the Coast", () => {
    const goal = lightGoal(coast());
    expect(goal).toMatchObject({
      label: "LIGHT THE COAST",
      current: 1,
      target: COAST_LIGHTHOUSES,
      unit: "lighthouses",
    });
    expect(goal?.next).toMatch(/^Next lighthouse: .+ coins$/);
    expect(def.goalMeter?.(coast())).toEqual(goal);
  });

  it("counts the lighthouses built and shows how close the next one is", () => {
    const poor = lightGoal(coast({ lighthouse: 2 }, { coins: 0 }));
    expect(poor?.current).toBe(3);
    expect(poor?.progress).toBe(0);
    const rich = lightGoal(coast({ lighthouse: 2 }, { coins: 1e12 }));
    expect(rich?.progress).toBe(1);
  });

  it("shows a chapter goal in every later part", () => {
    for (const phase of [1, 2, 3])
      expect(lightGoal({ ...coast(), phase })).not.toBeNull();
  });

  it("is quiet once the coast is lit", () => {
    expect(lightGoal(coast({ lighthouse: COAST_LIGHTHOUSES - 1 }))).toBeNull();
  });
});

describe("keepers and lighthouses compound", () => {
  const rate = (owned: Record<string, number>): number =>
    autoFlashRate(coast(owned));

  it("doubles every keeper's work at 5, 10, 25 and 40 keepers", () => {
    for (const m of C.keeperMilestones) {
      const before = rate({ keeper: m - 1 }) / (m - 1);
      const at = rate({ keeper: m }) / m;
      expect(at / before).toBeCloseTo(C.keeperMilestoneMult, 6);
    }
  });

  it("doubles the ships with every lighthouse", () => {
    for (let n = 1; n < COAST_LIGHTHOUSES; n += 1)
      expect(rate({ keeper: 5, lighthouse: n })).toBeCloseTo(
        rate({ keeper: 5, lighthouse: n - 1 }) * C.lighthouseMult,
        8
      );
  });

  it("caps keepers at 40", () => {
    const keeper = def.upgrades.find((u) => u.id === "keeper")!;
    expect(keeper.maxLevel).toBe(40);
    expect(keeper.baseCost).toBe(15);
  });

  it("costs what the table says (the Coast is priced directly)", () => {
    const keeper = def.upgrades.find((u) => u.id === "keeper")!;
    const lens = def.upgrades.find((u) => u.id === "lens")!;
    expect(keeper.baseCost).toBe(15);
    expect(lens.baseCost).toBe(85);
  });
});

describe("the lamp's brightness", () => {
  it("opens with the first keeper and starts at Normal", () => {
    expect(isBeamOpen(coast())).toBe(false);
    expect(isBeamOpen(coast({ keeper: 1 }))).toBe(true);
    expect(beamStep(coast({ keeper: 1 }))).toBe(1);
    expect(BEAM_STEPS.map((s) => s.label)).toEqual([
      "Dim",
      "Normal",
      "Bright",
      "Blazing",
    ]);
  });

  it("reads an old save with no brightness as Normal", () => {
    const old = coast({ keeper: 3 });
    delete old.resources.lampBeam;
    expect(beamStep(old)).toBe(1);
    expect(
      beamStep({ ...old, resources: { ...old.resources, lampBeam: NaN } })
    ).toBe(1);
    expect(Number.isFinite(tick(def, old, 1).resources.coins)).toBe(true);
  });

  it("scales ships per flash and keeper flashes by the step", () => {
    const normal = coast({ keeper: 5 });
    BEAM_STEPS.forEach((step, i) => {
      const run = coast({ keeper: 5 }, { lampBeam: i });
      expect(shipsPerFlash(run) / shipsPerFlash(normal)).toBeCloseTo(step.pay);
      expect(autoFlashRate(run) / autoFlashRate(normal)).toBeCloseTo(step.pay);
    });
  });

  it("scales the oil burned by the step, tank and all", () => {
    const normal = coast({ keeper: 5 });
    const burn = (run: RunState): number =>
      burnPerSecond(run, autoFlashRate(run));
    BEAM_STEPS.forEach((step, i) => {
      const run = coast({ keeper: 5 }, { lampBeam: i });
      expect(burn(run) / burn(normal)).toBeCloseTo(step.burn);
      // the tank is the same size whatever the knob says
      expect(tankCapacity(run)).toBeCloseTo(tankCapacity(normal));
    });
  });

  it("is set by an action, one step at a time, and only on the Coast", () => {
    const run = coast({ keeper: 2 });
    expect(canPerformAction(def, run, "lamp-3")).toBe(true);
    expect(canPerformAction(def, run, "lamp-1")).toBe(false);
    const blazing = performAction(def, run, "lamp-3");
    expect(beamStep(blazing)).toBe(3);
    expect(blazing.resources.lampBeamChanges).toBe(1);
    expect(canPerformAction(def, coast(), "lamp-3")).toBe(false);
    expect(beamStep(setBeamOn(run, 99))).toBe(BEAM_STEPS.length - 1);
    expect(beamStep(setBeamOn(run, -4))).toBe(0);
  });

  it("burns your own flashes' oil too, so brightness is never free", () => {
    const run = coast({ keeper: 2 }, { lampBeam: 3, oil: 30, coins: 0 });
    const tapped = manualAction(def, run);
    expect(tapped.resources.oil).toBeLessThan(30);
    // and a dimmer lamp burns less per flash
    const dim = manualAction(
      def,
      coast({ keeper: 2 }, { lampBeam: 0, oil: 30 })
    );
    expect(30 - dim.resources.oil).toBeLessThan(30 - tapped.resources.oil);
  });

  it("leaves the lamp dim when the oil runs out, whatever the step", () => {
    const dry = (step: number) =>
      lampFactor(coast({ keeper: 2 }, { lampBeam: step, oil: 0 })) *
      BEAM_STEPS[step].pay;
    for (let i = 0; i < BEAM_STEPS.length; i += 1)
      expect(dry(i)).toBeCloseTo(C.dimLamp);
  });

  it("changes which step is best as the oil price moves: blaze when cheap, dim when dear", () => {
    const at = (price: number): number =>
      bestBeamStep(
        coast({ keeper: 10, lighthouse: 2 }, { oilPrice: price, oil: 500 })
      );
    expect(at(0.3)).toBe(3);
    expect(at(3.5)).toBe(0);
    const steps = [0.3, 0.8, 1.5, 2.2, 3.5, 5].map(at);
    for (let i = 1; i < steps.length; i += 1)
      expect(steps[i]).toBeLessThanOrEqual(steps[i - 1]);
    expect(new Set(steps).size).toBeGreaterThanOrEqual(3);
  });

  it("previews what each step would earn after the oil, and how long the tank lasts", () => {
    const run = coast({ keeper: 10 }, { oilPrice: 2, oil: 100 });
    const numbers = BEAM_STEPS.map((_, i) => beamNumbers(run, i));
    // dimmer: the tank lasts longer
    for (let i = 1; i < numbers.length; i += 1)
      expect(numbers[i].tankSeconds).toBeLessThan(numbers[i - 1].tankSeconds);
    // the current step's preview matches the run
    expect(numbers[beamStep(run)].net).toBeGreaterThan(0);
  });
});

describe("what the Coast no longer has", () => {
  it("has no fund, however rich", () => {
    expect(isFundOpen(coast({ keeper: 40 }, { ships: 1e9, coins: 1e12 }))).toBe(
      false
    );
  });

  it("has no tide clock: the fish market only builds a market", () => {
    let run = coast({ keeper: 5, "dock-1": 1 });
    for (let i = 0; i < 400; i += 1) run = tick(def, run, 1);
    expect(isTideOpen(run)).toBe(false);
    expect(def.upgrades.map((u) => u.id)).not.toContain("nets-1");
    expect(def.upgrades.map((u) => u.id)).not.toContain("tide-mill");
  });

  it("shows the fork at four lighthouses, not before", () => {
    const fork = FORKS.find((f) => f.id === "coast")!;
    expect(fork.isOpen(coast({ lighthouse: 2 }, { ships: 1e6 }))).toBe(false);
    expect(fork.isOpen(coast({ lighthouse: 3 }))).toBe(true);
  });

  it("loads an old mid-Coast save, with the tide clock still ticking", () => {
    const old = coast(
      { keeper: 10, lighthouse: 4, "nets-1": 1, "tide-mill": 1, "dock-1": 1 },
      { coins: 5000 }
    );
    old.flags["tide-open"] = true;
    delete old.resources.lampBeam;
    const loaded = reconcileRun(def, old);
    expect(isTideOpen(loaded)).toBe(true);
    let run = loaded;
    for (let i = 0; i < 60; i += 1) run = tick(def, run, 1);
    for (const value of Object.values(run.resources))
      expect(Number.isFinite(value)).toBe(true);
  });
});

function setBeamOn(run: RunState, step: number): RunState {
  const draft = { ...run, resources: { ...run.resources } };
  setBeam(draft, step);
  return draft;
}

describe("an old Coast save with coins in the jar", () => {
  it("hands the coins back on the next tick", () => {
    const run = runAtPhaseStart(0);
    run.resources.coins = 10;
    run.resources.fund = 500;
    def.tick(run, 0.1);
    expect(run.resources.fund).toBe(0);
    expect(run.resources.coins).toBeGreaterThanOrEqual(510);
  });
});
