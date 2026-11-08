import { projectDoneFlag } from "../../engine/engine";
import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { forkCareMult, forkFallMult } from "./forks";
import { PHASE_TOWN } from "./resources";
import { TUNING } from "./tuning";

/**
 * The town's two dials.
 *
 * The lemonade stand. You set a price from free to pricey. The higher it is,
 * the fewer people come, but every cup earns coins. Free brings the whole
 * town, which pays the most cheers and no coins. Coins and cheers buy
 * different things, so neither end is always right. A hot day lifts the crowd
 * (so a higher price still fills the stand) and rain empties it. Changing the
 * price takes a moment: the sign has to be repainted.
 *
 * The parade route. Floats are split across four streets. A street with no
 * float drifts to grumpy (it cheers less and drags the whole town down), and
 * every float on a street after the first is worth less than the one before.
 * Moving a float takes a moment. Days bring a party in one street (floats
 * there are worth more) or rain on one (floats there are worth less).
 *
 * Random numbers (the days) come from a stream of their own. All state is
 * hidden `run.resources` plus one flag, so a save without them reads as "not
 * opened yet".
 */

const T = TUNING.town;

export const TOWN_OPEN_FLAG = "town-open";
const SEED_MIX = 0x7477;

export interface StreetDef {
  id: string;
  name: string;
  weight: number;
}

export const STREETS: readonly StreetDef[] = [
  { id: "elm", name: "Elm Street", weight: T.streetWeights[0] },
  { id: "mill", name: "Mill Road", weight: T.streetWeights[1] },
  { id: "park", name: "Park Lane", weight: T.streetWeights[2] },
  { id: "dock", name: "Dock Row", weight: T.streetWeights[3] },
];
export const STREET_COUNT = STREETS.length;

export interface PriceDef {
  label: string;
  /** What it gives, in plain words (the + line). */
  plus: string;
  /** What it costs, in plain words (the - line). */
  minus: string;
}

export const PRICE_DEFS: readonly PriceDef[] = [
  {
    label: "Free",
    plus: "The whole town comes and cheers",
    minus: "No coins at all",
  },
  {
    label: "Cheap",
    plus: "A big crowd and a few coins",
    minus: "Not many coins",
  },
  {
    label: "Fair",
    plus: "Plenty of coins and a good crowd",
    minus: "Some of the town stays home",
  },
  {
    label: "Dear",
    plus: "Lots of coins from each cup",
    minus: "A small crowd, fewer cheers",
  },
  {
    label: "Pricey",
    plus: "The most coins from each cup",
    minus: "Hardly anyone comes",
  },
];

export type DayKind = 0 | 1 | 2 | 3;
export const DAY_NONE = 0;
export const DAY_HOT = 1;
export const DAY_RAIN = 2;
export const DAY_PARTY = 3;

export const priceActionId = (level: number): string => `st-${level}`;
export const PRICE_ACTION_IDS: readonly string[] = PRICE_DEFS.map((_, i) =>
  priceActionId(i)
);
export const sendActionId = (street: number): string => `rt-${street}`;
export const BUY_FLOAT_ACTION_ID = "rt-buy";
export const SEND_ACTION_IDS: readonly string[] = STREETS.map((_, i) =>
  sendActionId(i)
);
export const ROUTE_ACTION_IDS: readonly string[] = [
  ...SEND_ACTION_IDS,
  BUY_FLOAT_ACTION_ID,
];
export const TOWN_ACTION_IDS: readonly string[] = [
  ...PRICE_ACTION_IDS,
  ...ROUTE_ACTION_IDS,
];

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const TOWN_LINES = ["clown", "band", "smile-factory", "fireworks"];

export const COINS = "coins";
export const coinsOf = (run: RunState): number => res(run, COINS);

/** The first clown opens it. */
export const isTownUnlocked = (run: RunState): boolean =>
  run.phase === 1 && owned(run, "clown") >= 1;

export const isTownOpen = (run: RunState): boolean =>
  run.phase === 1 && run.flags[TOWN_OPEN_FLAG] === true;

// ----------------------------------------------------------------- the stand

/** The price on the sign (Fair until you change it). */
export const priceOf = (run: RunState): number =>
  Math.min(T.prices - 1, Math.max(0, Math.round(res(run, "tnPrice"))));

