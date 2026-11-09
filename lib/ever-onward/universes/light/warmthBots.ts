import type { RunState } from "../../engine/types";
import {
  LIGHT_COUNT,
  boatArrived,
  burnOf,
  burnOfPips,
  burnPips,
  canLetGo,
  chillBite,
  chillForecast,
  chillKind,
  companyOf,
  companyOfPips,
  companyPips,
  isCarried,
  isChillBlowing,
  lumpNow,
  isLit,
  letGoActionId,
  lockLeft,
  windBites,
} from "./warmth";

/**
 * How the simulated players let the lights go. The reading player lets go the
 * light that keeps the least company for the warmth it costs, and when a cold
 * wind is blowing it lets go the lights that wind bites first, because the
 * wind carries their goodbye farther (it pays more). It sees what the cards
 * show (flames, hearts, the wind's kind and size), or, for a test, the exact
 * numbers under them. The same player with the wind switched off, or a plain
 * rule (a fixed order, a fixed time), is a simple habit, which is what the
 * lights' tests set it against.
 */

type Choice = (run: RunState, available: readonly string[]) => string[];

const INDEXES: readonly number[] = Array.from(
  { length: LIGHT_COUNT },
  (_, i) => i
);

/** The reader looks in this often (seconds). */
const LOOK_EVERY = 5;
/** The reader waits this long after a goodbye for a wind to carry the next one, then lets a light go anyway. */
const READER_WAIT = 100;
const res = (run: RunState, id: string): number => run.resources[id] ?? 0;

/** The lights still lit that could go this second. */
const choices = (run: RunState): number[] =>
  INDEXES.filter((i) => canLetGo(run, i));

export interface Habit {
  /** Which light a plain rule lets go first. */
  order?: "index" | "burn" | "company" | "ratio";
  /** A plain rule lets lights go only after this many seconds of the part. */
  after?: number;
  /** The reader lets a light go ahead of a forecast wind that will bite it (off: it ignores the wind). */
  wind?: boolean;
  /** Seconds the reader waits for a wind before letting a light go anyway. */
  wait?: number;
  /** What the reader sees: the cards (flames and hearts, the default) or the exact numbers under them. */
  look?: "cards" | "exact";
  skipEvery?: number;
  onlyEvery?: number;
}

/** How much of a wind's spell the reader thinks a light will burn in the wind (0: none coming for it). */
const WIND_SHARE_AHEAD = 0.6;
const WIND_SHARE_BLOWING = 0.5;

/** The burn the reader weighs for light `index`: what it sees on the card, and the wind to come that bites it. */
function seenBurn(run: RunState, index: number, how: Habit): number {
  const base =
    how.look === "exact"
      ? burnOf(run, index)
      : burnOfPips(burnPips(run, index));
  if (how.wind === false) return base;
  const bitten = windBites(chillKind(run), index);
  if (!bitten) return base;
  const ahead = chillForecast(run);
  if (isChillBlowing(run))
    return (
      base *
      (1 +
        (chillBite(Math.round(run.resources.wmChillSize ?? 0)) - 1) *
          WIND_SHARE_BLOWING)
    );
  return ahead === null
    ? base
    : base * (1 + (chillBite(ahead) - 1) * WIND_SHARE_AHEAD);
}

/** The company the reader weighs for light `index`: the card's hearts, moved a little by the arrow. */
function seenCompany(run: RunState, index: number, how: Habit): number {
  return how.look === "exact"
    ? companyOf(run, index)
    : companyOfPips(run, companyPips(run, index));
}

/** The light a plain rule would pick, or -1. */
function pickByOrder(
  run: RunState,
  order: NonNullable<Habit["order"]>
): number {
  const open = choices(run);
  if (open.length === 0) return -1;
  const score = (i: number): number =>
    order === "burn"
      ? -burnOf(run, i)
      : order === "company"
        ? companyOf(run, i)
        : order === "ratio"
          ? companyOf(run, i) / Math.max(1e-6, burnOf(run, i))
          : i;
  return open.reduce((a, b) => (score(b) < score(a) ? b : a));
}

/**
 * The light the patient reader lets go now, or -1. While a wind blows, a
 * light it bites pays more to let go (the wind carries the goodbye), so the
 * reader lets the biggest of those go. Otherwise it waits for a wind, but not
 * for ever: after `READER_WAIT` seconds with no goodbye it lets go the light
 * that keeps the least company for the warmth it costs, as the cards show it.
 */
export function readerPick(run: RunState, how: Habit = {}): number {
  const open = choices(run);
  if (open.length === 0) return -1;
  if (how.wind !== false && isChillBlowing(run)) {
    const carried = open.filter((i) => isCarried(run, i));
    if (carried.length > 0)
      return carried.reduce((a, b) =>
        lumpNow(run, b) > lumpNow(run, a) ? b : a
      );
  }
  const waited = res(run, "wmNet");
  if (how.wind !== false && waited < (how.wait ?? READER_WAIT)) return -1;
  let best = -1;
  let bestScore = Infinity;
  for (const i of open) {
    const score =
      seenCompany(run, i, how) / Math.max(1e-6, seenBurn(run, i, how));
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * Lets the lights go. A plain rule follows `order` (from `after` seconds); the
 * reader weighs each light. It looks in every few seconds, and misses a
 * stretch now and then if `skipEvery` or `onlyEvery` say so.
 */
export const letsLightsGo =
  (how: Habit = {}): Choice =>
  (run, available) => {
    if (run.phase !== 3 || boatArrived(run)) return [];
    if (Math.floor(run.time) % LOOK_EVERY !== 0) return [];
    const stretch = Math.floor(run.time / 20);
    if (how.skipEvery && stretch % how.skipEvery === how.skipEvery - 1)
      return [];
    if (how.onlyEvery && stretch % how.onlyEvery !== 0) return [];
    if (lockLeft(run) > 0) return [];
    let pick = -1;
    const since = run.time - (run.transitions.at(-1)?.at ?? 0);
    if (since >= (how.after ?? 0))
      pick = how.order ? pickByOrder(run, how.order) : readerPick(run, how);
    const id = letGoActionId(Math.max(0, pick));
    return pick >= 0 && available.includes(id) && isLit(run, pick) ? [id] : [];
  };
