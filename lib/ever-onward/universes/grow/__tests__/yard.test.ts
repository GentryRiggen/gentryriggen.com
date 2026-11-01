import { clickCurve } from "../../../engine/clicks";
import { manualGain, performAction, tick } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { YARD_HARVEST } from "../actions";
import { growBots } from "../bots";
import { def, inSeason, runAtPhaseStart, withWater } from "./fixtures";

const traced = (strategy: ReturnType<typeof growBots>["tapper"]) =>
  simulate(def, {
    strategy,
    maxSeconds: 8 * 3600,
    trace: { sampleEvery: 5 },
  });

describe("the backyard", () => {
  it("opens hands-on: taps are over 60% of income at minutes 0.5-3", () => {
    expect(clickCurve(traced(growBots().tapper))[0].early).toBeGreaterThan(0.6);
  });

  it("hands over to helpers: eager tap share is under 12% from minute 6", () => {
    expect(clickCurve(traced(growBots().tapper))[0].late).toBeLessThan(0.12);
  });

  it("clears the yard in 20 to 45 minutes for the realistic bot", () => {
    const r = simulate(def, {
      strategy: growBots().realistic,
      maxSeconds: 8 * 3600,
      stopWhen: (run) => run.phase >= 1,
    });
    const minutes = r.finalRun.time / 60;
    expect(minutes).toBeGreaterThanOrEqual(20);
    expect(minutes).toBeLessThanOrEqual(45);
  });

  it("hand picking in autumn pays more than the base rate, and ripe produce waits", () => {
    const ripe = (season: Parameters<typeof inSeason>[0]) => {
      const run = inSeason(season);
      return {
        ...run,
        owned: { sprinkler: 1 },
        resources: { ...run.resources, produce: 100, seeds: 0 },
      };
    };
    const autumn = performAction(def, ripe("autumn"), YARD_HARVEST);
    const winter = performAction(def, ripe("winter"), YARD_HARVEST);
    expect(winter.resources.seeds).toBe(100);
    expect(autumn.resources.seeds).toBeGreaterThan(winter.resources.seeds);
    expect(autumn.resources.produce).toBe(0);
    // Left alone for a long time, nothing is lost.
    let waiting: RunState = ripe("winter");
    waiting = { ...waiting, owned: {} };
    for (let i = 0; i < 600; i += 1) waiting = tick(def, waiting, 1);
    expect(waiting.resources.produce).toBeGreaterThanOrEqual(100);
  });

  it("is never stuck: a tap earns with no seeds and no water", () => {
    const run = withWater(runAtPhaseStart(0), 0);
    const empty = { ...run, resources: { ...run.resources, seeds: 0 } };
    expect(manualGain(def, empty)).toBeGreaterThan(0);
  });
});