export const isRepainting = (run: RunState): boolean =>
  isTownOpen(run) && res(run, "tnPaint") > 0;

export const paintingTo = (run: RunState): number =>
  Math.min(T.prices - 1, Math.max(0, Math.round(res(run, "tnNext"))));

export const paintLeft = (run: RunState): number => res(run, "tnPaint");

// ----------------------------------------------------------------- the days

export const dayKind = (run: RunState): DayKind =>
  (isTownOpen(run) && res(run, "tnDayLeft") > 0
    ? Math.round(res(run, "tnDay"))
    : DAY_NONE) as DayKind;
export const dayStreet = (run: RunState): number =>
  Math.min(STREET_COUNT - 1, Math.max(0, Math.round(res(run, "tnDaySt"))));
export const dayLeft = (run: RunState): number => res(run, "tnDayLeft");
export const daysSoFar = (run: RunState): number => res(run, "tnDays");

/** How much the weather moves the whole crowd (0 on a plain day). */
export const thirstOf = (run: RunState): number => {
  const kind = dayKind(run);
  return kind === DAY_HOT ? T.hotThirst : kind === DAY_RAIN ? T.rainThirst : 0;
};

// -------------------------------------------------------------- the crowd

/** The share of the town that comes at a price, with the weather. */
export const crowdAt = (run: RunState, level: number): number =>
  Math.min(1, Math.max(T.minCrowd, 1 - T.crowdSlope * level + thirstOf(run)));

/** The crowd at the stand right now (fewer while the sign is repainted). */
export const crowdOf = (run: RunState): number =>
  crowdAt(run, priceOf(run)) * (isRepainting(run) ? T.repaintCrowd : 1);

/** Helper levels in the town: they all earn the coins. */
export const townLevels = (run: RunState): number =>
  TOWN_LINES.reduce((sum, id) => sum + owned(run, id), 0);

/** Coins a second if the sign said `level`. */
export const coinsAt = (run: RunState, level: number): number =>
  townLevels(run) * T.coinPerLevel * crowdAt(run, level) * T.priceWeight[level];

export const coinsPerSecond = (run: RunState): number =>
  isTownOpen(run)
    ? townLevels(run) *
      T.coinPerLevel *
      crowdOf(run) *
      T.priceWeight[priceOf(run)]
    : 0;

/** What the crowd does to cheers: the whole town pays the most. */
export const cheerMult = (run: RunState): number =>
  isTownOpen(run) ? T.cheerBase + T.cheerSpan * crowdOf(run) : 1;

// -------------------------------------------------------------- the route

export const floatsOn = (run: RunState, street: number): number =>
  Math.max(0, Math.round(res(run, `tnF${street}`)));

export const isMoving = (run: RunState): boolean =>
  isTownOpen(run) && res(run, "tnMove") > 0;
export const movingTo = (run: RunState): number =>
  Math.min(STREET_COUNT - 1, Math.max(0, Math.round(res(run, "tnTo"))));
export const moveLeft = (run: RunState): number => res(run, "tnMoveLeft");

/** Floats the town owns (on a street or on the way). */
export const floatsOwned = (run: RunState): number => res(run, "tnFloats");

export const floatCap = (): number => T.startFloats + T.floatCosts.length;
export const canBuyFloat = (run: RunState): boolean =>
  isTownOpen(run) && floatsOwned(run) < floatCap();
export const floatCost = (run: RunState): number =>
  T.floatCosts[
    Math.max(
      0,
      Math.min(T.floatCosts.length - 1, floatsOwned(run) - T.startFloats)
    )
  ];

/** How much of a street's cheer a number of floats reaches (0 to 1). */
export const care = (floats: number): number => 1 - T.careDecay ** floats;

/** A street's weight today (a party makes it count for more). */
export function weightOf(run: RunState, street: number): number {
  const party = dayKind(run) === DAY_PARTY && dayStreet(run) === street;
  return STREETS[street].weight * (party ? T.partyWeight : 1);
}

