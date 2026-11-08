import { describeChanges, formatGain } from "../changes";
import { milestoneGoal, ownsAtLeast } from "../goal";
import { cloneRun, newRun } from "../engine";
import type { UniverseDef, UpgradeDef } from "../types";
import { lightUniverse } from "../../universes/light";

describe("formatGain", () => {
  it("keeps small gains readable", () => {
    expect(formatGain(0.06)).toBe("0.06");
    expect(formatGain(0.4)).toBe("0.4");
    expect(formatGain(-0.06)).toBe("-0.06");
    expect(formatGain(75)).toBe("75");
  });
});

describe("describeChanges", () => {
  const def = lightUniverse as UniverseDef;

  it("names the tap's currency first, then the meter it moved", () => {
    const before = newRun(def);
    before.phase = 3;
    before.resources.resolve = 10;
    before.resources.flame = 420;
    const after = cloneRun(before);
    after.resources.resolve = 13;
    after.resources.flame = 570;
    expect(describeChanges(def, before, after, "resolve")).toEqual([
      "+3 resolve",
      "Warmth 42% → 57%",
    ]);
  });

  it("leaves out hidden numbers and anything that did not move", () => {
    const before = newRun(def);
    before.phase = 3;
    const after = cloneRun(before);
    after.resources.wmLastLump = 50;
    expect(describeChanges(def, before, after)).toEqual([]);
  });

  it("says nothing across a phase change", () => {
    const before = newRun(def);
    const after = cloneRun(before);
    after.phase = 1;
    after.resources.power = 10;
    expect(describeChanges(def, before, after)).toEqual([]);
  });
});

describe("milestoneGoal", () => {
  const upgrades: UpgradeDef[] = [
    {
      id: "scarecrow",
      name: "A friendly scarecrow",
      description: "",
      currency: "harvest",
      baseCost: 10,
      costGrowth: 1,
    },
    {
      id: "tractor",
      name: "A green tractor",
      description: "",
      currency: "harvest",
      baseCost: 100,
      costGrowth: 1,
      visibleWhen: ownsAtLeast("scarecrow", 3),
    },
  ];

  it("names what unlocks a hidden milestone, and how close it is", () => {
    const run = newRun(lightUniverse);
    run.owned = { scarecrow: 2 };
    const goal = milestoneGoal(run, upgrades, "FARM", ["scarecrow", "tractor"]);
    expect(goal.next).toBe(
      "A green tractor: unlocks at 3 × friendly scarecrow (2/3)"
    );
    expect(goal.progress).toBeCloseTo(2 / 3);
  });

  it("shows the price once it is in the shop", () => {
    const run = newRun(lightUniverse);
    run.owned = { scarecrow: 3 };
    run.resources.harvest = 50;
    const goal = milestoneGoal(run, upgrades, "FARM", ["scarecrow", "tractor"]);
    expect(goal.next).toBe("A green tractor: 100 harvest");
    expect(goal.progress).toBeCloseTo(0.5);
  });
});
