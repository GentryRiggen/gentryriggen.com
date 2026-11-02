import { newRun, reconcileRun, tick } from "../../../engine/engine";
import { parseSave } from "../../../engine/save";
import type { RunState, SaveData } from "../../../engine/types";
import { def } from "./fixtures";
import { FORKS, chosenSide } from "../forks";
import { fundBalance } from "../fund";
import { isOverdriveOn } from "../overdrive";

/**
 * A save as the build before the trade-offs wrote it: none of the new hidden
 * numbers, no fork flags, and (in the sky) ten collectors, which the picture
 * only ever drew six of.
 */
function oldSave(): string {
  const base = newRun(def);
  const run: RunState = {
    ...base,
    phase: 2,
    time: 4000,
    taps: 900,
    owned: {
      lens: 3,
      keeper: 10,
      lighthouse: 7,
      "fees-1": 1,
      "fees-2": 1,
      "fees-3": 1,
      "wick-1": 1,
      "wick-2": 1,
      "lines-1": 1,
      "lines-2": 1,
      "lines-3": 1,
      "lines-4": 1,
      gen1: 5,
      gen2: 7,
      crank: 2,
      aim: 3,
      collector: 10,
      probe: 1,
      "copy-1": 1,
      "mirror-1": 1,
    },
    resources: {
      ...base.resources,
      energy: 3000,
      collectors: 10,
      probes: 40,
      stars: 900,
      heading: 80,
      knowhow: 55,
    },
    transitions: [
      { from: "coast", to: "night", at: 1800 },
      { from: "night", to: "sky", at: 3600 },
    ],
    revealed: ["aim", "collector", "probe", "mirror-2", "copy-2"],
    story: [],
  };
  // Nothing the trade-offs added exists in an old save.
  for (const id of [
    "fund",
    "fundSince",
    "fundDeposits",
    "fundFees",
    "fundEarned",
    "odLeft",
    "odClean",
    "odRuns",
    "odCleanRuns",
    "odKind",
    "flaresCaught",
    "forkWindAt",
  ])
    delete run.resources[id];
  const save: SaveData = {
    version: 1,
    seenIntro: true,
    universes: {
      light: {
        run,
        best: null,
        completions: 0,
        embers: 0,
        prestigeUpgrades: {},
      },
    },
  };
  return JSON.stringify(save);
}

describe("a Light save from before the trade-offs", () => {
  const loaded = (): RunState => {
    const parsed = parseSave(JSON.parse(oldSave()));
    expect(parsed).not.toBeNull();
    return reconcileRun(def, parsed!.universes.light.run);
  };

  it("loads with an empty fund, no overdrive and no fork chosen", () => {
    const run = loaded();
    expect(fundBalance(run)).toBe(0);
    expect(isOverdriveOn(run)).toBe(false);
    for (const fork of FORKS) expect(chosenSide(run, fork)).toBeNull();
  });

  it("keeps what was bought, trims what no longer exists, and gives the coins back", () => {
    const run = loaded();
    // Ten collectors become the six the sky draws; the other four are paid back.
    expect(run.owned.collector).toBe(6);
    expect(run.resources.energy).toBeGreaterThan(3000);
    expect(run.owned.keeper).toBe(10);
    expect(run.owned["fees-3"]).toBe(1);
    expect(run.owned["lines-4"]).toBe(1);
  });

  it("plays on without a single broken number, through the rest of the sky", () => {
    let run = loaded();
    for (let i = 0; i < 1200; i += 1) run = tick(def, run, 1);
    for (const [id, value] of Object.entries(run.resources))
      expect([id, Number.isFinite(value)]).toEqual([id, true]);
    expect(run.resources.energy).toBeGreaterThan(3000);
    expect(run.resources.stars).toBeLessThan(900);
  });

  it("offers the new things at their milestones", () => {
    const run = loaded();
    const sky = FORKS.find((f) => f.id === "sky")!;
    // The first probe is already out, so the sky's fork is on offer.
    expect(sky.isOpen(run)).toBe(true);
    expect(run.resources.knowhow).toBeGreaterThanOrEqual(55);
  });
});
