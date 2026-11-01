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
});
