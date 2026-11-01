import { manualAction, tick, visitorHereFlag } from "../../../engine/engine";
import { sceneInfo } from "..";
import { plantCrop } from "../market";
import { RETURN_VISITOR_ID } from "../visitors";
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
    expect(sceneInfo(dry).dry).toBe(true);
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

    it("shows migrants once a flock has landed", () => {
      const run = runAtPhaseStart(2);
      expect(sceneInfo(run).migrated).toBe(false);
      const landed = {
        ...run,
        resources: { ...run.resources, mgFlights: 1 },
      };
      expect(sceneInfo(landed).migrated).toBe(true);
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

  describe("the last seed", () => {
    const seedRun = (growth: number, owned: Record<string, number> = {}) => {
      const run = runAtPhaseStart(3);
      run.resources.growth = growth;
      run.owned = { ...run.owned, ...owned };
      return run;
    };

    it("starts as soil in the dusk, with the window dark and nobody there", () => {
      const info = sceneInfo(seedRun(0));
      expect(info.phase).toBe("seed");
      expect(info.potStage).toBe("soil");
      expect(info.isNight).toBe(false);
      expect(info.windowLit).toBe(false);
      expect(info.visitorHere).toBe(false);
    });

    it("follows the pot's stages and the night", () => {
      expect(sceneInfo(seedRun(10)).potStage).toBe("sprout");
      expect(sceneInfo(seedRun(70)).potStage).toBe("bud");
      expect(sceneInfo(seedRun(70)).isNight).toBe(true);
      expect(sceneInfo(seedRun(100)).potStage).toBe("bloom");
    });

    it("leaves the light on with the lantern, or once the pot is nearly grown", () => {
      expect(sceneInfo(seedRun(10, { "window-lantern": 1 })).windowLit).toBe(
        true
      );
      expect(sceneInfo(seedRun(90)).windowLit).toBe(true);
      expect(sceneInfo(seedRun(50)).windowLit).toBe(false);
    });

    it("shows the visitors when someone comes back, and lists what sits on the sill", () => {
      const run = seedRun(100, { trellis: 2, "wind-chime": 1, "music-box": 1 });
      run.flags[visitorHereFlag(RETURN_VISITOR_ID)] = true;
      const info = sceneInfo(run);
      expect(info.visitorHere).toBe(true);
      expect([info.trellis, info.chime, info.musicBox, info.can]).toEqual([
        true,
        true,
        true,
        false,
      ]);
    });

    it("is quantized: a 0.1 s tick leaves it equal", () => {
      const run = seedRun(20);
      expect(sceneInfo(tick(def, run, 0.1)).potStage).toBe(
        sceneInfo(run).potStage
      );
    });
  });
});
