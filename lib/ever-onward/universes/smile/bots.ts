import { genericBots, type BotSet } from "../../engine/bots";
import { shownProjects } from "../../engine/engine";
import { bestProject, type Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import { currentFork, forkActionId, type ForkSide } from "./forks";
import { PARADE_ACTION_ID, knowhowOf, paradeCost } from "./knowhow";
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
import {
  BUY_FLOAT_ACTION_ID,
  PRICE_DEFS,
  STREETS,
  crowdAt,
  routeMult,
  STREET_COUNT,
  canBuyFloat,
  care,
  coinsAt,
  coinsOf,
  dayKind,
  dayLeft,
  dayStreet,
  DAY_RAIN,
  floatCost,
  donorFor,
  floatsOn,
  isMoving,
  isRepainting,
  isTownOpen,
  priceActionId,
  priceOf,
  sendActionId,
  targetWith,
  weightOf,
} from "./town";
import { TUNING } from "./tuning";
import {
  DAY_FESTIVAL,
  DAY_GLOOM,
  DAY_WEARY,
  LEVEL_COUNT,
  dayKind as worldDayKind,
  isRetuning,
  isWorldOpen,
  levelActionId,
  levelOf,
  realOf,
} from "./world";
import { smileUniverse } from ".";

type Actions = NonNullable<Strategy["actions"]>;

/** A choice the bot lets go to the helper after this long (a kettle). */
const SKIP_DELAY = 45;

/** Both choices at once, so a bot can pick and follow in the same step. */
const alongside =
  (...all: Actions[]): Actions =>
  (run, available) =>
    all.flatMap((a) => a(run, available));

/** True for the one step at the start of each window (steps are 0.5 or 1 s). */
const isWindowStart = (run: RunState, seconds: number): boolean =>
  run.time % seconds < 0.5;

/**
 * Holds the loudspeakers at one level for good (a player who never touches
 * the dial).
 */
export const holdsLevel =
  (level: number): Actions =>
  (run, available) => {
    const id = levelActionId(level);
    return isWorldOpen(run) &&
      levelOf(run) !== level &&
      !isRetuning(run) &&
      available.includes(id)
      ? [id]
      : [];
  };

/**
 * Plays the dial by the day: a step louder at a festival, a step quieter in a
 * gloomy week, and no louder than Loud while the crowds are weary of noise.
 * It also backs off to a quiet level when the real smiles fall under `floor`,
 * and stays there until a fifth of the crowd has come back. Looks every
 * `window` seconds.
 */
export const followsTheDay =
  (options: {
    base: number;
    floor: number;
    window?: number;
    /** False for a player who only cares about time, and sits through gloom. */
    easesInGloom?: boolean;
  }): Actions =>
  (run, available) => {
    const window = options.window ?? 10;
    if (!isWorldOpen(run) || isRetuning(run) || !isWindowStart(run, window))
      return [];
    const level = levelOf(run);
    const real = realOf(run);
    const kind = worldDayKind(run);
    let target = options.base;
    if (kind === DAY_FESTIVAL) target += 1;
    if (kind === DAY_GLOOM && options.easesInGloom !== false) target -= 1;
    if (kind === DAY_WEARY) target = Math.min(target, 2);
    if (real < options.floor || (level <= 1 && real < options.floor + 0.2))
      target = 1;
    target = Math.min(LEVEL_COUNT - 1, Math.max(0, target));
    const id = levelActionId(target);
    return target !== level && available.includes(id) ? [id] : [];
  };

/** The projects a bot is willing to start, in the order it prefers them. */
export const PROJECT_TASTES = {
  /** Cheap grins and nothing to lose real smiles over. */
  gentle: ["quiet-hours", "listening-benches", "every-language"],
  /** Mostly gentle, plus the Grin Guide's one-off cost. */
  steady: ["quiet-hours", "every-language", "grin-guide", "listening-benches"],
  /** What a player who only watches the grins picks: the biggest number first. */
  income: ["hypno-drones", "grin-guide", "smile-filters"],
  /** Anything that pays, HypnoDrones first. */
  greedy: [
    "hypno-drones",
    "grin-guide",
    "smile-filters",
    "every-language",
    "quiet-hours",
  ],
} as const;

/** Starts the projects of a taste (the town's and the earlier ones as "best" would). */
export const takesProjects =
  (taste: keyof typeof PROJECT_TASTES): NonNullable<Strategy["projects"]> =>
  (run, shown) => {
    if (run.phase !== 2) {
      const best = bestProject(smileUniverse, run, shown);
      return best ? [best.id] : [];
    }
    const wanted: readonly string[] = PROJECT_TASTES[taste];
    return wanted.filter((id) => shown.some((p) => p.id === id));
  };

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
  if (!available.includes(PARADE_ACTION_ID)) return [];
  const shown = shownProjects(smileUniverse, run);
  const reserve = shown.length
    ? 0.5 * Math.min(...shown.map((p) => p.costs[0].amount))
    : 0;
  return knowhowOf(run) >= paradeCost() + reserve ? [PARADE_ACTION_ID] : [];
};

