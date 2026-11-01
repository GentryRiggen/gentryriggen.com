import { manualGain, visitorHereFlag } from "../../../engine/engine";
import {
  prestigeLabel,
  endRun,
  newUniverseSave,
} from "../../../engine/prestige";
import { simulate } from "../../../engine/sim";
import { lightUniverse } from "../../light";
import { parseScoreArgs } from "../../scored";
import { growBots } from "../bots";
import { def, runAtPhaseStart } from "./fixtures";

describe("Make It Grow skeleton", () => {
  it("is registered as id grow with four phases in order", () =>
    expect(def.phases.map((p) => p.id)).toEqual([
      "yard",
      "farm",
      "world",
      "seed",
    ]));

  it.each([0, 1, 2, 3])(
    "a tap earns the phase's resource in phase %i, even from nothing",
    (i) => {
      const start = runAtPhaseStart(i);
      const run = {
        ...start,
        resources: { ...start.resources, [def.phases[i].manualResource]: 0 },
      };
      expect(manualGain(def, run)).toBeGreaterThan(0);
    }
  );

  it("finishes for the eager, realistic and idle bots within 8 hours", () => {
    for (const s of [growBots().tapper, growBots().realistic, growBots().idle])
      expect(
        simulate(def, { strategy: s, maxSeconds: 8 * 3600 }).finished
      ).toBe(true);
  });

  it("completes when the visitor comes back", () => {
    const end = simulate(def, {
      strategy: growBots().tapper,
      maxSeconds: 8 * 3600,
    }).finalRun;
    expect(end.flags[visitorHereFlag("seed-return")]).toBe(true);
  });

  it("has an intro for every phase, the yard's opening with the seed", () => {
    for (const p of def.phases) expect(p.intro).toBeTruthy();
    expect(def.phases[0].intro).toMatch(
      /^This is one small seed, and you are its gardener/
    );
  });

  it("calls its prestige Acorns, one Acorn", () => {
    expect(prestigeLabel(def)).toBe("Acorns");
    expect(def.prestige.labelSingular).toBe("Acorn");
  });

  it("never touches the Light save", () => {
    const light = newUniverseSave(lightUniverse);
    const grow = newUniverseSave(def);
    const save = { light, grow };
    const before = JSON.stringify(save.light);
    const ended = endRun(def, {
      ...grow,
      run: { ...grow.run, phase: 2 },
    });
    expect(ended.embers).toBeGreaterThan(0);
    expect(JSON.stringify(save.light)).toBe(before);
  });

  it("is listed by the scorecard script", () =>
    expect(parseScoreArgs(["grow"]).universeId).toBe("grow"));
});
