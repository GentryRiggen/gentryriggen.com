import { manualAction, tick } from "../../../engine/engine";
import { sceneInfo } from "..";
import { plantCrop } from "../market";
import { def, runAtPhaseStart, withWater } from "./fixtures";

describe("Grow sceneInfo", () => {
  it("returns finite, 0-1 fractions through the yard", () => {
    let run = runAtPhaseStart(0);
    for (let i = 0; i < 60; i += 1) {
      run = manualAction(def, tick(def, run, 1));
      const info = sceneInfo(run);
      for (const [key, value] of Object.entries(info)) {
        if (typeof value === "number")
          expect([key, Number.isFinite(value)]).toEqual([key, true]);
      }
      for (const key of ["bloom", "waterFraction"] as const) {
        expect(info[key]).toBeGreaterThanOrEqual(0);
        expect(info[key]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is quantized: one 0.1 s tick in steady play leaves it equal", () => {
    const run = runAtPhaseStart(0);
    const next = tick(def, run, 0.1);
    expect(sceneInfo(next)).toEqual(sceneInfo(run));
  });

  it("shows dry soil when the barrel is empty", () => {
    const run = runAtPhaseStart(0);
    expect(sceneInfo(run).isDry).toBe(false);
    const dry = withWater(run, 0);
    expect(sceneInfo(dry).isDry).toBe(true);
    expect(sceneInfo(dry).waterFraction).toBe(0);
  });

  it("counts what was bought", () => {
    const run = runAtPhaseStart(0);
    run.owned = { ...run.owned, sprinkler: 3, "bee-hive": 2, gardener: 1 };
    const info = sceneInfo(run);
    expect([info.beds, info.sprinklers, info.bees, info.gardeners]).toEqual([
      4, 3, 2, 1,
    ]);
  });

  it("returns finite, quantized farm fractions", () => {
    let run = runAtPhaseStart(1);
    for (let i = 0; i < 60; i += 1) {
      run = manualAction(def, tick(def, run, 1));
      const info = sceneInfo(run);
      for (const [key, value] of Object.entries(info)) {
        if (typeof value === "number")
          expect([key, Number.isFinite(value)]).toEqual([key, true]);
      }
      expect(info.townFed).toBeGreaterThanOrEqual(0);
      expect(info.townFed).toBeLessThanOrEqual(1);
      expect(info.townFed * 10).toBeCloseTo(Math.round(info.townFed * 10));
      expect(info.phase).toBe("farm");
    }
    const run0 = runAtPhaseStart(1);
    expect(sceneInfo(tick(def, run0, 0.1))).toEqual(sceneInfo(run0));
  });

  it("counts what the farm owns", () => {
    const run = runAtPhaseStart(1);
    run.owned = {
      ...run.owned,
      scarecrow: 3,
      tractor: 2,
      glasshouse: 1,
      well: 2,
    };
    const info = sceneInfo(run);
    expect([info.fields, info.tractors, info.greenhouses, info.wells]).toEqual([
      4, 2, 1, 2,
    ]);
  });

  it("shows the planted crop in the fields", () => {
    const run = runAtPhaseStart(1);
    const crops = (["corn", "pumpkin", "tomato"] as const).map((c) => {
      const next = { ...run, resources: { ...run.resources } };
      plantCrop(next, c);
      return sceneInfo(next).crop;
    });
    expect(crops).toEqual(["corn", "pumpkin", "tomato"]);
  });

  it("shows thirsty fields", () => {
    const dry = withWater(runAtPhaseStart(1), 0);
    expect(sceneInfo(dry).isDry).toBe(true);
  });

  describe("world", () => {
    const withShares = (forest: number, jungle = 0, meadow = 0) => {
      const run = runAtPhaseStart(2);
      return {
        ...run,
        resources: {
          ...run.resources,
          bmForest: forest,
          bmJungle: jungle,
          bmMeadow: meadow,
          bmWetland: 0,
        },
      };
    };

    it("turns the globe green as green grows", () => {
      const early = sceneInfo(withShares(0.05));
      const late = sceneInfo(withShares(0.5, 0.2, 0.2));
      expect(late.greenFraction).toBeGreaterThan(early.greenFraction);
      expect(sceneInfo(withShares(1)).greenFraction).toBe(1);
    });

    it("quietly draws fewer roads and towns as the world greens", () => {
      const early = sceneInfo(withShares(0));
      const late = sceneInfo(withShares(0.9));
      expect([early.roadsLeft, early.townsLeft]).toEqual([1, 1]);
      expect(late.roadsLeft).toBeLessThan(early.roadsLeft);
      expect(late.townsLeft).toBeLessThan(early.townsLeft);
      expect(sceneInfo(withShares(1)).townsLeft).toBe(0);
    });

    it("stays finite and quantized, and is bare outside the world", () => {
      const info = sceneInfo(withShares(0.43, 0.17, 0.11));
      for (const key of ["greenFraction", "roadsLeft", "townsLeft"] as const)
        expect([key, Number.isFinite(info[key])]).toEqual([key, true]);
      expect(info.greenFraction * 20).toBeCloseTo(
        Math.round(info.greenFraction * 20)
      );
      const yard = sceneInfo(runAtPhaseStart(0));
      expect([
        yard.greenFraction,
        yard.rivers,
        yard.clouds,
        yard.flocks,
        yard.roadsLeft,
        yard.townsLeft,
      ]).toEqual([0, 0, 0, 0, 0, 0]);
    });

    it("counts rivers, clouds and flocks from what was built", () => {
      const run = runAtPhaseStart(2);
      run.owned = {
        ...run.owned,
        "river-bend": 2,
        "cloud-seeder": 1,
        "sky-seeder": 3,
      };
      const info = sceneInfo(run);
      expect([info.rivers, info.clouds, info.flocks]).toEqual([2, 3, 3]);
    });
  });
});
