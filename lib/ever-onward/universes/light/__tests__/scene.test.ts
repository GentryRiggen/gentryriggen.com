import { sceneInfo } from "..";
import { tick, manualAction } from "../../../engine/engine";
import { runAtPhaseStart } from "./fixtures";
import { def } from "./fixtures";

describe("sceneInfo", () => {
  for (let phase = 0; phase < def.phases.length; phase += 1) {
    it(`returns finite numbers in ${def.phases[phase].id}`, () => {
      let run = runAtPhaseStart(phase);
      for (let i = 0; i < 20; i += 1) {
        run = manualAction(def, tick(def, run, 1));
        const info = sceneInfo(run);
        expect(info.phase).toBe(def.phases[phase].id);
        for (const [key, value] of Object.entries(info)) {
          if (typeof value === "number") {
            expect([key, Number.isFinite(value)]).toEqual([key, true]);
          }
        }
        for (const key of [
          "coastProgress",
          "beam",
          "citiesProgress",
          "night",
          "powered",
          "starsFraction",
          "lightsFraction",
          "oilFraction",
          "gridSteadiness",
          "fleetHeading",
        ] as const) {
          expect(info[key]).toBeGreaterThanOrEqual(0);
          expect(info[key]).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  it("shows the sky emptying and the lights going out", () => {
    const sky = sceneInfo(runAtPhaseStart(2));
    expect(sky.starsFraction).toBe(1);
    expect(sceneInfo(runAtPhaseStart(3)).lightsFraction).toBe(1);
  });

  it("counts what the upgrades have built", () => {
    const run = runAtPhaseStart(1);
    run.owned = {
      ...run.owned,
      gen1: 3,
      gen3: 2,
      "lines-1": 1,
      "lines-2": 1,
      "bulbs-1": 1,
      "letgo-signs": 1,
      "letgo-night": 1,
    };
    const info = sceneInfo(run);
    expect(info.gen1).toBe(3);
    expect(info.gen2).toBe(0);
    expect(info.gen3).toBe(2);
    expect(info.linesTier).toBe(2);
    expect(info.bulbsTier).toBe(1);
    expect(info.subsTier).toBe(0);
    expect(info.letGoMask).toBe((1 << 1) | (1 << 10));
  });

  it("steps the steadiness and oil so the picture is not redrawn every tick", () => {
    const run = runAtPhaseStart(1);
    run.resources.grid = 63;
    expect(sceneInfo(run).gridSteadiness).toBeCloseTo(0.6);
    const coast = runAtPhaseStart(0);
    coast.resources.oil = 12.3;
    expect(sceneInfo(coast).oilFraction * 10).toBeCloseTo(
      Math.round(sceneInfo(coast).oilFraction * 10)
    );
  });
});
