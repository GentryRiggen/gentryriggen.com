import { SAVE_VERSION, parseSave } from "../../../engine/save";
import { newUniverseSave } from "../../../engine/prestige";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { growBots, picksAnytime, picksInAutumn, yardPlayer } from "../bots";
import { SEASONS, seasonBoost, seasonOf, seasonSecondsLeft } from "../seasons";
import { TUNING } from "../tuning";
import { def, inSeason, runAtPhaseStart } from "./fixtures";

const STREAMS = ["plant", "grow", "harvest"] as const;

describe("seasons", () => {
  it("cycles spring, summer, autumn, winter on phase time", () => {
    const s = TUNING.seasons.seconds;
    const at = (t: number) => seasonOf({ ...runAtPhaseStart(0), time: t });
    expect([0, s, 2 * s, 3 * s, 4 * s].map(at)).toEqual([
      "spring",
      "summer",
      "autumn",
      "winter",
      "spring",
    ]);
    expect(seasonSecondsLeft(inSeason("summer"))).toBe(s);
  });

  it("never punishes: every boost is at least 1 and winter is exactly 1", () => {
    for (const season of SEASONS)
      for (const stream of STREAMS)
        expect(seasonBoost(inSeason(season), stream)).toBeGreaterThanOrEqual(1);
    for (const stream of STREAMS)
      expect(seasonBoost(inSeason("winter"), stream)).toBe(1);
  });

  it("rewards planning: a season-aware player clears the yard at least 3% sooner", () => {
    const tapper = growBots().tapper;
    const yardSeconds = (strategy: typeof tapper): number => {
      const r = simulate(def, {
        strategy,
        maxSeconds: 4 * 3600,
        stopWhen: (run) => run.phase >= 1,
      });
      return r.finalRun.time;
    };
    // The same hands and the same water sense; only the harvest differs.
    const storage = (run: RunState): boolean => run.resources.tank <= 0;
    const blind = yardSeconds(yardPlayer(tapper, picksAnytime(), storage));
    const aware = yardSeconds(yardPlayer(tapper, picksInAutumn(), storage));
    expect(aware).toBeLessThanOrEqual(blind * 0.97);
  });

  it("survives a save round trip on the same season", () => {
    const start = runAtPhaseStart(0);
    const run = { ...start, time: 1.4 * TUNING.seasons.seconds };
    const save = newUniverseSave(def);
    save.run = run;
    const raw = JSON.parse(
      JSON.stringify({
        version: SAVE_VERSION,
        universes: { grow: save },
        seenIntro: true,
      })
    );
    const back = parseSave(raw);
    expect(back).not.toBeNull();
    expect(seasonOf(back!.universes.grow.run)).toBe(seasonOf(run));
    expect(seasonOf(run)).toBe("summer");
  });
});
