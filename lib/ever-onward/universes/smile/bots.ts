import { genericBots, type BotSet } from "../../engine/bots";
import { shownProjects } from "../../engine/engine";
import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import { currentFork, forkActionId, type ForkSide } from "./forks";
import { PARADE_ACTION_ID, knowhowOf, paradeCost } from "./knowhow";
import { heatOf } from "./meter";
import { currentWant, isWanting, tendActionId, tendsSoFar } from "./quiet";
import {
  ACTIVITY_COUNT,
  activityOf,
  hintOf,
  hintStage,
  isSwitching,
  isTogetherOpen,
  togetherActionId,
  wearOf,
} from "./together";
import { TUNING } from "./tuning";
import { smileUniverse } from ".";

type Actions = NonNullable<Strategy["actions"]>;

/** A choice the bot lets go to the helper after this long (a kettle). */
const SKIP_DELAY = 45;

/** Taps ease to this share while the crowd is warm. */
const EASE_AT = 0.8;
const EASED_SHARE = 0.25;

/** True for the one step at the start of each window (steps are 0.5 or 1 s). */
const isWindowStart = (run: RunState, seconds: number): boolean =>
  run.time % seconds < 0.5;

/**
 * A strategy whose tapping eases off when the cheer meter runs warm, the way
 * anyone who watches the meter would.
 */
export function easesOnHeat(strategy: Strategy): Strategy {
  return {
    ...strategy,
    tapRate: (run) =>
      (strategy.tapRate?.(run) ?? strategy.tapsPerSecond ?? 3) *
      (heatOf(run) > EASE_AT ? EASED_SHARE : 1),
  };
}

/** Buys the given side of the current part's fork the moment it is open. */
const ENGAGED_SIDES: readonly ForkSide[] = [0, 0, 0, 0];
export const takesFork =
  (side?: ForkSide): Actions =>
  (run, available) => {
    const id = forkActionId(
      currentFork(run).id,
      side ?? ENGAGED_SIDES[run.phase] ?? 0
    );
    return available.includes(id) ? [id] : [];
  };

/**
 * Does what the face says once it is leaning or sure, and otherwise stays
 * with what it is doing (unless that is worn thin, then it tries the next
 * thing along). Looks every `window` seconds, the way a player glances up.
 */
export const readsFace =
  (window = 10): Actions =>
  (run, available) => {
    if (!isTogetherOpen(run) || isSwitching(run) || !isWindowStart(run, window))
      return [];
    const act = activityOf(run);
    const wantsHint = hintStage(run) >= 1 && hintOf(run) !== act;
    const isThin = wearOf(run, act) >= TUNING.together.thinAt;
    const target = wantsHint
      ? hintOf(run)
      : isThin
        ? (act + 1) % ACTIVITY_COUNT
        : act;
    const id = togetherActionId(target);
    return target !== act && available.includes(id) ? [id] : [];
  };

/** Does one thing for good (jokes, games or listening) and never changes. */
export const keepsDoing =
  (activity: number): Actions =>
  (run, available) => {
    const id = togetherActionId(activity);
    return isTogetherOpen(run) &&
      activityOf(run) !== activity &&
      !isSwitching(run) &&
      available.includes(id)
      ? [id]
      : [];
  };

/** Goes round jokes, games and listening, changing every `seconds`. */
export const rotatesEvery =
  (seconds: number): Actions =>
  (run, available) => {
    if (!isTogetherOpen(run) || isSwitching(run)) return [];
    const target = Math.floor(run.time / seconds) % ACTIVITY_COUNT;
    const id = togetherActionId(target);
    return target !== activityOf(run) && available.includes(id) ? [id] : [];
  };

/**
 * Starts a parade when the know-how is there, no project is close (it keeps
 * back half of the cheapest project on offer) and the crowd is cool.
 */
export const holdsParade: Actions = (run, available) => {
  if (!available.includes(PARADE_ACTION_ID) || heatOf(run) > 0.35) return [];
  const shown = shownProjects(smileUniverse, run);
  const reserve = shown.length
    ? 0.5 * Math.min(...shown.map((p) => p.costs[0].amount))
    : 0;
  return knowhowOf(run) >= paradeCost() + reserve ? [PARADE_ACTION_ID] : [];
};

/**
 * Answers what the friend wants. One want in every `skipEvery`th goes to the
 * kettle instead (or after SKIP_DELAY).
 */
export const answersFriend =
  (options: { skipEvery?: number } = {}): Actions =>
  (run, available) => {
    if (run.phase !== 3 || !isWanting(run)) return [];
    const { skipEvery } = options;
    if (
      skipEvery &&
      tendsSoFar(run) % skipEvery === skipEvery - 1 &&
      (run.resources.qtTime ?? 0) < SKIP_DELAY
    )
      return [];
    const id = tendActionId(currentWant(run));
    return available.includes(id) ? [id] : [];
  };

/** Both choices at once, so a bot can pick and follow in the same step. */
const alongside =
  (...all: Actions[]): Actions =>
  (run, available) =>
    all.flatMap((a) => a(run, available));

/** A strategy that plays the fork, the face, the parade and the friend. */
export function smilePlayer(
  base: Strategy,
  options: { skipEvery?: number; window?: number; side?: ForkSide } = {}
): Strategy {
  const window = options.window ?? 10;
  return {
    ...easesOnHeat(base),
    actions: alongside(
      takesFork(options.side),
      holdsParade,
      readsFace(window),
      answersFriend({ skipEvery: options.skipEvery })
    ),
  };
}

/** The scorecard's player personalities for Make Everyone Smile. */
export function smileBots(): BotSet {
  const base = genericBots(smileUniverse);
  const tapper = smilePlayer(base.tapper);
  const hard = (strategy: Strategy): Strategy => ({
    ...strategy,
    tapRate: () => 6,
  });
  const naiveCrowd = {
    ...hard(base.tapper),
    actions: alongside(takesFork(), holdsParade, readsFace(10)),
  };
  const carefulCrowd = {
    ...easesOnHeat(hard(base.tapper)),
    actions: alongside(takesFork(), holdsParade, readsFace(10)),
  };
  return {
    tapper,
    realistic: smilePlayer(base.realistic, { skipEvery: 6, window: 20 }),
    idle: {
      ...base.idle,
      projects: "best",
      actions: takesFork(1),
      greetAfter: Infinity,
    },
    dawdler: smilePlayer(base.dawdler, { skipEvery: 2, window: 60 }),
    skill: {
      1: { naive: naiveCrowd, careful: carefulCrowd },
      2: { naive: naiveCrowd, careful: carefulCrowd },
    },
    naiveOil: naiveCrowd,
    cheapskateOil: tapper,
  };
}
