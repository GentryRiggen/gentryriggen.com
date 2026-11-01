import { tapAndAuto, type Strategy } from "./sim";
import type { RunState, UniverseDef } from "./types";

/** The player personalities the scorecard plays a universe with. */
export interface BotSet {
  /**
   * The primary trace: an eager, hands-on player. Taps hard (3 a second) for
   * the first 3 minutes of every phase, then eases to 1 a second by minute 6
   * and keeps poking at that pace. Nobody taps 3 times a second for two
   * hours; the old tapper did, which hid how much the game leaned on it.
   */
  tapper: Strategy;
  /**
   * Taps when it helps: hard (3 a second) for the first 2 minutes of a phase
   * and whenever a tap is still a big part of income (3 taps a second worth
   * at least `HELPS_SHARE` of everything), otherwise a nudge every 5 seconds.
   * Its taps per minute late in a phase are the game's doing, not the bot's,
   * so M11 reads them.
   */
  realistic: Strategy;
  /**
   * Taps to get each phase going (its first 4 minutes, the hands-on opening),
   * then only watches. Presses no other button outside the ending.
   */
  idle: Strategy;
  /**
   * A human who doesn't buy instantly: taps lightly (1 a second) and visits
   * the shop once a minute. Read by M2 and M3 (decision density, goal queue),
   * which an every-10-seconds shopper makes look emptier than it feels.
   */
  dawdler: Strategy;
  /**
   * Per phase index with a watched number: a bot that looks after it only
   * when forced (`naive`) and one that looks after it well (`careful`). The
   * gap between their phase exits is the skill gap M9 reads. A phase without
   * an entry falls back to `naiveOil` / `cheapskateOil` for the first watched
   * phase.
   */
  skill?: Record<number, { naive: Strategy; careful: Strategy }>;
  /**
   * Per phase index with a bonus window (a rush, a flare): a bot that lets
   * the windows pass and one that takes them, tending the same. Reported next
   * to the tend gap in M9, so tending and claiming are not mixed up.
   */
  claim?: Record<number, { ignores: Strategy; claims: Strategy }>;
  /** Buys oil (or its universe's consumable) only when it runs low. */
  naiveOil: Strategy;
  /** Buys oil only when it is cheap (or when the tank is nearly dry). */
  cheapskateOil: Strategy;
}

const MIN = 60;
const SHOP_EVERY = 10;
const BASE_TAPS = 3;
const DAWDLE_SHOP_EVERY = 60;
const DAWDLE_TAPS = 1;

/** The eager player's pace once the helpers are going. */
export const EAGER_LATE_TAPS = 1;
/** A nudge every 5 seconds: what tapping looks like once it hardly helps. */
export const NUDGE_TAPS = 0.2;
/** Minutes of hard tapping at the start of every phase. */
export const HANDS_ON_MINUTES = 3;
/** By this minute of a phase the eager player has eased to its late pace. */
export const EASED_BY_MINUTE = 6;
/** The idle player taps for this many minutes at the start of a phase. */
export const IDLE_WARM_UP_MINUTES = 4;
/** "Taps when it helps" taps hard while 3 taps a second are this share of income. */
export const HELPS_SHARE = 0.4;
/** ... and always for this long at the start of a phase. */
const HELPS_OPENING_MINUTES = 2;
/** Seconds between its looks at whether tapping still helps. */
const HELPS_LOOK_EVERY = 5;

/** Seconds since the current phase began. */
export const phaseClock = (run: RunState): number =>
  run.time - (run.transitions.at(-1)?.at ?? 0);

/** 3 taps a second for `HANDS_ON_MINUTES`, easing to `late` by `EASED_BY_MINUTE`. */
export function phaseShapedTaps(run: RunState, late: number): number {
  const minute = phaseClock(run) / MIN;
  if (minute <= HANDS_ON_MINUTES) return BASE_TAPS;
  if (minute >= EASED_BY_MINUTE) return late;
  const eased =
    (minute - HANDS_ON_MINUTES) / (EASED_BY_MINUTE - HANDS_ON_MINUTES);
  return BASE_TAPS + (late - BASE_TAPS) * eased;
}

/**
 * Taps when it helps (see `BotSet.realistic`). It looks again every few
 * seconds of run time; a run that goes back in time (a new simulation with
 * the same strategy) looks at once.
 */
export function tapsWhenItHelps(def: UniverseDef): (run: RunState) => number {
  let lookedAt = -Infinity;
  let rate = BASE_TAPS;
  return (run) => {
    if (phaseClock(run) < HELPS_OPENING_MINUTES * MIN) return BASE_TAPS;
    const since = run.time - lookedAt;
    if (since >= 0 && since < HELPS_LOOK_EVERY) return rate;
    lookedAt = run.time;
    const { tap, auto } = tapAndAuto(def, run);
    const hard = BASE_TAPS * tap;
    const helps = hard + auto > 0 && hard / (hard + auto) >= HELPS_SHARE;
    rate = helps ? BASE_TAPS : NUDGE_TAPS;
    return rate;
  };
}

/**
 * Bots with no hand-made actions: fine for a universe without a consumable.
 * Pass the universe so the realistic player can tell when a tap helps;
 * without it, it eases to a nudge on the clock instead.
 */
export function genericBots(def?: UniverseDef): BotSet {
  const tapper: Strategy = {
    shopEvery: SHOP_EVERY,
    tapRate: (run) => phaseShapedTaps(run, EAGER_LATE_TAPS),
  };
  return {
    tapper,
    realistic: {
      shopEvery: SHOP_EVERY,
      tapRate: def
        ? tapsWhenItHelps(def)
        : (run) => phaseShapedTaps(run, NUDGE_TAPS),
    },
    idle: {
      shopEvery: SHOP_EVERY,
      tapRate: (run) =>
        phaseClock(run) < IDLE_WARM_UP_MINUTES * MIN ? BASE_TAPS : 0,
    },
    dawdler: { tapsPerSecond: DAWDLE_TAPS, shopEvery: DAWDLE_SHOP_EVERY },
    naiveOil: tapper,
    cheapskateOil: tapper,
  };
}
