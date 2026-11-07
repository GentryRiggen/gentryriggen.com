import { clickCurve } from "../../../engine/clicks";
import { manualGain, performAction, tick } from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { growAlert } from "../alerts";
import { growBots, mixPolicy, setsMixOnce } from "../bots";
import { BIOMES, moreActionId, worldCover, type Biome } from "../biomes";
import { incomePerSecond } from "../tick";
import { isDry } from "../water";
import { def, runAtPhaseStart, withWater } from "./fixtures";

const worldStart = (): RunState => runAtPhaseStart(2);

/** Minutes a strategy needs to clear the world from a given start. */
function worldMinutes(start: RunState, strategy: Strategy): number {
  const r = simulate(def, {
    strategy,
    startRun: start,
    maxSeconds: 4 * 3600,
    stopWhen: (run) => run.phase >= 3,
  });
  return (r.finalRun.time - start.time) / 60;
}

/** The eager tapper, with its biome choices swapped for `actions`. */
const tapperWith = (actions: Strategy["actions"]): Strategy => ({
  ...growBots().tapper,
  actions,
});

describe("the green world", () => {
  /** All the points on one biome. */
  const piles = (biome: Biome): Strategy["actions"] =>
    setsMixOnce({
      forest: 0,
      jungle: 0,
      meadow: 0,
      wetland: 0,
      [biome]: 10,
    });

  it("rewards mixing: the mixing bot clears the world at least 8% sooner than piling into forest", () => {
    const start = worldStart();
    const forest = worldMinutes(start, tapperWith(piles("forest")));
    const mixer = worldMinutes(start, tapperWith(mixPolicy()));
    expect(mixer).toBeLessThanOrEqual(forest * 0.92);
  });

  it("piling into any one biome is slower than mixing", () => {
    const start = worldStart();
    const mixer = worldMinutes(start, tapperWith(mixPolicy()));
    for (const b of BIOMES) {
      const only = worldMinutes(start, tapperWith(piles(b)));
      expect(mixer).toBeLessThan(only);
    }
  });

  it("still earns half when dry, and a tap always pays green", () => {
    const base = {
      ...worldStart(),
      owned: { windbreak: 5, "planting-rover": 3 },
    };
    const wet = withWater(base, 50);
    const dry = withWater(base, 0);
    expect(isDry(dry)).toBe(true);
    expect(incomePerSecond(dry)).toBeCloseTo(incomePerSecond(wet) * 0.5);
    const empty = { ...dry, resources: { ...dry.resources, green: 0 } };
    expect(manualGain(def, empty)).toBeGreaterThan(0);
    expect(growAlert(dry)).toMatch(/thirsty/i);
    expect(growAlert(dry)).not.toMatch(/lose|fail|wrong|bad/i);
    expect(growAlert(wet)).toBeNull();
  });

  it("moves the land toward the mix and never touches the run's rng", () => {
    const start = worldStart();
    let run = performAction(def, start, moreActionId("meadow"));
    run = performAction(def, run, moreActionId("meadow"));
    run = performAction(def, run, moreActionId("meadow"));
    const rng = run.rng;
    for (let t = 0; t < 240; t += 1) run = tick(def, run, 1);
    expect(run.resources.bmMeadow).toBeGreaterThan(0.01);
    expect(run.resources.bmMeadow).toBeGreaterThan(
      start.resources.bmMeadow ?? 0
    );
    expect(run.rng).toBe(rng);
    expect(worldCover(run)).toBeLessThanOrEqual(1);
  });

  it("opens hands-on and hands over by minute 6 (M11 rows for world)", () => {
    const traced = simulate(def, {
      strategy: growBots().tapper,
      maxSeconds: 8 * 3600,
      trace: { sampleEvery: 5 },
    });
    const world = clickCurve(traced)[2];
    expect(world.early).toBeGreaterThan(0.3);
    expect(world.late).toBeLessThan(0.12);
    expect(world.lowestAtThree).toBeGreaterThanOrEqual(0.0025);
  });

  it("clears the world in 25 to 50 minutes for the realistic bot", () => {
    const minutes = worldMinutes(worldStart(), growBots().realistic);
    expect(minutes).toBeGreaterThanOrEqual(25);
    expect(minutes).toBeLessThanOrEqual(50);
  });
});
