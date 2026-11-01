import { newRun } from "../../../engine/engine";
import { lightAlert } from "../alerts";
import { sceneInfo } from "../scene";
import { lightUniverse } from "../index";

describe("lamp alerts", () => {
  it("warns when the coast lamp is out of oil, and only then", () => {
    const run = newRun(lightUniverse);
    run.resources.oil = 10;
    expect(lightAlert(run)).toBeNull();
    expect(sceneInfo(run).lampDry).toBe(0);
    run.resources.oil = 0;
    expect(lightAlert(run)).toMatch(/Out of oil!.*30% less/);
    expect(sceneInfo(run).lampDry).toBe(1);
  });

  it("stays quiet after the coast", () => {
    const run = newRun(lightUniverse);
    run.resources.oil = 0;
    run.phase = 1;
    expect(lightAlert(run)).toBeNull();
    expect(sceneInfo(run).lampDry).toBe(0);
  });
});
