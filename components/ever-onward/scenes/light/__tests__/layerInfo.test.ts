import { tick } from "@/lib/ever-onward/engine/engine";
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
