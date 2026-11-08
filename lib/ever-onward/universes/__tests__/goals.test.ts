import { newRun } from "../../engine/engine";
import { ALL_UNIVERSES } from "../staging";
import { lightUniverse } from "../light";
import { growUniverse } from "../grow";
import { higherUniverse } from "../higher";
import { smileUniverse } from "../smile";
import { FULL_DESCENT } from "../higher/resources";
import { FULL_TRUST } from "../smile/resources";

for (const def of ALL_UNIVERSES) {
  describe(`${def.title} chapter goals`, () => {
    test.each([0, 1, 2, 3])(
      "phase %i has a finite goal even in an older save",
      (phase) => {
        const run = newRun(def);
        run.phase = phase;
        run.resources = {};
        const goal = def.goalMeter?.(run);
        expect(goal).toBeTruthy();
        expect(Number.isFinite(goal!.current)).toBe(true);
        expect(goal!.current).toBeGreaterThanOrEqual(0);
        expect(goal!.current).toBeLessThanOrEqual(goal!.target);
        expect(goal!.next).toBeTruthy();
        expect(goal!.progress ?? 0).toBeGreaterThanOrEqual(0);
        expect(goal!.progress ?? 0).toBeLessThanOrEqual(1);
        run.complete = true;
        expect(def.goalMeter?.(run)).toBeNull();
      }
    );
  });
}

test("Light goals follow cities, consumed stars and the boat on its way home", () => {
  const run = newRun(lightUniverse);
  run.phase = 1;
  run.resources.night = 50;
  expect(lightUniverse.goalMeter?.(run)?.current).toBe(50);
  run.phase = 2;
  run.resources.stars = 750;
  expect(lightUniverse.goalMeter?.(run)?.current).toBe(250);
  run.phase = 3;
  run.resources.boatProgress = 42.5;
  expect(lightUniverse.goalMeter?.(run)?.current).toBe(42);
  run.resources.boatProgress = 100;
  expect(lightUniverse.goalMeter?.(run)?.next).toMatch(/flash/i);
});

test("milestone goals keep earned progress after spending the wallet", () => {
  const run = newRun(growUniverse);
  run.owned.sprinkler = 2;
  run.resources.seeds = 0;
  const goal = growUniverse.goalMeter?.(run);
  expect(goal!.current).toBeGreaterThan(0);
  expect(goal!.current).toBeLessThan(goal!.target);
});

test("ending goals use real growth, descent and trust", () => {
  const grow = newRun(growUniverse);
  grow.phase = 3;
  grow.resources.growth = 50;
  expect(growUniverse.goalMeter?.(grow)?.current).toBe(50);
  const higher = newRun(higherUniverse);
  higher.phase = 3;
  higher.resources.descent = FULL_DESCENT / 2;
  expect(higherUniverse.goalMeter?.(higher)?.current).toBe(50);
  higher.resources.descent = FULL_DESCENT;
  expect(higherUniverse.goalMeter?.(higher)?.next).toMatch(/set.*block/i);
  const smile = newRun(smileUniverse);
  smile.phase = 3;
  smile.resources.trust = FULL_TRUST / 2;
  expect(smileUniverse.goalMeter?.(smile)?.current).toBe(50);
});

test("continuous goals clamp corrupt and overfilled save values", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -10, 500]) {
    const run = newRun(growUniverse);
    run.phase = 3;
    run.resources.growth = value;
    const goal = growUniverse.goalMeter!(run)!;
    expect(Number.isFinite(goal.current)).toBe(true);
    expect(goal.current).toBeGreaterThanOrEqual(0);
    expect(goal.current).toBeLessThanOrEqual(100);
    expect(goal.progress).toBeGreaterThanOrEqual(0);
    expect(goal.progress).toBeLessThanOrEqual(1);
  }
});