/** What `floats` on a street would be working towards (0 to 1). */
export function targetWith(
  run: RunState,
  street: number,
  floats: number
): number {
  const rain = dayKind(run) === DAY_RAIN && dayStreet(run) === street;
  const bigTop = run.flags[projectDoneFlag("big-top")] === true;
  return clamp01(
    care(floats) *
      forkCareMult(run) *
      (bigTop ? T.bigTopCare : 1) *
      (rain ? T.rainCare : 1)
  );
}

/** What the floats on a street are working towards (0 to 1). */
export const targetOf = (run: RunState, street: number): number =>
  targetWith(run, street, floatsOn(run, street));

export const moodOfStreet = (run: RunState, street: number): number =>
  clamp01(res(run, `tnH${street}`));

export const isGrumpy = (run: RunState, street: number): boolean =>
  isTownOpen(run) && moodOfStreet(run, street) < T.grumpyAt;

export const grumpyCount = (run: RunState): number =>
  STREETS.filter((_, i) => isGrumpy(run, i)).length;

/** The unhappiest street's mood, 0 to 1. */
export const lowestMood = (run: RunState): number =>
  Math.min(...STREETS.map((_, i) => moodOfStreet(run, i)));

/** The town's mood, 0 to 1 (the streets at their usual weights). */
export const townMood = (run: RunState): number =>
  STREETS.reduce((sum, s, i) => sum + s.weight * moodOfStreet(run, i), 0);

/** How much the route pays (1 until it opens). */
export function routeMult(run: RunState): number {
  if (!isTownOpen(run)) return 1;
  const sum = STREETS.reduce(
    (total, _, i) =>
      total +
      weightOf(run, i) *
        moodOfStreet(run, i) *
        (isGrumpy(run, i) ? T.grumpyShare : 1),
    0
  );
  return (T.routeBase + T.routeSpan * sum) * T.grumpyDrag ** grumpyCount(run);
}

/** What the stand and the route do to the town's pay together. */
export const townMult = (run: RunState): number =>
  cheerMult(run) * routeMult(run);

/** The benches make a cheered-up street rise faster. */
const riseMult = (run: RunState): number =>
  T.benchRise ** Math.min(T.benchMax, owned(run, "bench"));

/** Shady corners and the clowns change how fast a skipped street sours. */
const fallMult = (run: RunState): number =>
  forkFallMult(run) *
  (run.flags[projectDoneFlag("shady-corners")] === true ? T.shadeFall : 1);

export const streetRise = (run: RunState): number => T.rise * riseMult(run);
export const streetFall = (run: RunState): number => T.fall * fallMult(run);

// ----------------------------------------------------------- the big moments

export const lastArrival = (run: RunState): number =>
  res(run, "tnArriveAt") > 0 &&
  run.time - res(run, "tnArriveAt") < T.showSeconds
    ? Math.round(res(run, "tnArriveSt"))
    : -1;

export const lastGrump = (run: RunState): number =>
  res(run, "tnGrumpAt") > 0 && run.time - res(run, "tnGrumpAt") < T.showSeconds
    ? Math.round(res(run, "tnGrumpSt"))
    : -1;

// ------------------------------------------------------------- the tick

function newDay(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "tnRng") | 0 };
  const roll = () => nextRandom(stream);
  const pick = roll();
  const kind =
    pick < T.dayKinds[0]
      ? DAY_HOT
      : pick < T.dayKinds[1]
        ? DAY_RAIN
        : DAY_PARTY;
  const last = Math.round(res(run, "tnDaySt"));
  // The first day can fall on any street; after that, on a different one.
  const street =
    daysSoFar(run) === 0
      ? Math.floor(roll() * STREET_COUNT)
      : (last + 1 + Math.floor(roll() * (STREET_COUNT - 1))) % STREET_COUNT;
  r.tnDay = kind;
  r.tnDaySt = street;
  r.tnDayLeft = T.daySeconds[0] + roll() * (T.daySeconds[1] - T.daySeconds[0]);
  r.tnDays = daysSoFar(run) + 1;
  r.tnRng = stream.rng;
}

function scheduleCalm(run: RunState): void {
  const stream = { rng: res(run, "tnRng") | 0 };
  run.resources.tnCalm =
    T.calmSeconds[0] +
    nextRandom(stream) * (T.calmSeconds[1] - T.calmSeconds[0]);
  run.resources.tnRng = stream.rng;
}

