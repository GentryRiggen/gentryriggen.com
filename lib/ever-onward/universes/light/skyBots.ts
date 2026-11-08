import type { RunState } from "../../engine/types";
import {
  COPYING,
  MIRRORS,
  RECALL_ACTION,
  SHIELDS,
  SPEED,
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
import { tier } from "./tick";
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
export const MOOD_DISTANCE: readonly number[] = [4, 2, 2];
/**
 * The shield points a reader holds in each mood: one under a quiet or usual
 * sun, three under a restless one, whose flares reach even the far edge. The
 * shield foundry makes a point stronger, so a restless sun then needs one
 * less.
 */
export const MOOD_SHIELDS: readonly number[] = [1, 1, 3];
/** The smallest forecast flare (0 small, 1 medium) a reader pulls back for. */
export const RETREAT_FROM_SIZE = 1;
/** Where a reader pulls the fleet back to when a flare is forecast: out of its reach. */
export const RETREAT_DISTANCE = 0;
/** The share of the fleet gone wild at which a reader brings them home. */
export const RECALL_SHARE = 0.12;

export interface Reading {
  /** Changes the split as the stars thin out (off: keeps `split`, or the start). */
  stage?: boolean;
  /** Flies closer when the sun is quiet and farther when it is restless (off: keeps `dist`). */
  mood?: boolean;
  /** Pulls back when a flare is forecast. */
  forecast?: boolean;
  /** Brings the wild ones home. */
  recalls?: boolean;
  /** Moves shield points with the sun's mood (off: keeps the stage's one; a number: holds that many). */
  shields?: boolean | number;
  /** The share gone wild that makes it bring them home (default `RECALL_SHARE`). */
  recallShare?: number;
  /** The distance it flies in each mood (default `MOOD_DISTANCE`). */
  moodDist?: readonly number[];
  /** What it keeps while a signal is off. */
  split?: readonly number[];
  dist?: number;
  skipEvery?: number;
  onlyEvery?: number;
}

/** The shield points a reader wants in the sun's mood now. */
export function shieldsWanted(run: RunState): number {
  const mood = sunMood(run);
  const foundry = tier(run, "nav") >= 2 && mood === 2 ? 1 : 0;
  return MOOD_SHIELDS[mood] - foundry;
}

/** Where a shield point comes from (the first with a point to spare); the first is also where one goes back to. */
const SHIELD_FROM: readonly number[] = [MIRRORS, SPEED, COPYING];

/** The split with `shields` points on shields, the others taken from (or given to) other stats. */
function withShields(split: readonly number[], shields: number): number[] {
  const out = [...split];
  let diff = shields - out[SHIELDS];
  out[SHIELDS] = shields;
  while (diff > 0) {
    const from = SHIELD_FROM.find((stat) => out[stat] > 0);
    if (from === undefined) break;
    out[from] -= 1;
    diff -= 1;
  }
  if (diff < 0) out[SHIELD_FROM[0]] -= diff;
  return out;
}

/** The setting a reader wants right now. */
export function readingSetting(run: RunState, how: Reading = {}): Setting {
  const stars = run.resources.stars ?? 1000;
  const stage = stars > STAGE_MARKS[0] ? 0 : stars > STAGE_MARKS[1] ? 1 : 2;
  const staged =
    how.stage === false ? (how.split ?? D.startSplit) : STAGE_SPLITS[stage];
  const held = typeof how.shields === "number" ? how.shields : null;
  // A player who ignores the sun's mood does not read it for shields either.
  const split =
    how.shields === false || (how.mood === false && held === null)
      ? staged
      : withShields(staged, held ?? shieldsWanted(run));
  const mood = sunMood(run);
  // Brushing the sun while it is quiet, Near it otherwise (a restless sun is
  // met with shields, which settle in seconds, not with a long flight out).
  let dist =
    how.mood === false
      ? (how.dist ?? D.startDistance)
      : (how.moodDist ?? MOOD_DISTANCE)[mood];
  const coming = how.forecast === false ? null : forecastSize(run);
  if (coming !== null && coming >= RETREAT_FROM_SIZE)
    dist = Math.min(dist, RETREAT_DISTANCE);
  return {
    split,
    dist,
    recall:
      how.recalls !== false &&
      wildShare(run) > (how.recallShare ?? RECALL_SHARE),
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
