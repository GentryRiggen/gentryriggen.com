import { cloneRun } from "../../../engine/engine";
import { simulate, type Strategy } from "../../../engine/sim";
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

/** How a simulated player spends the part besides letting lights go. */
export interface Persona {
  /** Buys from the shop (default true). */
  buys?: boolean;
  /** Taps a second (default: the tapper's own pace). */
  taps?: number;
}

/** Plays the last part out from its start with this habit (none: only the safety net lets a light go). */
export function playLast(
  seed: number,
  lights: OilChoice | undefined,
  persona: Persona = {}
): LastResult {
  const start = lastStart(seed);
  let steps = 0;
  let coldSteps = 0;
  const base = lastPlayer({ lights });
  const strategy: Strategy = {
    ...base,
    ...(persona.buys === false ? { buys: false } : {}),
    ...(persona.taps !== undefined
      ? { tapsPerSecond: persona.taps, tapRate: () => persona.taps ?? 0 }
      : {}),
  };
  const result = simulate(def, {
    strategy,
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

const played = new Map<string, LastResult[]>();

/** Runs one habit over every seed (kept, so a test that asks again does not play it twice). */
export function playAll(
  habit: Habit | null,
  persona: Persona = {}
): LastResult[] {
  const key = JSON.stringify([habit, persona]);
  const kept = played.get(key);
  if (kept) return kept;
  const results = SEEDS.map((seed) =>
    playLast(seed, habit === null ? undefined : letsLightsGo(habit), persona)
  );
  played.set(key, results);
  return results;
}

/** The mean of a habit's speed against a reference habit, over the seeds (above 1: the reference is faster). */
export function meanSlower(
  reference: readonly LastResult[],
  habit: readonly LastResult[]
): number {
  const ratios = reference.map((r, i) => habit[i].seconds / r.seconds);
  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}
