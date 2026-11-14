import { cloneRun, upgradeCost } from "../../../engine/engine";
import { simulate } from "../../../engine/sim";
import type { RunState, UpgradeDef } from "../../../engine/types";
import { def } from "./fixtures";
import { lightBots, nightPlayer, type OilChoice } from "../bots";
import { districtsDark, isRushNow } from "../grid";

/**
 * The night's dials, played on the real economy: every seed is snapshotted
 * when the night begins (the same bot gets there every time), then played to
 * the night's end with the real shop, real buying and the real clock, once
 * for each habit. Nothing here turns buying off.
 */

export const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const starts = new Map<number, RunState>();

/** The run at the very start of the night, the same for every habit. */
export function nightStart(seed: number): RunState {
  const cached = starts.get(seed);
  if (cached) return cached;
  const reached = simulate(def, {
    strategy: lightBots().tapper,
    maxSeconds: 20000,
    step: 1,
    seed,
    stopWhen: (run) => run.phase >= 1,
  }).finalRun;
  starts.set(seed, reached);
  return reached;
}

export interface NightResult {
  /** Seconds from the night's start to its end. */
  seconds: number;
  /** Evenings with every district lit, and with some dark. */
  lit: number;
  dark: number;
  /** Evenings that went dark, as a share of those in each third of the night. */
  darkByThird: number[];
}

export interface Habits {
  lamps?: OilChoice;
  crews?: OilChoice;
  choose?: (run: RunState, affordable: UpgradeDef[]) => UpgradeDef | undefined;
}

/** Plays the night out from its start with these habits. */
export function playNight(seed: number, habits: Habits): NightResult {
  const start = nightStart(seed);
  const strategy = nightPlayer({ lamps: habits.lamps, crews: habits.crews });
  const evenings: boolean[] = [];
  let wasRush = false;
  let worst = 0;
  const result = simulate(def, {
    strategy: {
      ...strategy,
      projects: "best",
      ...(habits.choose ? { choose: habits.choose } : {}),
    },
    maxSeconds: 8000,
    step: 1,
    startRun: cloneRun(start),
    seed,
    stopWhen: (run) => {
      if (run.phase >= 2) return true;
      const isRush = isRushNow(run);
      if (isRush) worst = Math.max(worst, districtsDark(run));
      if (!isRush && wasRush) {
        evenings.push(worst > 0);
        worst = 0;
      }
      wasRush = isRush;
      return false;
    },
  });
  const third = (i: number): number =>
    Math.min(2, Math.floor((3 * i) / Math.max(1, evenings.length)));
  const counts = [0, 1, 2].map(() => [0, 0]);
  evenings.forEach((isDark, i) => {
    counts[third(i)][isDark ? 1 : 0] += 1;
  });
  return {
    seconds: (result.finishTime ?? result.endTime) - start.time,
    lit: evenings.filter((d) => !d).length,
    dark: evenings.filter((d) => d).length,
    darkByThird: counts.map(([lit, dark]) => dark / Math.max(1, lit + dark)),
  };
}

/** The mean of a habit's speed against a reference habit, over the seeds (above 1: faster). */
export function meanSpeed(
  reference: readonly NightResult[],
  habit: readonly NightResult[]
): number {
  const ratios = reference.map((r, i) => r.seconds / habit[i].seconds);
  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}

/** Runs one habit over every seed. */
export const playAll = (habits: Habits): NightResult[] =>
  SEEDS.map((seed) => playNight(seed, habits));

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
