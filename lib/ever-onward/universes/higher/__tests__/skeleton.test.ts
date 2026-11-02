import { manualGain, visitorHereFlag } from "../../../engine/engine";
import { isUniverseUnlocked } from "../../../engine/progress";
import {
  endRun,
  newUniverseSave,
  prestigeLabel,
} from "../../../engine/prestige";
import { newSave, parseSave } from "../../../engine/save";
import { simulate } from "../../../engine/sim";
import { growUniverse } from "../../grow";
import { lightUniverse } from "../../light";
import { parseScoreArgs } from "../../scored";
import { higherBots } from "../bots";
import { def, runAtPhaseStart } from "./fixtures";

describe("Build It Higher skeleton", () => {
  it("is registered as id higher with four phases in order", () => {
    expect(def.id).toBe("higher");
    expect(def.phases.map((p) => p.id)).toEqual([
      "playroom",
      "town",
      "sky",
      "top",
    ]);
  });

  it("opens when Make It Grow is finished", () => {
    expect(def.requires).toEqual({
      universeId: "grow",
      hint: "Opens when you finish Make It Grow.",
    });
    const save = newSave();
    expect(isUniverseUnlocked(def, save)).toBe(false);
    save.universes.grow = { ...newUniverseSave(growUniverse), completions: 1 };
    expect(isUniverseUnlocked(def, save)).toBe(true);
  });

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
    const bots = higherBots();
    for (const s of [bots.tapper, bots.realistic, bots.idle])
      expect(
        simulate(def, { strategy: s, maxSeconds: 8 * 3600 }).finished
      ).toBe(true);
  });

  it("completes when the kid on the grass arrives, and not before", () => {
    const end = simulate(def, {
      strategy: higherBots().tapper,
      maxSeconds: 8 * 3600,
    }).finalRun;
    expect(end.flags[visitorHereFlag("kid-on-the-grass")]).toBe(true);
    expect(end.owned["set-down"]).toBe(1);
    for (const i of [0, 1, 2, 3])
      expect(def.isComplete(runAtPhaseStart(i))).toBe(false);
  });

  it("has an intro and a four-frame cutscene for every phase", () => {
    for (const p of def.phases) {
      expect(p.intro).toBeTruthy();
      expect(p.goal).toBeTruthy();
      expect(p.cutscene).toHaveLength(4);
      expect(p.cutscene?.[2].tips).toHaveLength(3);
    }
  });

  it("calls its prestige Gold stars, one Gold star", () => {
    expect(prestigeLabel(def)).toBe("Gold stars");
    expect(def.prestige.labelSingular).toBe("Gold star");
  });

  it("is listed by the scorecard script", () =>
    expect(parseScoreArgs(["higher"]).universeId).toBe("higher"));

  it("never touches the other universes' saves", () => {
    const save = newSave();
    save.universes.light = newUniverseSave(lightUniverse);
    save.universes.grow = newUniverseSave(growUniverse);
    save.universes.higher = newUniverseSave(def);
    const before = JSON.stringify([save.universes.light, save.universes.grow]);
    const mine = save.universes.higher;
    const ended = endRun(def, { ...mine, run: { ...mine.run, phase: 2 } });
    expect(ended.embers).toBeGreaterThan(0);
    save.universes.higher = ended;
    const reloaded = parseSave(JSON.parse(JSON.stringify(save)));
    expect(
      JSON.stringify([reloaded?.universes.light, reloaded?.universes.grow])
    ).toBe(before);
    expect(reloaded?.universes.higher.embers).toBe(ended.embers);
  });

  describe("old saves", () => {
    it("loads a save from before this universe existed", () => {
      // The shape a player's browser holds today: Light and Grow, no Higher.
      const old = newSave();
      old.universes.light = {
        ...newUniverseSave(lightUniverse),
        completions: 1,
      };
      old.universes.grow = { ...newUniverseSave(growUniverse), completions: 1 };
      delete (old.universes as Record<string, unknown>).higher;
      const loaded = parseSave(JSON.parse(JSON.stringify(old)));
      expect(loaded).not.toBeNull();
      expect(loaded?.universes.light.completions).toBe(1);
      expect(loaded?.universes.grow.completions).toBe(1);
      expect(loaded?.universes.higher).toBeUndefined();
      // And Build It Higher is simply open and fresh for them.
      expect(isUniverseUnlocked(def, loaded!)).toBe(true);
      const fresh = newUniverseSave(def);
      expect(fresh.run.phase).toBe(0);
      expect(fresh.completions).toBe(0);
    });

    it("loads a Higher run saved before a newer hidden resource existed", () => {
      const save = newSave();
      const mine = newUniverseSave(def);
      const resources = { ...mine.run.resources };
      for (const id of ["sway", "ftStep", "ftStock", "dlStage", "otLeft"])
        delete resources[id];
      save.universes.higher = { ...mine, run: { ...mine.run, resources } };
      const loaded = parseSave(JSON.parse(JSON.stringify(save)));
      expect(loaded).not.toBeNull();
      expect(loaded?.universes.higher.run.phase).toBe(0);
    });
  });
});
