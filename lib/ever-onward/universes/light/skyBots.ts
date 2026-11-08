import type { RunState } from "../../engine/types";
import {
  RECALL_ACTION,
  STAT_COUNT,
  downActionId,
  isDialsOpen,
  isRecalling,
  spareOf,
  targetOf,
  upActionId,
  wildCount,
  wildShare,
} from "./design";
import {
  distanceActionId,
  distanceTarget,
  forecastSize,
  sunMood,
} from "./sunEdge";
import { TUNING } from "./tuning";

/**
 * How the simulated players handle the sky's dials. The reading player
 * looks at what the panels show (the stars left, the sun's mood, the flare
 * forecast, the strays in the fleet) and sets the dials from it. The same
 * player with a signal switched off is a simple habit, which is what the
 * dials' tests set it against.
 */

type Choice = (run: RunState, available: readonly string[]) => string[];

const D = TUNING.dials;

/** Seconds in one stretch of attention for the dials. */
const WINDOW = 20;
/** The reader looks in this often (seconds). */
const LOOK_EVERY = 5;

const targets = (run: RunState): number[] =>
  Array.from({ length: STAT_COUNT }, (_, stat) => targetOf(run, stat));

/** One click toward `goal`: give a spare point to what is short, or take one off what has too many. */
function stepToward(
  run: RunState,
  goal: readonly number[],
  available: readonly string[]
): string[] {
  const now = targets(run);
  if (spareOf(run) > 0) {
    let best = -1;
    for (let stat = 0; stat < STAT_COUNT; stat += 1)
      if (
        goal[stat] - now[stat] > 0 &&
        (best < 0 || goal[stat] - now[stat] > goal[best] - now[best])
      )
        best = stat;
    // A spare point nobody wants goes to the stat that wants it most.
    if (best < 0) best = goal.indexOf(Math.max(...goal));
    const id = upActionId(best);
    return available.includes(id) ? [id] : [];
  }
  let worst = -1;
  for (let stat = 0; stat < STAT_COUNT; stat += 1)
    if (
      now[stat] - goal[stat] > 0 &&
      (worst < 0 || now[stat] - goal[stat] > now[worst] - goal[worst])
    )
      worst = stat;
  if (worst < 0) return [];
  const id = downActionId(worst);
  return available.includes(id) ? [id] : [];
}

export interface Setting {
  split?: readonly number[];
  dist?: number;
  recall?: boolean;
}

/**
 * The clicks that take the dials toward a setting (the steps a player makes
 * by hand): the sun's edge at once, the design a click at a time, the
 * wild ones home. For habits that are plain rules, not reading.
 */
export function clicksToward(
  run: RunState,
  available: readonly string[],
  want: Setting
): string[] {
  if (!isDialsOpen(run)) return [];
  const picks: string[] = [];
  if (want.recall && wildCount(run) >= 1 && !isRecalling(run))
    if (available.includes(RECALL_ACTION)) picks.push(RECALL_ACTION);
  if (want.dist !== undefined && distanceTarget(run) !== want.dist) {
    const id = distanceActionId(want.dist);
    if (available.includes(id)) picks.push(id);
  }
  const goal = want.split;
  if (goal && (spareOf(run) > 0 || targets(run).some((p, i) => p !== goal[i])))
    picks.push(...stepToward(run, goal, available));
  return picks;
}

// ------------------------------------------------------------ the reader

/**
 * The split a reading player runs while the stars left are above each mark:
 * mirrors and copying while the shop is what holds the sky back, then more
 * speed as the stars thin out. Close together on purpose, so the changes
 * are a few clicks, not a rebuild.
 */
export const STAGE_MARKS = [900, 600] as const;
export const STAGE_SPLITS: readonly (readonly number[])[] = [
  [0, 3, 4, 1],
  [2, 1, 4, 1],
  [3, 2, 2, 1],
];
/** The distance (a step of the sun's edge) a reader flies in each of the sun's moods. */
export const MOOD_DISTANCE: readonly number[] = [4, 2, 1];
/** The smallest forecast flare (0 small, 1 medium) a reader pulls back for. */
export const RETREAT_FROM_SIZE = 1;
/** Where a reader pulls the fleet back to when a flare is forecast. */
export const RETREAT_DISTANCE = 1;
/** The share of the fleet gone wild at which a reader brings them home. */
export const RECALL_SHARE = 0.18;

export interface Reading {
  /** Changes the split as the stars thin out (off: keeps `split`, or the start). */
  stage?: boolean;
  /** Flies closer when the sun is quiet and farther when it is restless (off: keeps `dist`). */
  mood?: boolean;
  /** Pulls back when a flare is forecast. */
  forecast?: boolean;
  /** Brings the wild ones home. */
  recalls?: boolean;
  /** What it keeps while a signal is off. */
  split?: readonly number[];
  dist?: number;
  skipEvery?: number;
  onlyEvery?: number;
}

/** The setting a reader wants right now. */
export function readingSetting(run: RunState, how: Reading = {}): Setting {
  const stars = run.resources.stars ?? 1000;
  const stage = stars > STAGE_MARKS[0] ? 0 : stars > STAGE_MARKS[1] ? 1 : 2;
  const split =
    how.stage === false ? (how.split ?? D.startSplit) : STAGE_SPLITS[stage];
  const mood = sunMood(run);
  // A quiet sun needs no shield, a restless one needs a second.
  let dist =
    how.mood === false ? (how.dist ?? D.startDistance) : MOOD_DISTANCE[mood];
  const coming = how.forecast === false ? null : forecastSize(run);
  if (coming !== null && coming >= RETREAT_FROM_SIZE)
    dist = Math.min(dist, RETREAT_DISTANCE);
  return {
    split,
    dist,
    recall: how.recalls !== false && wildShare(run) > RECALL_SHARE,
  };
}

/**
 * Plays the sky's dials by reading three signals: how many stars are left
 * (what to build), the sun's mood (how close to fly) and the flare forecast
 * (when to pull back), and brings the wild ones home when they are a tenth of
 * the fleet. It looks in every few seconds, and misses a stretch now and
 * then if `skipEvery` or `onlyEvery` say so.
 */
export const playsSky =
  (how: Reading = {}): Choice =>
  (run, available) => {
    if (!isDialsOpen(run) || Math.floor(run.time) % LOOK_EVERY !== 0) return [];
    const stretch = Math.floor(run.time / WINDOW);
    if (how.skipEvery && stretch % how.skipEvery === how.skipEvery - 1)
      return [];
    if (how.onlyEvery && stretch % how.onlyEvery !== 0) return [];
    return clicksToward(run, available, readingSetting(run, how));
  };
