import { performAction, tick } from "../../../engine/engine";
import type { RunState } from "../../../engine/types";
import {
  CROPS,
  FIELD_CROPS,
  PLANT_ACTION_IDS,
  bandOf,
  daySeconds,
  demandOn,
  forecastOf,
  forecastStage,
  grownByHarvest,
  growPay,
  harvestDays,
  isFieldPlanted,
  lastDay,
  likeliestCrop,
  plantActionId,
  plantedCrop,
  soilFactor,
  soilOf,
  wearsSoil,
} from "../market";
import { TUNING } from "../tuning";
import { def, runAtPhaseStart } from "./fixtures";

const M = TUNING.market;
const S = TUNING.soil;

/** A fresh farm at the very start of a harvest day. */
const freshFarm = (): RunState => {
  const start = runAtPhaseStart(1);
  return {
    ...start,
    resources: { ...start.resources, mkDay: 0, mkField: 0, mkLast: 0 },
  };
};

/** Ticks the farm one second at a time. */
function walk(
  from: RunState,
  seconds: number,
  look: (run: RunState) => void = () => {}
): RunState {
  let run = from;
  for (let t = 0; t < seconds; t += 1) {
    run = tick(def, run, 1);
    look(run);
  }
  return run;
}

/** Plants `crop` when the day is `at` seconds old, then plays to the next harvest day. */
function dayWith(
  run: RunState,
  crop: (typeof FIELD_CROPS)[number],
  at: number
) {
  let r = walk(run, Math.max(0, at - daySeconds(run)));
  r = performAction(def, r, plantActionId(crop));
  return walk(r, M.daySeconds - daySeconds(r) + 1);
}

describe("harvest day", () => {
  it("comes every day length, and a field left empty sends the cart home", () => {
    const start = freshFarm();
    const after = walk(start, M.daySeconds + 1);
    expect(harvestDays(after)).toBe(harvestDays(start) + 1);
    expect(lastDay(after).mood).toBe("empty");
    expect(lastDay(after).pays).toBe(0);
  });

  it("firms the forecast up in three steps as the day comes closer", () => {
    const stages: number[] = [];
    walk(freshFarm(), M.daySeconds - 2, (run) => {
      stages.push(forecastStage(run));
    });
    expect(stages[0]).toBe(0);
    expect(stages[stages.length - 1]).toBe(2);
    expect(new Set(stages)).toEqual(new Set([0, 1, 2]));
    expect([...stages].sort()).toEqual(stages);
    expect([bandOf(0), bandOf(1), bandOf(2)]).toEqual([M.luck, M.luck / 2, 0]);
  });

  it("is honest: what the towns really want is always inside the shown range", () => {
    for (let day = 0; day < 6; day += 1) {
      let run = freshFarm();
      run = walk(run, day * (M.daySeconds + 1));
      const truth = Object.fromEntries(
        FIELD_CROPS.map((c) => [c, demandOn(run, c)])
      );
      walk(run, M.daySeconds - daySeconds(run) - 1, (r) => {
        if (harvestDays(r) !== harvestDays(run)) return;
        for (const crop of FIELD_CROPS) {
          const f = forecastOf(r, crop);
          expect(Math.abs(f.middle - truth[crop])).toBeLessThanOrEqual(
            f.band + 1e-6
          );
        }
      });
    }
  });

  it("is sure at the end: the middle of the forecast is the real demand", () => {
    const run = walk(freshFarm(), M.daySeconds - 5);
    expect(forecastStage(run)).toBe(2);
    for (const crop of CROPS)
      expect(forecastOf(run, crop).middle).toBeCloseTo(demandOn(run, crop), 6);
  });

  it("leaves run.rng alone and plays out the same way every time", () => {
    const start = freshFarm();
    const end = walk(start, M.daySeconds * 3);
    expect(end.rng).toBe(start.rng);
    expect(end.resources.mkRng).not.toBe(start.resources.mkRng);
    const again = walk(start, M.daySeconds * 3);
    expect(CROPS.map((c) => demandOn(again, c))).toEqual(
      CROPS.map((c) => demandOn(end, c))
    );
  });

  it("keeps every crop's demand worth growing and moves what is wanted", () => {
    const best = new Set<string>();
    walk(freshFarm(), M.daySeconds * 40, (run) => {
      for (const crop of CROPS) {
        expect(demandOn(run, crop)).toBeGreaterThanOrEqual(
          M.demandFloor - 0.001
        );
        expect(demandOn(run, crop)).toBeLessThan(2.4);
      }
      best.add(
        CROPS.reduce((a, b) => (demandOn(run, b) > demandOn(run, a) ? b : a))
      );
    });
    expect(best.size).toBe(CROPS.length);
  });
});

