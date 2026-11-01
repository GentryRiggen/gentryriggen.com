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
});
