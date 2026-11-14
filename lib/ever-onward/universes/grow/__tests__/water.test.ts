import { manualGain } from "../../../engine/engine";
import { tick } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import { growAlert } from "../alerts";
import { incomePerSecond } from "../tick";
import { isDry, rainOutlook, waterFactor, waterLevel } from "../water";
import { def, neverBuys, runAtPhaseStart, withWater } from "./fixtures";

/** A yard run with helpers, so income is more than zero. */
const gardened = () => {
  const run = runAtPhaseStart(0);
  return { ...run, owned: { sprinkler: 4, "bee-hive": 2 } };
};

describe("water", () => {
  it("earns exactly half when dry", () => {
    const wet = withWater(gardened(), 10);
    const dry = withWater(gardened(), 0);
    expect(incomePerSecond(wet)).toBeGreaterThan(0);
    expect(incomePerSecond(dry)).toBeCloseTo(incomePerSecond(wet) * 0.5);
    expect(waterFactor(dry)).toBe(0.5);
    expect(waterFactor(wet)).toBe(1);
  });

  it("still pays a tap when dry", () =>
    expect(manualGain(def, withWater(runAtPhaseStart(0), 0))).toBeGreaterThan(
      0
    ));

  it("warns only while dry, kindly", () => {
    expect(growAlert(withWater(runAtPhaseStart(0), 0))).toMatch(/thirsty/i);
    expect(growAlert(withWater(runAtPhaseStart(0), 5))).toBeNull();
    expect(growAlert(withWater(runAtPhaseStart(0), 0))).not.toMatch(
      /lose|fail|wrong|bad/i
    );
  });

  it("drifts rain on its own stream, leaving run.rng alone", () => {
    let run = runAtPhaseStart(0);
    const rngBefore = run.rng;
    const outlookBefore = rainOutlook(run);
    for (let i = 0; i < 600; i += 1) run = tick(def, run, 1);
    expect(run.rng).toBe(rngBefore);
    expect(rainOutlook(run)).not.toBe(outlookBefore);
    expect(rainOutlook(run)).toBeGreaterThanOrEqual(0);
    expect(rainOutlook(run)).toBeLessThanOrEqual(1);
  });

  it("is deterministic for a seed and keeps the tank in range", () => {
    const play = () => {
      let run = runAtPhaseStart(0);
      for (let i = 0; i < 900; i += 1) {
        run = tick(def, run, 1);
        expect(waterLevel(run)).toBeGreaterThanOrEqual(0);
        expect(waterLevel(run)).toBeLessThanOrEqual(1);
      }
      return run.resources.tank;
    };
    expect(play()).toBe(play());
  });

  it("runs dry sometimes when nothing is built, and recovers", () => {
    let run = runAtPhaseStart(0);
    let dryAt = 0;
    let wetAfter = false;
    for (let i = 0; i < 3 * 3600; i += 1) {
      run = tick(def, run, 1);
      if (isDry(run)) dryAt += 1;
      else if (dryAt > 0) wetAfter = true;
    }
    expect(dryAt).toBeGreaterThan(0);
    expect(wetAfter).toBe(true);
  });

  it("never needs storage to finish (Review Focus 2)", () => {
    const r = simulate(def, {
      strategy: neverBuys(["rain-barrel", "garden-hose"]),
      maxSeconds: 4 * 3600,
    });
    expect(r.finished).toBe(true);
  });

  it("does not blink between dry and wet when the tank hovers near empty", () => {
    let run = withWater(gardened(), 0);
    // the garden runs dry first, so the dry mark is set
    run = tick(
      def,
      { ...run, resources: { ...run.resources, rainOutlook: 0 } },
      0.1
    );
    expect(isDry(run)).toBe(true);
    let toggles = 0;
    let last = isDry(run);
    for (let i = 0; i < 200; i += 1) {
      // rain that just about matches thirst: net water is near zero
      run = {
        ...run,
        resources: {
          ...run.resources,
          rainOutlook: 1 / 3 + (i % 2 === 0 ? 0.05 : -0.05),
        },
      };
      run = tick(def, run, 0.1);
      const now = isDry(run);
      if (now !== last) toggles += 1;
      last = now;
    }
    expect(run.resources.tank).toBeLessThan(1);
    expect(toggles).toBeLessThanOrEqual(1);
    expect(isDry(withWater(run, 5))).toBe(false);
  });
});
