import { tick } from "../../../engine/engine";
import { sceneInfo, type HigherSceneInfo } from "..";
import { isSameSceneInfo } from "../scene";
import { def, runAtPhaseStart, withResources } from "./fixtures";

describe("Higher sceneInfo", () => {
  it.each([0, 1, 2, 3])("describes the picture of phase %i", (i) => {
    const info = sceneInfo(runAtPhaseStart(i));
    expect(info.phase).toBe(def.phases[i].id);
    expect(info.height).toBeGreaterThanOrEqual(0);
    expect(info.lean).toBeGreaterThanOrEqual(0);
    expect(info.lean).toBeLessThanOrEqual(4);
  });

  it("only holds the upgrades of its own phase", () => {
    const own = sceneInfo(runAtPhaseStart(1)).own;
    expect(Object.keys(own)).toContain("mason");
    expect(Object.keys(own)).not.toContain("bear");
  });

  it("stays the same across a tiny tick, so the layers skip redrawing", () => {
    const run = runAtPhaseStart(0);
    expect(
      isSameSceneInfo(sceneInfo(tick(def, run, 0.1)), sceneInfo(run))
    ).toBe(true);
  });

  it("changes when the tower leans, a footing is laid or a load arrives", () => {
    const run = { ...runAtPhaseStart(0), owned: { bear: 4 } };
    const base: HigherSceneInfo = sceneInfo(run);
    expect(
      isSameSceneInfo(base, sceneInfo(withResources(run, { sway: 0.9 })))
    ).toBe(false);
    expect(
      isSameSceneInfo(base, sceneInfo(withResources(run, { ftStock: 5e4 })))
    ).toBe(false);
    expect(
      isSameSceneInfo(base, sceneInfo(withResources(run, { dlStage: 1 })))
    ).toBe(false);
  });

  it("shows how far down the robot is on the last part", () => {
    const run = runAtPhaseStart(3);
    expect(sceneInfo(run).descent).toBe(0);
    expect(sceneInfo(withResources(run, { descent: 50 })).descent).toBe(10);
  });
});
