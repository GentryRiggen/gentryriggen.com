import { newRun, reconcileRun, tick, LOG_LIMIT } from "../../../engine/engine";
import { decodeBackup, encodeBackup } from "../../../engine/backupCode";
import { newSave } from "../../../engine/save";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { TOWNS, weatherStage } from "../weather";

const nightRun = (): RunState => {
  const base = newRun(def);
  return {
    ...base,
    phase: 1,
    owned: { gen1: 5, gen2: 3 },
    resources: { ...base.resources, night: 80, power: 1000 },
  };
};

function until(run: RunState, done: (r: RunState) => boolean): RunState {
  let next = run;
  for (let t = 0; t < 900 && !done(next); t += 1) next = tick(def, next, 1);
  return next;
}

describe("the running log", () => {
  it("warns when a storm is coming, then logs where it landed", () => {
    const forecast = until(nightRun(), (r) => weatherStage(r) === "forecast");
    const warning = forecast.log?.at(-1);
    expect(warning?.tone).toBe("info");
    expect(warning?.text).toMatch(/A storm is coming!/);
    expect(TOWNS.some((t) => warning?.text.includes(t))).toBe(true);

    const landed = until(forecast, (r) => weatherStage(r) !== "forecast");
    const result = landed.log?.at(-1);
    expect(result?.text).toMatch(/The storm hit/);
    // No crew was sent, so the lights went out.
    expect(result?.tone).toBe("bad");
    expect(result?.at).toBeCloseTo(landed.time, 5);
    expect(result?.after).toBe(landed.story.length);
  });

  it("logs each storm once, not on every tick", () => {
    const landed = until(
      until(nightRun(), (r) => weatherStage(r) === "forecast"),
      (r) => weatherStage(r) !== "forecast"
    );
    const later = until(tick(def, landed, 1), () => false);
    const storms = (later.log ?? []).filter((e) =>
      e.text.startsWith("The storm hit")
    );
    expect(storms.length).toBeGreaterThanOrEqual(1);
    const fronts = later.resources.wxFronts;
    expect(storms.length).toBe(fronts);
  });

  it("does not replay old results when a save from before the log loads", () => {
    const played = until(nightRun(), (r) => (r.resources.wxFronts ?? 0) >= 1);
    const old: RunState = { ...played };
    delete old.log;
    delete old.logSeen;
    const loaded = reconcileRun(def, old);
    expect(loaded.log).toEqual([]);
    expect(loaded.logSeen?.storm).toBe(1);
  });

  it("drops a damaged log instead of the save", () => {
    const run = {
      ...nightRun(),
      log: [{ text: 5 }, "x"],
    } as unknown as RunState;
    expect(reconcileRun(def, run).log).toEqual([]);
  });

  it("keeps only the newest lines", () => {
    const run = nightRun();
    run.log = Array.from({ length: LOG_LIMIT }, (_, i) => ({
      text: `line ${i}`,
      at: i,
      after: 0,
      tone: "good" as const,
    }));
    const next = until(run, (r) => weatherStage(r) === "forecast");
    expect(next.log).toHaveLength(LOG_LIMIT);
    expect(next.log?.[0].text).toBe("line 1");
  });

  it("logs a new part starting", () => {
    // A coast that is already done, so the next tick moves on.
    const done = {
      ...def,
      phases: [
        { ...def.phases[0], isDone: () => true },
        ...def.phases.slice(1),
      ],
    };
    const next = tick(done, newRun(def), 1);
    expect(next.phase).toBe(1);
    expect(next.log?.at(-1)).toMatchObject({
      text: `Part 2 begins: ${def.phases[1].title}.`,
      tone: "info",
    });
  });

  it("leaves the log out of backup codes", () => {
    const save = newSave();
    const run = nightRun();
    run.log = [{ text: "A storm", at: 1, after: 0, tone: "good" }];
    run.logSeen = { storm: 1 };
    save.universes.light = {
      run,
      best: null,
      completions: 0,
      embers: 0,
      prestigeUpgrades: {},
    };
    const back = decodeBackup(encodeBackup(save));
    expect(back?.universes.light.run.log).toEqual([]);
    expect(back?.universes.light.run.logSeen).toEqual({ storm: 1 });
    const bareRun: RunState = { ...run };
    delete bareRun.log;
    const bare = {
      ...save,
      universes: { light: { ...save.universes.light, run: bareRun } },
    };
    expect(encodeBackup(save)).toBe(encodeBackup(bare));
    // The save itself still has it.
    expect(save.universes.light.run.log).toHaveLength(1);
  });
});