describe("planting", () => {
  it("a crop planted early is full grown and pays more than one planted late", () => {
    const early = dayWith(freshFarm(), "corn", 5);
    const late = dayWith(freshFarm(), "corn", M.daySeconds - 20);
    expect(lastDay(early).grown).toBe(1);
    expect(lastDay(late).grown).toBeLessThan(0.4);
    expect(growPay(lastDay(late).grown)).toBeLessThan(growPay(1));
    expect(growPay(0)).toBeGreaterThan(0);
  });

  it("a wrong guess still sells, just for less (and the crowd droops)", () => {
    const start = walk(freshFarm(), 1);
    const day = (crop: (typeof CROPS)[number]) =>
      lastDay(dayWith(start, crop, 5));
    const results = CROPS.map(day);
    const best = results.reduce((a, b) => (b.demand > a.demand ? b : a));
    const worst = results.reduce((a, b) => (b.demand < a.demand ? b : a));
    expect(best.mood).toBe("cheer");
    expect(worst.pays).toBeGreaterThan(0);
    expect(worst.pays).toBeLessThan(best.pays);
    expect(worst.mood).toBe("droop");
  });

  it("replanting a different crop starts it again from a seed", () => {
    let run = walk(freshFarm(), 20);
    run = performAction(def, run, plantActionId("corn"));
    run = walk(run, 60);
    expect(grownByHarvest(run)).toBeGreaterThan(0.9);
    run = performAction(def, run, plantActionId("tomato"));
    expect(plantedCrop(run)).toBe("tomato");
    expect(grownByHarvest(run)).toBeLessThanOrEqual(0.5);
  });

  it("offers one plant button per crop, beans included, only on the farm", () => {
    expect(PLANT_ACTION_IDS).toHaveLength(FIELD_CROPS.length);
    expect(FIELD_CROPS).toContain("beans");
    for (const id of PLANT_ACTION_IDS) {
      const action = def.actions!.find((a) => a.id === id)!;
      expect(action.phases).toEqual(["farm"]);
    }
  });

  it("never names a best crop on a plant button", () => {
    const run = walk(freshFarm(), 60);
    for (const id of PLANT_ACTION_IDS) {
      const view = def.actions!.find((a) => a.id === id)!.describe(run);
      expect(`${view.label} ${view.detail ?? ""}`).not.toMatch(
        /best|recommend|most wanted|you should/i
      );
      expect(view.hint).toBeUndefined();
    }
  });

  it("is the market agent's job to plant, a while into the day, never to rest the soil", () => {
    const base = freshFarm();
    let run: RunState = {
      ...base,
      owned: { ...base.owned, "market-agent": 1 },
    };
    run = walk(run, M.agentAt - 5);
    expect(isFieldPlanted(run)).toBe(false);
    run = walk(run, 10);
    expect(isFieldPlanted(run)).toBe(true);
    expect(plantedCrop(run)).not.toBe("beans");
  });
});

describe("the soil", () => {
  it("wears when the same crop is grown twice in a row", () => {
    let run = freshFarm();
    const start = soilOf(run);
    run = dayWith(run, "corn", 5);
    expect(soilOf(run)).toBeCloseTo(start);
    expect(wearsSoil(run, "corn")).toBe(true);
    expect(wearsSoil(run, "tomato")).toBe(false);
    run = dayWith(run, "corn", 5);
    expect(soilOf(run)).toBeCloseTo(start - S.wear);
    expect(soilFactor(run)).toBeLessThan(soilFactor(freshFarm()));
  });

  it("does not wear when the crops are rotated", () => {
    let run = freshFarm();
    const start = soilOf(run);
    for (const crop of ["corn", "tomato", "pumpkin", "corn"] as const)
      run = dayWith(run, crop, 5);
    expect(soilOf(run)).toBeCloseTo(start);
  });

  it("rests after beans, which pay a steady little, and is richer for it", () => {
    let run = freshFarm();
    run = dayWith(run, "corn", 5);
    run = dayWith(run, "corn", 5);
    const worn = soilOf(run);
    run = dayWith(run, "beans", 5);
    expect(lastDay(run).mood).toBe("beans");
    expect(lastDay(run).pays).toBeGreaterThan(0);
    expect(soilOf(run)).toBeCloseTo(Math.min(1, worn + S.rest));
    expect(soilOf(run)).toBeGreaterThan(worn);
    // beans twice do not wear it
    run = dayWith(run, "beans", 5);
    expect(soilOf(run)).toBeGreaterThanOrEqual(worn + S.rest - 1e-9);
  });

  it("changes what every yield pays, and stays between worn out and rich", () => {
    const run = freshFarm();
    const at = (soil: number): RunState => ({
      ...run,
      resources: { ...run.resources, mkSoil: soil },
    });
    expect(soilFactor(at(0))).toBeCloseTo(S.floor);
    expect(soilFactor(at(1))).toBeCloseTo(S.floor + S.reach);
    expect(soilFactor(at(0))).toBeLessThan(soilFactor(at(0.6)));
    expect(soilFactor(at(0.6))).toBeLessThan(soilFactor(at(1)));
  });
});

describe("old saves", () => {
  it("set the farm up from scratch on the first tick", () => {
    const start = runAtPhaseStart(1);
    const bare: RunState = {
      ...start,
      resources: Object.fromEntries(
        Object.entries(start.resources).filter(([k]) => !k.startsWith("mk"))
      ),
    };
    const run = tick(def, bare, 1);
    expect(run.resources.mkReady).toBe(1);
    expect(isFieldPlanted(run)).toBe(false);
    expect(soilOf(run)).toBeCloseTo(S.start);
  });
});

describe("the forecast is a real bet", () => {
  /** Harvest earned over `days` days by planting the forecast's pick `at` seconds into every day. */
  function earnedPlantingAt(at: number, days: number): number {
    const start = freshFarm();
    let run: RunState = {
      ...start,
      owned: { ...start.owned, scarecrow: 5 },
    };
    const before = run.resources.harvest ?? 0;
    for (let t = 0; t < M.daySeconds * days; t += 1) {
      run = tick(def, run, 1);
      if (!isFieldPlanted(run) && daySeconds(run) >= at)
        run = performAction(def, run, plantActionId(likeliestCrop(run)));
    }
    return (run.resources.harvest ?? 0) - before;
  }

  it("planting a little into the day beats planting at second 0, and planting late loses", () => {
    const days = 120;
    const early = earnedPlantingAt(0, days);
    const mid = earnedPlantingAt(Math.ceil(M.daySeconds / 3) + 1, days);
    const late = earnedPlantingAt(Math.ceil((M.daySeconds * 2) / 3) + 5, days);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeLessThan(mid);
  });
});
