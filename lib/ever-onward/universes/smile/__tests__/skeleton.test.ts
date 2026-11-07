import { legalTargets, stepMap } from "../../../engine/map";
import { manualGain, newRun, visitorHereFlag } from "../../../engine/engine";
import { isUniverseUnlocked } from "../../../engine/progress";
import { newUniverseSave, prestigeLabel } from "../../../engine/prestige";
import { newSave, parseSave } from "../../../engine/save";
import { simulate } from "../../../engine/sim";
import { reconcileRun } from "../../../engine/engine";
import { growUniverse } from "../../grow";
import { lightUniverse } from "../../light";
import { parseScoreArgs } from "../../scored";
import { playableUniverses } from "../../staging";
import { smileBots } from "../bots";
import { def, runAtPhaseStart } from "./fixtures";

describe("Make Everyone Smile skeleton", () => {
  it("is registered as id smile with four phases in order", () =>
    expect(def.phases.map((p) => p.id)).toEqual([
      "friend",
      "town",
      "world",
      "quiet",
    ]));

  it("is built, so the hub lists it", () =>
    expect(playableUniverses(false).map((u) => u.id)).toContain("smile"));

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
    const bots = smileBots();
    for (const s of [bots.tapper, bots.realistic, bots.idle])
      expect(
        simulate(def, { strategy: s, maxSeconds: 8 * 3600 }).finished
      ).toBe(true);
  });

  it("completes when the real smile arrives", () => {
    const end = simulate(def, {
      strategy: smileBots().tapper,
      maxSeconds: 8 * 3600,
    }).finalRun;
    expect(end.flags[visitorHereFlag("real-smile")]).toBe(true);
    expect(end.complete).toBe(true);
  });

  it("is deterministic: the same bot plays the same run twice", () => {
    const play = () =>
      simulate(def, {
        strategy: smileBots().realistic,
        maxSeconds: 8 * 3600,
        step: 1,
      });
    const a = play();
    const b = play();
    expect(a.finishTime).toBe(b.finishTime);
    expect(a.finalRun.resources).toEqual(b.finalRun.resources);
  });

  it("has an intro for every phase", () => {
    for (const p of def.phases) expect(p.intro).toBeTruthy();
    expect(def.phases[0].intro).toMatch(/^This is a robot with one job/);
  });

  it("calls its prestige Stickers, one Sticker", () => {
    expect(prestigeLabel(def)).toBe("Stickers");
    expect(def.prestige.labelSingular).toBe("Sticker");
  });

  it("never touches the Light or Grow saves", () => {
    const save = newSave();
    save.universes.light = newUniverseSave(lightUniverse);
    save.universes.grow = newUniverseSave(growUniverse);
    save.universes.smile = newUniverseSave(def);
    const before = JSON.stringify([save.universes.light, save.universes.grow]);
    const smile = save.universes.smile;
    // a finished run moves to the next square on the map
    const finished = {
      ...smile,
      run: { ...smile.run, time: 60, complete: true },
    };
    const ended = stepMap(def, finished, legalTargets(def, finished)[0]);
    expect(ended.map?.at).not.toBe(finished.map?.at);
    save.universes.smile = ended;
    const reloaded = parseSave(JSON.parse(JSON.stringify(save)));
    expect(
      JSON.stringify([reloaded?.universes.light, reloaded?.universes.grow])
    ).toBe(before);
    expect(reloaded?.universes.smile.map).toEqual(ended.map);
  });

  it("is listed by the scorecard script", () =>
    expect(parseScoreArgs(["smile"]).universeId).toBe("smile"));

  describe("locked behind Build It Higher", () => {
    it("opens only after Build It Higher is finished", () => {
      expect(def.requires?.universeId).toBe("higher");
      const save = newSave();
      expect(isUniverseUnlocked(def, save)).toBe(false);
    });

    it("stays locked, without crashing, while that universe is not built", () => {
      const save = newSave();
      save.universes.light = {
        ...newUniverseSave(lightUniverse),
        completions: 3,
      };
      save.universes.grow = {
        ...newUniverseSave(growUniverse),
        completions: 3,
      };
      expect(isUniverseUnlocked(def, save)).toBe(false);
      save.universes.higher = {
        ...newUniverseSave(lightUniverse),
        completions: 1,
      };
      expect(isUniverseUnlocked(def, save)).toBe(true);
    });
  });

  describe("old saves", () => {
    it("loads a save from before this universe existed and starts it fresh", () => {
      const old = newSave();
      old.universes.light = newUniverseSave(lightUniverse);
      old.universes.grow = newUniverseSave(growUniverse);
      old.seenIntro = true;
      const loaded = parseSave(JSON.parse(JSON.stringify(old)));
      expect(loaded).not.toBeNull();
      expect(Object.keys(loaded!.universes).sort()).toEqual(["grow", "light"]);
      expect(loaded!.universes.smile).toBeUndefined();
      // The game then starts the universe from a fresh save.
      const fresh = newUniverseSave(def);
      expect(fresh.run.phase).toBe(0);
      expect(fresh.run.resources.smiles).toBeGreaterThanOrEqual(0);
    });

    it("reads a run saved before the later parts existed as not chosen, every smile real and nothing together", () => {
      const run = newRun(def);
      const trimmed = {
        ...run,
        resources: Object.fromEntries(
          Object.entries(run.resources).filter(
            ([id]) => !/^(fk|tg|ws|pd|qt)/.test(id)
          )
        ),
      };
      const loaded = reconcileRun(def, trimmed);
      for (const id of ["fkFriend", "tgBond", "wsDays", "pdLeft", "qtStage"])
        expect(loaded.resources[id]).toBe(0);
      const later = simulate(def, {
        strategy: smileBots().tapper,
        maxSeconds: 600,
        startRun: loaded,
        step: 1,
      });
      expect(later.finalRun.resources.smiles).toBeGreaterThan(0);
    });

    it("repairs a run whose phase is out of range", () => {
      const run = { ...newRun(def), phase: 17 };
      expect(reconcileRun(def, run).phase).toBe(0);
    });
  });
});
