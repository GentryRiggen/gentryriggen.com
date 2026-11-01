import { isUniverseUnlocked } from "../progress";
import { endRun, newUniverseSave } from "../prestige";
import { newSave } from "../save";
import type { SaveData, UniverseSave } from "../types";
import { growUniverse } from "@/lib/ever-onward/universes/grow";
import { lightUniverse } from "@/lib/ever-onward/universes/light";

function saveWithLight(light: UniverseSave): SaveData {
  return { ...newSave(), universes: { light } };
}

describe("isUniverseUnlocked", () => {
  it("is always true for a universe with no requirement", () => {
    expect(isUniverseUnlocked(lightUniverse, newSave())).toBe(true);
  });

  it("keeps Grow locked on a fresh save", () => {
    expect(isUniverseUnlocked(growUniverse, newSave())).toBe(false);
  });

  it("unlocks Grow once Light has been finished", () => {
    const light = { ...newUniverseSave(lightUniverse), completions: 1 };
    expect(isUniverseUnlocked(growUniverse, saveWithLight(light))).toBe(true);
  });

  it("keeps Grow locked for a Light run in progress", () => {
    const fresh = newUniverseSave(lightUniverse);
    const light = { ...fresh, run: { ...fresh.run, phase: 2, time: 900 } };
    expect(light.completions).toBe(0);
    expect(isUniverseUnlocked(growUniverse, saveWithLight(light))).toBe(false);
  });

  it("never re-locks after a Light restart", () => {
    const fresh = newUniverseSave(lightUniverse);
    const finished = {
      ...fresh,
      completions: 1,
      run: { ...fresh.run, phase: 2 },
    };
    const restarted = endRun(lightUniverse, finished);
    expect(restarted.completions).toBeGreaterThan(0);
    expect(isUniverseUnlocked(growUniverse, saveWithLight(restarted))).toBe(
      true
    );
    // And again after a second restart from a later phase.
    const again = endRun(lightUniverse, {
      ...restarted,
      run: { ...restarted.run, phase: 3 },
    });
    expect(isUniverseUnlocked(growUniverse, saveWithLight(again))).toBe(true);
  });

  it("unlocks for an old Light save with completions and nothing else new", () => {
    const old = {
      run: newUniverseSave(lightUniverse).run,
      best: 1234,
      completions: 2,
      embers: 5,
      prestigeUpgrades: {},
    } as UniverseSave;
    expect(isUniverseUnlocked(growUniverse, saveWithLight(old))).toBe(true);
  });
});