/** What each town project adds to the town's pay, as a share (a bot's guess). */
const PROJECT_GAIN: Readonly<Record<string, number>> = {
  "big-top": 0.25,
  "shady-corners": 0.05,
  "confetti-cannons": 1,
};

/** How long a gain from coins is worth waiting for (seconds). */
const COIN_HORIZON = 600;

/**
 * What a coin is worth, as a share of the town's pay it buys for good: the
 * best of the next float and the projects on offer (cheapest gain per coin).
 */
function gainPerCoin(run: RunState): number {
  let best = 0;
  if (canBuyFloat(run)) {
    const emptiest = Math.min(
      ...Array.from({ length: STREET_COUNT }, (_, s) => floatsOn(run, s))
    );
    const gain =
      (TUNING.town.routeSpan *
        STREETS.reduce(
          (sum, street, s) =>
            floatsOn(run, s) === emptiest
              ? Math.max(
                  sum,
                  street.weight * (care(emptiest + 1) - care(emptiest))
                )
              : sum,
          0
        )) /
      Math.max(0.5, routeMult(run));
    best = gain / floatCost(run);
  }
  for (const p of shownProjects(smileUniverse, run))
    if (p.costs[0].resource === "coins")
      best = Math.max(best, (PROJECT_GAIN[p.id] ?? 0) / p.costs[0].amount);
  return best;
}

/**
 * The price that does the town the most good right now: cheers from the
 * crowd, times what the coins will buy over the next while. With nothing left
 * to buy, that is free.
 */
function bestLevel(run: RunState): number {
  const g = gainPerCoin(run);
  const valueOf = (level: number): number =>
    (TUNING.town.cheerBase + TUNING.town.cheerSpan * crowdAt(run, level)) *
    (1 + coinsAt(run, level) * g * COIN_HORIZON);
  let best = priceOf(run);
  // A new sign has to be clearly better: repainting it costs a moment.
  let bestValue = valueOf(best) * 1.04;
  for (let level = 0; level < PRICE_DEFS.length; level += 1) {
    if (valueOf(level) > bestValue) {
      best = level;
      bestValue = valueOf(level);
    }
  }
  return best;
}

/**
 * Minds the lemonade stand: while coins can still buy something, the price
 * that earns the most coins today, and otherwise free, for the biggest crowd.
 * Looks every `window` seconds, and leaves a price that is nearly as good.
 */
export const runsStand =
  (window = 10): Actions =>
  (run, available) => {
    if (!isTownOpen(run) || isRepainting(run) || !isWindowStart(run, window))
      return [];
    const now = priceOf(run);
    const target = bestLevel(run);
    if (target === now) return [];
    const id = priceActionId(target);
    return available.includes(id) ? [id] : [];
  };

/** Holds the sign at one price for good. */
export const holdsPrice =
  (level: number): Actions =>
  (run, available) => {
    const id = priceActionId(level);
    return isTownOpen(run) &&
      priceOf(run) !== level &&
      !isRepainting(run) &&
      available.includes(id)
      ? [id]
      : [];
  };

/** Builds a float whenever the coins are there (it goes to the emptiest street). */
export const buildsFloats: Actions = (run, available) =>
  isTownOpen(run) &&
  canBuyFloat(run) &&
  coinsOf(run) >= floatCost(run) &&
  available.includes(BUY_FLOAT_ACTION_ID)
    ? [BUY_FLOAT_ACTION_ID]
    : [];

/** What the floats on a street are worth today, as the route would pay them. */
function streetValue(run: RunState, street: number, floats: number): number {
  const rain =
    dayKind(run) === DAY_RAIN && dayStreet(run) === street
      ? TUNING.town.rainCare
      : 1;
  return weightOf(run, street) * rain * care(floats);
}

