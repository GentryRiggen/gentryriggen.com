import { cloneRun } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState } from "../../../engine/types";
import { def } from "./fixtures";
import { lastPlayer, lightBots, type OilChoice } from "../bots";
import { letsLightsGo, type Habit } from "../warmthBots";

/**
 * The last light, played on the real economy: every seed is snapshotted when
 * the last part begins (the same bot gets there every time), then played to
 * the ending with the real shop, real buying and the real clock, once for
 * each habit. Nothing here turns buying off.
 */

export const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const starts = new Map<number, RunState>();

/** The run at the very start of the last part, the same for every habit. */
export function lastStart(seed: number): RunState {
  const cached = starts.get(seed);
  if (cached) return cached;
  const reached = simulate(def, {
    strategy: lightBots().tapper,
    maxSeconds: 20000,
    step: 1,
    seed,
    stopWhen: (run) => run.phase >= 3,
  }).finalRun;
  starts.set(seed, reached);
  return reached;
}

export interface LastResult {
  /** Seconds from the start of the last part to the flash. */
  seconds: number;
  /** Lights let go before the end. */
  lets: number;
  /** The share of the time the flame was under 30% warm. */
  cold: number;
}

/** Plays the last part out from its start with this habit (none: every light burns until the end). */
export function playLast(
  seed: number,
  lights: OilChoice | undefined
): LastResult {
  const start = lastStart(seed);
  let steps = 0;
  let coldSteps = 0;
  const result = simulate(def, {
    strategy: lastPlayer({ lights }),
    maxSeconds: 6000,
    step: 1,
    startRun: cloneRun(start),
    seed,
    stopWhen: (run) => {
      steps += 1;
      if ((run.resources.flame ?? 0) < 300) coldSteps += 1;
      return run.complete === true;
    },
  });
  return {
    seconds: (result.finishTime ?? result.endTime) - start.time,
    lets: result.finalRun.resources.wmLets ?? 0,
    cold: coldSteps / Math.max(1, steps),
  };
}

/** Runs one habit over every seed. */
export const playAll = (habit: Habit | null): LastResult[] =>
  SEEDS.map((seed) =>
    playLast(seed, habit === null ? undefined : letsLightsGo(habit))
  );

/** The mean of a habit's speed against a reference habit, over the seeds (above 1: the reference is faster). */
export function meanSlower(
  reference: readonly LastResult[],
  habit: readonly LastResult[]
): number {
  const ratios = reference.map((r, i) => habit[i].seconds / r.seconds);
  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}