/** The street with the fewest floats (the heaviest street on a tie). */
function emptiestStreet(run: RunState): number {
  let best = 0;
  for (let i = 1; i < STREET_COUNT; i += 1)
    if (floatsOn(run, i) < floatsOn(run, best)) best = i;
  return best;
}

export function openTown(run: RunState): void {
  if (run.flags[TOWN_OPEN_FLAG] === true) return;
  const r = run.resources;
  run.flags[TOWN_OPEN_FLAG] = true;
  r.tnRng = (run.rng ^ SEED_MIX) | 0;
  r.tnPrice = 2;
  r.tnFloats = T.startFloats;
  for (let i = 0; i < STREET_COUNT; i += 1) {
    r[`tnF${i}`] = 0;
    r[`tnH${i}`] = 1;
  }
  for (let n = 0; n < T.startFloats; n += 1) r[`tnF${n % STREET_COUNT}`] += 1;
  r.tnCalm = T.firstDay;
}

export function tickTown(run: RunState, dt: number): void {
  if (run.phase !== 1) return;
  if (run.flags[TOWN_OPEN_FLAG] !== true) {
    if (isTownUnlocked(run)) openTown(run);
    return;
  }
  const r = run.resources;

  r[COINS] = coinsOf(run) + coinsPerSecond(run) * dt;

  if (res(run, "tnPaint") > 0) {
    r.tnPaint = Math.max(0, res(run, "tnPaint") - dt);
    if (r.tnPaint === 0) r.tnPrice = paintingTo(run);
  }

  if (res(run, "tnDayLeft") > 0) {
    r.tnDayLeft = Math.max(0, res(run, "tnDayLeft") - dt);
    if (r.tnDayLeft === 0) scheduleCalm(run);
  } else {
    r.tnCalm = res(run, "tnCalm") - dt;
    if (r.tnCalm <= 0) newDay(run);
  }

  if (res(run, "tnMove") > 0) {
    r.tnMoveLeft = Math.max(0, res(run, "tnMoveLeft") - dt);
    if (r.tnMoveLeft === 0) {
      const to = movingTo(run);
      r[`tnF${to}`] = floatsOn(run, to) + 1;
      r.tnMove = 0;
      r.tnArriveAt = run.time;
      r.tnArriveSt = to;
    }
  }

  for (let i = 0; i < STREET_COUNT; i += 1) {
    const before = moodOfStreet(run, i);
    const target = targetOf(run, i);
    const next =
      before < target
        ? Math.min(target, before + streetRise(run) * dt)
        : Math.max(target, before - streetFall(run) * dt);
    r[`tnH${i}`] = clamp01(next);
    if (before >= T.grumpyAt && next < T.grumpyAt) {
      r.tnGrumpAt = run.time;
      r.tnGrumpSt = i;
    }
  }
}

export function setPrice(run: RunState, level: number): void {
  if (!isTownOpen(run) || isRepainting(run) || level === priceOf(run)) return;
  run.resources.tnNext = level;
  run.resources.tnPaint = T.repaintSeconds;
  run.resources.tnChanges = res(run, "tnChanges") + 1;
}

/**
 * The street a float would come from to go to `street` (-1 if none): the one
 * that will miss it least today (a street with several floats and little
 * weight, not a street with one float that would turn grumpy).
 */
export function donorFor(run: RunState, street: number): number {
  let best = -1;
  let bestLoss = Infinity;
  for (let i = 0; i < STREET_COUNT; i += 1) {
    if (i === street || floatsOn(run, i) < 1) continue;
    const floats = floatsOn(run, i);
    // A street that would turn grumpy without it is the last one to ask.
    const loss =
      weightOf(run, i) * (care(floats) - care(floats - 1)) +
      (targetWith(run, i, floats - 1) < T.grumpyAt ? 1 : 0);
    if (loss < bestLoss) {
      best = i;
      bestLoss = loss;
    }
  }
  return best;
}

export function sendFloat(run: RunState, street: number): void {
  if (!isTownOpen(run) || isMoving(run)) return;
  const from = donorFor(run, street);
  if (from < 0) return;
  run.resources[`tnF${from}`] = floatsOn(run, from) - 1;
  run.resources.tnMove = 1;
  run.resources.tnTo = street;
  run.resources.tnMoveLeft = T.moveSeconds;
  run.resources.tnMoves = res(run, "tnMoves") + 1;
}

