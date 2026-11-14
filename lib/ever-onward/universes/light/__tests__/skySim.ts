import { cloneRun, upgradeCost } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState, UpgradeDef } from "../../../engine/types";
import { def } from "./fixtures";
import { lightBots, skyPlayer, type OilChoice } from "../bots";

/**
 * The sky's dials, played on the real economy: every seed is snapshotted
 * when the sky begins (the same bot gets there every time), then played to
 * the sky's end with the real shop, real buying and the real clock, once for
 * each habit. Nothing here turns buying off.
 */

export const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const starts = new Map<number, RunState>();

/** The run at the very start of the sky, the same for every habit. */
export function skyStart(seed: number): RunState {
  const cached = starts.get(seed);
  if (cached) return cached;
  const reached = simulate(def, {
    strategy: lightBots().tapper,
    maxSeconds: 20000,
    step: 1,
    seed,
    stopWhen: (run) => run.phase >= 2,
  }).finalRun;
  starts.set(seed, reached);
  return reached;
}

export interface SkyResult {
  /** Seconds from the sky's start to its end. */
  seconds: number;
  /** Flares, and the share of the fleet they burned in all. */
  flares: number;
  /** The most wild probes there were at once, as a share of the fleet. */
  peakWild: number;
  /** The biggest share of the fleet any one flare burned. */
  worstBurn: number;
  /** True when the sky was finished (not cut off by `maxSeconds`). */
  isDone: boolean;
}

export interface Habits {
  /** Seconds after which a habit that has not finished is cut off (default 3000). */
  maxSeconds?: number;
  sky?: OilChoice;
  choose?: (run: RunState, affordable: UpgradeDef[]) => UpgradeDef | undefined;
}

/** Plays the sky out from its start with these habits. */
export function playSky(seed: number, habits: Habits): SkyResult {
  const start = skyStart(seed);
  const strategy = skyPlayer({ sky: habits.sky });
  let peakWild = 0;
  let worstBurn = 0;
  let flaresSeen = 0;
  const result = simulate(def, {
    strategy: {
      ...strategy,
      projects: "best",
      ...(habits.choose ? { choose: habits.choose } : {}),
    },
    // A habit that has not finished by now is far behind; it is scored as this long.
    maxSeconds: habits.maxSeconds ?? 3000,
    step: 1,
    startRun: cloneRun(start),
    seed,
    stopWhen: (run) => {
      if (run.phase >= 3) return true;
      const flares = run.resources.skFlares ?? 0;
      if (flares > flaresSeen) {
        flaresSeen = flares;
        worstBurn = Math.max(worstBurn, run.resources.skHitLost ?? 0);
      }
      const wild = run.resources.skWild ?? 0;
      peakWild = Math.max(
        peakWild,
        wild / Math.max(1, wild + run.resources.probes)
      );
      return false;
    },
  });
  return {
    seconds: (result.finishTime ?? result.endTime) - start.time,
    flares: result.finalRun.resources.skFlares ?? 0,
    peakWild,
    worstBurn,
    isDone: result.finalRun.phase >= 3,
  };
}

/** The mean of a habit's speed against a reference habit, over the seeds (above 1: the habit is faster). */
export function meanSpeed(
  reference: readonly SkyResult[],
  habit: readonly SkyResult[]
): number {
  const ratios = reference.map((r, i) => r.seconds / habit[i].seconds);
  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}

/** Runs one habit over every seed. */
export const playAll = (habits: Habits): SkyResult[] =>
  SEEDS.map((seed) => playSky(seed, habits));

/** The shop's order, highest priority then cheapest (what a player without a plan does). */
export const cheapestFirst = (
  run: RunState,
  affordable: UpgradeDef[]
): UpgradeDef | undefined =>
  [...affordable].sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      upgradeCost(run, a) - upgradeCost(run, b)
  )[0];
