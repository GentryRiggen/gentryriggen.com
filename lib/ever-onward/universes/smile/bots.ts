import { genericBots, type BotSet } from "../../engine/bots";
import { shownProjects, upgradeCost } from "../../engine/engine";
import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import { bondActionId, bondStep } from "./bond";
import { currentFork, forkActionId, type ForkSide } from "./forks";
import { PARADE_ACTION_ID, knowhowOf, paradeCost } from "./knowhow";
import { FETCH_ACTION_ID, isBallReady } from "./fetch";
import { heatOf } from "./meter";
import { currentWant, isWanting, tendActionId, tendsSoFar } from "./quiet";
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

/** Share of the next door's price in hand at which smiles stop being set aside. */
const DOOR_NEAR_SHARE = 0.25;

/**
 * Sets a quarter of every smile aside while the next door is far off, and
 * laughs it all once a good part of its price is in hand.
 */
export const bondPolicy =
  (window = 10): Actions =>
  (run, available) => {
    if (run.phase !== 0 || !isWindowStart(run, window)) return [];
    const door = smileUniverse.upgrades.find((u) => u.id === "next-door");
    const isNear =
      !!door &&
      run.revealed.includes(door.id) &&
      (run.resources.smiles ?? 0) >= DOOR_NEAR_SHARE * upgradeCost(run, door);
    const want = isNear ? 0 : 1;
    const id = bondActionId(want);
    return bondStep(run) !== want && available.includes(id) ? [id] : [];
  };

/** Sets this step on the first look and never changes it. */
export const keepsBond =
  (step: number): Actions =>
  (run, available) => {
    const id = bondActionId(step);
    return run.phase === 0 && bondStep(run) !== step && available.includes(id)
      ? [id]
      : [];
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

/** Throws the ball whenever the puppy brings it back. */
export const throwsBall: Actions = (run, available) =>
  isBallReady(run) && available.includes(FETCH_ACTION_ID)
    ? [FETCH_ACTION_ID]
    : [];

/** Both choices at once, so a bot can pick and follow in the same step. */
const alongside =
  (...all: Actions[]): Actions =>
  (run, available) =>
    all.flatMap((a) => a(run, available));

/** A strategy that plays the fork, the bank, the parade and the friend. */
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
      throwsBall,
      bondPolicy(window),
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
    actions: alongside(takesFork(), holdsParade, bondPolicy(10)),
  };
  const carefulCrowd = {
    ...easesOnHeat(hard(base.tapper)),
    actions: alongside(takesFork(), holdsParade, bondPolicy(10)),
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