function addFloat(run: RunState): void {
  const street = emptiestStreet(run);
  run.resources[`tnF${street}`] = floatsOn(run, street) + 1;
  run.resources.tnFloats = floatsOwned(run) + 1;
  run.resources.tnArriveAt = run.time;
  run.resources.tnArriveSt = street;
}

/** For the simulator's income probes: a steady town, not today's weather. */
export function withoutDay(run: RunState): RunState {
  return {
    ...run,
    resources: { ...run.resources, tnDayLeft: 0 },
  };
}

// ------------------------------------------------------------- the words

const pct = (n: number): string => `${Math.round(n * 100)}%`;
const times = (n: number): string => `${Number(n.toFixed(2))}x`;

export function dayLine(run: RunState): string {
  const left = Math.ceil(dayLeft(run));
  const name = STREETS[dayStreet(run)].name;
  switch (dayKind(run)) {
    case DAY_HOT:
      return `A hot day! Everyone wants lemonade, so more people come at every price. ${left}s left.`;
    case DAY_RAIN:
      return `Rain on ${name}. Floats there are worth less, and fewer people want lemonade. ${left}s left.`;
    case DAY_PARTY:
      return `A street party on ${name}! Cheering it counts for more. ${left}s left.`;
    default:
      return "A plain day. Nothing special is happening.";
  }
}

/** The latest day, for the log. */
export function dayLogLine(run: RunState): string {
  const name = STREETS[dayStreet(run)].name;
  switch (Math.round(res(run, "tnDay"))) {
    case DAY_HOT:
      return "A hot day! The whole town is thirsty for lemonade.";
    case DAY_RAIN:
      return `Rain on ${name}! Everybody is under an umbrella.`;
    default:
      return `A street party on ${name}! The music is very loud.`;
  }
}

export const crowdLine = (run: RunState): string =>
  `${pct(crowdOf(run))} of the town at the stand: ${times(cheerMult(run))} cheers, ${coinsPerSecond(run).toFixed(2)} coins a second.`;

export function streetLine(run: RunState, street: number): string {
  const mood = moodOfStreet(run, street);
  if (mood < T.grumpyAt) return "Grumpy: cheers less, and drags the town down";
  if (mood < 0.5) return "Fed up";
  if (mood < 0.8) return "Happy";
  return "Delighted";
}

/** What one more float on a street would add to what it is working towards. */
export const nextFloatGain = (run: RunState, street: number): number =>
  care(floatsOn(run, street) + 1) - care(floatsOn(run, street));

export const TOWN_ACTIONS: readonly ActionDef[] = [
  ...PRICE_DEFS.map((price, level): ActionDef => ({
    id: priceActionId(level),
    phases: [PHASE_TOWN],
    isInline: true,
    visibleWhen: isTownOpen,
    describe: (run) => ({
      label: `Sell lemonade: ${price.label}`,
      detail: `${price.plus}. ${price.minus}. Repainting the sign takes ${T.repaintSeconds} seconds.`,
      isBlocked: priceOf(run) === level || isRepainting(run),
    }),
    perform: (run) => setPrice(run, level),
  })),
  ...STREETS.map((street, i): ActionDef => ({
    id: sendActionId(i),
    phases: [PHASE_TOWN],
    isInline: true,
    visibleWhen: isTownOpen,
    describe: (run) => ({
      label: `Send a float to ${street.name}`,
      detail: `Takes a float from the street that will miss it least. It is on the road for ${T.moveSeconds} seconds and cheers nobody.`,
      isBlocked: isMoving(run) || donorFor(run, i) < 0,
    }),
    perform: (run) => sendFloat(run, i),
  })),
  {
    id: BUY_FLOAT_ACTION_ID,
    phases: [PHASE_TOWN],
    isInline: true,
    visibleWhen: isTownOpen,
    describe: (run) => ({
      label: "Build another float",
      detail: "A new float joins the street with the fewest.",
      cost: { resource: COINS, amount: floatCost(run) },
      isBlocked: !canBuyFloat(run),
    }),
    perform: (run) => addFloat(run),
  },
];
