import { performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import {
  CROPS,
  PLANT_ACTION_IDS,
  bestCrop,
  cropPrice,
  demandOf,
  leastWanted,
  plantActionId,
  plantedCrop,
  plantingsSoFar,
  sproutFactor,
} from "../market";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

const M = TUNING.market;

/** A fresh farm, with the market's wave started at this angle. */
const farmAt = (angle = 0): RunState => {
  const start = runAtPhaseStart(1);
  return { ...start, resources: { ...start.resources, mkAngle: angle } };
};

/** Ticks the farm along, handing back the run at each of these times. */
function walk(
  from: RunState,
  seconds: number,
  every: number,
  look: (run: RunState) => void
): RunState {
  let run = from;
  for (let t = 0; t < seconds; t += 1) {
    run = tick(def, run, 1);
    if (t % every === 0) look(run);
  }
  return run;
}

describe("the market", () => {
  it("pays at least 1.3x more for the crop in demand than the least wanted", () => {
    let worst = Infinity;
    for (const angle of [0, 1, 2, 3, 4, 5]) {
      walk(farmAt(angle), 1800, 5, (run) => {
        const ratio =
          cropPrice(run, bestCrop(run)) / cropPrice(run, leastWanted(run));
        worst = Math.min(worst, ratio);
      });
    }
    expect(worst).toBeGreaterThanOrEqual(1.3);
  });

  it("moves demand so no crop is always best over a 30-minute farm", () => {
    for (const angle of [0, 2, 4]) {
      let last = bestCrop(farmAt(angle));
      let changes = 0;
      const seen = new Set<string>([last]);
      walk(farmAt(angle), 1800, 1, (run) => {
        const now = bestCrop(run);
        if (now !== last) changes += 1;
        last = now;
        seen.add(now);
      });
      expect(changes).toBeGreaterThanOrEqual(3);
      expect(seen.size).toBe(CROPS.length);
    }
  });

  it("drifts on its own stream and leaves run.rng alone", () => {
    const start = farmAt(1);
    const end = walk(start, 600, 600, () => {});
    expect(end.rng).toBe(start.rng);
    expect(end.resources.mkRng).not.toBe(start.resources.mkRng);
    // the same farm plays out the same way
    const again = walk(start, 600, 600, () => {});
    expect(CROPS.map((c) => demandOf(again, c))).toEqual(
      CROPS.map((c) => demandOf(end, c))
    );
  });

  it("shows the towns' asks as orders that are always worth something", () => {
    walk(farmAt(2), 900, 3, (run) => {
      for (const crop of CROPS) {
        expect(demandOf(run, crop)).toBeGreaterThan(0.5);
        expect(demandOf(run, crop)).toBeLessThan(1.6);
      }
    });
  });

  it("plants a new crop, which sprouts for a little while, never for nothing", () => {
    const run = farmAt(0);
    const other = CROPS.find((c) => c !== plantedCrop(run))!;
    const planted = performAction(def, run, plantActionId(other));
    expect(plantedCrop(planted)).toBe(other);
    expect(sproutFactor(planted)).toBeCloseTo(M.sproutFloor);
    expect(sproutFactor(planted)).toBeGreaterThan(0);
    const grown = walk(planted, M.sproutSeconds + 1, 100, () => {});
    expect(sproutFactor(grown)).toBe(1);
  });

  it("offers one plant button per crop, only on the farm", () => {
    expect(PLANT_ACTION_IDS).toHaveLength(CROPS.length);
    for (const id of PLANT_ACTION_IDS) {
      const action = def.actions!.find((a) => a.id === id)!;
      expect(action.phases).toEqual(["farm"]);
    }
  });

  it("has the market agent re-plant to demand, but only now and then", () => {
    const base = farmAt(0);
    const worst = leastWanted(base);
    // the field is planted with the crop nobody wants, and the agent is hired
    let run: RunState = {
      ...base,
      owned: { ...base.owned, "market-agent": 1 },
      resources: {
        ...base.resources,
        mkCrop: CROPS.indexOf(worst),
      },
    };
    run = walk(run, M.agentSeconds / 2, 100, () => {});
    expect(plantedCrop(run)).toBe(worst);
    run = walk(run, M.agentSeconds * 3, 100, () => {});
    expect(plantingsSoFar(run)).toBeGreaterThanOrEqual(1);
  });
});