/** The least a move must add to the route (the weighted mood) to be worth it. */
const MOVE_WORTH = 1.0;

/** How long a move on a plain day is expected to pay back (seconds). */
const PLAIN_HORIZON = 60;

/**
 * Steers the floats to where they cheer the town most today: more to a party,
 * fewer to the rain. A float comes from the street with the most, so the bot
 * only moves when that is a good trade, and one move at a time.
 */
export const steersFloats =
  (window = 10): Actions =>
  (run, available) => {
    if (!isTownOpen(run) || isMoving(run) || !isWindowStart(run, window))
      return [];
    // A move is paid back over what is left of the day (or a while, on a
    // plain one); the donor street goes without a float while it is on the road.
    const horizon = dayLeft(run) > 0 ? dayLeft(run) : PLAIN_HORIZON;
    let best = -1;
    let bestNet = MOVE_WORTH;
    for (let to = 0; to < STREET_COUNT; to += 1) {
      const from = donorFor(run, to);
      // Never leaves a street with nothing: it would turn grumpy.
      if (
        from < 0 ||
        targetWith(run, from, floatsOn(run, from) - 1) < TUNING.town.grumpyAt
      )
        continue;
      const loss =
        streetValue(run, from, floatsOn(run, from)) -
        streetValue(run, from, floatsOn(run, from) - 1);
      const gain =
        streetValue(run, to, floatsOn(run, to) + 1) -
        streetValue(run, to, floatsOn(run, to)) -
        loss;
      const net = gain * horizon - 2 * loss * TUNING.town.moveSeconds;
      if (net > bestNet) {
        best = to;
        bestNet = net;
      }
    }
    const id = best < 0 ? "" : sendActionId(best);
    return available.includes(id) ? [id] : [];
  };

/** The town played by hand: the stand and the route. */
export const minesTown =
  (window = 10): Actions =>
  (run, available) =>
    alongside(
      buildsFloats,
      runsStand(window),
      steersFloats(window)
    )(run, available);

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

/**
 * A player at the loudspeakers: the fork, the face, the town and the friend as
 * usual, a dial policy and a taste in projects. The scorecard's skill pair and
 * the dominance tests are built from this.
 */
export function worldPlayer(
  base: Strategy,
  dial: Actions,
  taste: keyof typeof PROJECT_TASTES = "steady"
): Strategy {
  return {
    ...base,
    projects: takesProjects(taste),
    actions: alongside(
      takesFork(),
      holdsParade,
      readsFace(10),
      minesTown(),
      dial,
      answersFriend()
    ),
  };
}

/** The dial and projects of a player who follows the day (the usual bots). */
const worldHands = (
  window: number,
  taste: keyof typeof PROJECT_TASTES = "steady"
): Pick<Strategy, "projects"> & { dial: Actions } => ({
  projects: takesProjects(taste),
  dial: followsTheDay({ base: 2, floor: 0.4, window }),
});

/** A strategy that plays the fork, the face, the dial, the parade and the friend. */
export function smilePlayer(
  base: Strategy,
  options: { skipEvery?: number; window?: number; side?: ForkSide } = {}
): Strategy {
  const window = options.window ?? 12;
  const hands = worldHands(Math.max(window, 10));
  return {
    ...base,
    projects: hands.projects,
    actions: alongside(
      takesFork(options.side),
      holdsParade,
      readsFace(window),
      minesTown(Math.max(window, 10)),
      hands.dial,
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
  // Naive: the sign stays at Fair, the floats stay where they were put, every
  // float is built at once, and the loudspeakers stay at Louder whatever the
  // day. Careful: the whole town and the dial played by hand.
  const naiveCrowd: Strategy = {
    ...hard(base.tapper),
    projects: takesProjects("steady"),
    actions: alongside(
      takesFork(),
      holdsParade,
      readsFace(10),
      buildsFloats,
      holdsLevel(3)
    ),
  };
  const carefulCrowd: Strategy = {
    ...hard(base.tapper),
    projects: takesProjects("steady"),
    actions: alongside(
      takesFork(),
      holdsParade,
      readsFace(10),
      minesTown(),
      followsTheDay({ base: 3, floor: 0.25 })
    ),
  };
  return {
    tapper,
    realistic: smilePlayer(base.realistic, { skipEvery: 6, window: 20 }),
    idle: {
      ...base.idle,
      projects: takesProjects("income"),
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
