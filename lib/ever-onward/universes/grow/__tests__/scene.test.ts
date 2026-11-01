import { manualAction, tick } from "../../../engine/engine";
import { sceneInfo } from "..";
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
    expect(sceneInfo(run).dry).toBe(false);
    const dry = withWater(run, 0);
    expect(sceneInfo(dry).dry).toBe(true);
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
});
