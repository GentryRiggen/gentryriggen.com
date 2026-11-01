import { clickCurve } from "../../../engine/clicks";
import { manualGain, performAction, tick } from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { growAlert } from "../alerts";
import { alwaysPlants, cropPolicy, growBots } from "../bots";
import { CROPS, plantActionId } from "../market";
import { incomePerSecond } from "../tick";
import { isDry, waterCapacity, waterLevel } from "../water";
import { def, runAtPhaseStart, withWater } from "./fixtures";

/** The farm run opening, with the market wave at this angle. */
const farmAt = (angle: number): RunState => {
  const start = runAtPhaseStart(1);
  return { ...start, resources: { ...start.resources, mkAngle: angle } };
};

/** Minutes a strategy needs to clear the farm from a given start. */
function farmMinutes(start: RunState, strategy: Strategy): number {
  const r = simulate(def, {
    strategy,
    startRun: start,
    maxSeconds: 4 * 3600,
    stopWhen: (run) => run.phase >= 2,
  });
  return (r.finalRun.time - start.time) / 60;
}

const ANGLES = [0, 1.6, 3.2, 4.8];

/** The eager tapper, with its crop choices swapped for `actions`. */
const tapperWith = (actions: Strategy["actions"]): Strategy => {
  const base = growBots().tapper;
  return { ...base, actions };
};

const mean = (xs: number[]): number =>
  xs.reduce((a, b) => a + b, 0) / xs.length;

describe("the farm", () => {
  it("rewards choosing: the crop-policy bot clears the farm at least 8% sooner than always-corn", () => {
    const corn = ANGLES.map((a) => {
      const start = farmAt(a);
      return farmMinutes(
        { ...start, resources: { ...start.resources, mkCrop: 1 } },
        tapperWith(alwaysPlants("corn"))
      );
    });
    const chooser = ANGLES.map((a) =>
      farmMinutes(farmAt(a), tapperWith(cropPolicy()))
    );
    expect(mean(chooser)).toBeLessThanOrEqual(mean(corn) * 0.92);
    // and choosing is never a loss at any angle
    chooser.forEach((m, i) => expect(m).toBeLessThan(corn[i]));
  });

  it("keeps the market agent below a player choosing well", () => {
    const withAgent = (start: RunState): RunState => ({
      ...start,
      owned: { ...start.owned, "market-agent": 1 },
    });
    const agentOnly = ANGLES.map((a) =>
      farmMinutes(
        withAgent(farmAt(a)),
        tapperWith(() => [])
      )
    );
    const player = ANGLES.map((a) =>
      farmMinutes(withAgent(farmAt(a)), tapperWith(cropPolicy()))
    );
    const never = ANGLES.map((a) =>
      farmMinutes(
        farmAt(a),
        tapperWith(() => [])
      )
    );
    expect(mean(player)).toBeLessThan(mean(agentOnly));
    // the agent helps, it just does not replace the player
    expect(mean(agentOnly)).toBeLessThanOrEqual(mean(never));
  });

  it("still earns half when dry, and a tap always pays harvest", () => {
    const base = {
      ...farmAt(0),
      owned: { scarecrow: 5, tractor: 3 },
    };
    const wet = withWater(base, 10);
    const dry = withWater(base, 0);
    expect(isDry(dry)).toBe(true);
    expect(incomePerSecond(dry)).toBeCloseTo(incomePerSecond(wet) * 0.5);
    const empty = {
      ...dry,
      resources: { ...dry.resources, harvest: 0 },
    };
    expect(manualGain(def, empty)).toBeGreaterThan(0);
    expect(growAlert(dry)).toMatch(/thirsty/i);
    expect(growAlert(dry)).not.toMatch(/lose|fail|wrong|bad/i);
    expect(growAlert(wet)).toBeNull();
  });

  it("a tap pays whichever crop is planted, whatever the towns want", () => {
    for (const crop of CROPS) {
      const run = performAction(def, farmAt(1), plantActionId(crop));
      const pot = { ...run, resources: { ...run.resources, harvest: 0 } };
      expect(manualGain(def, pot)).toBeGreaterThan(0);
    }
  });

  it("digs wells and channels that hold and bring in more water", () => {
    const run = farmAt(0);
    const withWell = { ...run, owned: { ...run.owned, well: 2 } };
    expect(waterCapacity(withWell)).toBeGreaterThan(waterCapacity(run));
    const channels = {
      ...withWell,
      owned: { ...withWell.owned, irrigation: 1 },
    };
    expect(waterCapacity(channels)).toBeGreaterThan(waterCapacity(withWell));
    // a well keeps the tank up with no rain at all
    let dryRun: RunState = {
      ...withWell,
      owned: { ...withWell.owned, well: 6 },
      resources: { ...withWell.resources, rainOutlook: 0, tank: 10 },
    };
    for (let t = 0; t < 120; t += 1)
      dryRun = tick(
        def,
        {
          ...dryRun,
          resources: { ...dryRun.resources, rainOutlook: 0 },
        },
        1
      );
    expect(waterLevel(dryRun)).toBeGreaterThan(0);
  });

  it("opens hands-on and hands over by minute 6 (M11 rows for the farm)", () => {
    const traced = simulate(def, {
      strategy: growBots().tapper,
      maxSeconds: 8 * 3600,
      trace: { sampleEvery: 5 },
    });
    const farm = clickCurve(traced)[1];
    expect(farm.early).toBeGreaterThan(0.3);
    expect(farm.late).toBeLessThan(0.12);
    expect(farm.lowestAtThree).toBeGreaterThanOrEqual(0.0025);
  });

  it("clears the farm in 25 to 50 minutes for the realistic bot", () => {
    const start = runAtPhaseStart(1);
    const minutes = farmMinutes(start, growBots().realistic);
    expect(minutes).toBeGreaterThanOrEqual(25);
    expect(minutes).toBeLessThanOrEqual(50);
  });
});
