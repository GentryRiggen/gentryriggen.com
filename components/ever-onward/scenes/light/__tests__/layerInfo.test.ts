import { performAction, tick } from "@/lib/ever-onward/engine/engine";
import { launchActionId } from "@/lib/ever-onward/universes/light/probes";
import { sceneInfo } from "@/lib/ever-onward/universes/light";
import {
  def,
  runAtPhaseStart,
} from "@/lib/ever-onward/universes/light/__tests__/fixtures";
import { isSameLayerInfo } from "../layerInfo";

/** Ticks a run in tenths of a second and counts how often the layers would redraw. */
function redraws(phase: number): { total: number; changed: number } {
  let run = runAtPhaseStart(phase);
  for (let i = 0; i < 600; i += 1) run = tick(def, run, 1);
  let changed = 0;
  const total = 100;
  for (let i = 0; i < total; i += 1) {
    const before = { info: sceneInfo(run) };
    run = tick(def, run, 0.1);
    if (!isSameLayerInfo(before, { info: sceneInfo(run) })) changed += 1;
  }
  return { total, changed };
}

describe("layer info", () => {
  it.each([1, 3])(
    "mostly stays the same from one tick to the next in phase %i",
    (phase) => {
      const { total, changed } = redraws(phase);
      expect(changed).toBeLessThan(total * 0.15);
    }
  );

  it("redraws the coast only in twelve steps as the tide moves", () => {
    const base = runAtPhaseStart(0);
    let run = tick(
      def,
      { ...base, owned: { ...base.owned, "dock-1": 1 } },
      0.1
    );
    expect(sceneInfo(run).tideOpen).toBe(1);
    const levels = new Set<number>();
    let changed = 0;
    let levelSteps = 0;
    for (let i = 0; i < 1750; i += 1) {
      const before = { info: sceneInfo(run) };
      run = tick(def, run, 0.1);
      const after = sceneInfo(run);
      levels.add(after.tideLevel);
      if (after.tideLevel !== before.info.tideLevel) levelSteps += 1;
      if (!isSameLayerInfo(before, { info: after })) changed += 1;
    }
    // one full wave: 12 steps up and 12 down, nothing like one redraw a tick
    expect(levels.size).toBeLessThanOrEqual(13);
    expect(levelSteps).toBeLessThanOrEqual(26);
    expect(changed).toBeLessThan(1750 * 0.05);
  });

  it("redraws the sky only when a probe leaves or comes home, not as it flies", () => {
    let run = tick(
      def,
      { ...runAtPhaseStart(2), owned: { collector: 5, probe: 1, "nav-1": 1 } },
      0.1
    );
    expect(sceneInfo(run).raceOpen).toBe(1);
    run = performAction(def, run, launchActionId(1));
    let changed = 0;
    for (let i = 0; i < 1000; i += 1) {
      const before = { info: sceneInfo(run) };
      run = tick(def, run, 0.1);
      const after = sceneInfo(run);
      if (before.info.raceOut !== after.raceOut) changed += 1;
      expect(after.raceOpen).toBe(1);
    }
    // out for 90 s, then home: the picture changed once on the way back
    expect(changed).toBe(1);
    expect(sceneInfo(run).raceOut).toBe(0);
  });

  it("ignores the numbers only the caption reads", () => {
    const info = sceneInfo(runAtPhaseStart(1));
    expect(
      isSameLayerInfo(
        { info },
        { info: { ...info, cities: info.cities + 1, ships: 99 } }
      )
    ).toBe(true);
    expect(
      isSameLayerInfo({ info }, { info: { ...info, gen1: info.gen1 + 1 } })
    ).toBe(false);
  });
});
