import { upgradeCost } from "../../engine/engine";
import type { RunState } from "../../engine/types";
import { UPGRADES } from "./upgrades";
import { TUNING } from "./tuning";
import {
  LIGHT_COUNT,
  SHELTER_ACTION,
  biteWith,
  burnTotal,
  canShelter,
  chillSize,
  hearthWarmth,
  shelterCost,
  stokeOf,
  boatArrived,
  boatProgressOf,
  burnOf,
  canLetGo,
  chillBite,
  chillForecast,
  companyOf,
  isChillBlowing,
  isLit,
  letGoActionId,
  lockLeft,
  memoryOf,
  paceAt,
  warmthOf,
} from "./warmth";

/**
 * How the simulated players let the lights go. The reading player weighs what
 * each light gives (the company that pays resolve, the lump when it goes)
 * against what it costs to keep (the warmth that slows the boat), and lets go
 * sooner when the way home is short (resolve has little left to buy), when a
 * cold wind is coming and when a light is heavy. The same player with one
 * signal switched off, or a plain rule (a fixed order, a fixed time), is a
 * simple habit, which is what the lights' tests set it against.
 */

type Choice = (run: RunState, available: readonly string[]) => string[];

const L = TUNING.last;
const INDEXES: readonly number[] = Array.from(
  { length: LIGHT_COUNT },
  (_, i) => i
);

/** The reader looks in this often (seconds). */
const LOOK_EVERY = 5;
/** How many seconds of boat the reader thinks a resolve is worth, against the sails' own sums (tuned on the real economy). */
const READER_WEIGH = 0.45;
/** The chains resolve buys in the last part. */
const SHOP_CHAINS = /^(sail|hearth|slowburn|company|song)-/;
/** The share of the trip left a step of the hearth, the glass or the company is thought to save. */
const OTHER_STEP = 0.03;

/** The lights still lit that could go this second. */
const choices = (run: RunState): number[] =>
  INDEXES.filter((i) => canLetGo(run, i));

/** Seconds of the boat's trip left at this pace. */
export function tripLeft(run: RunState): number {
  const pace = paceAt(warmthOf(run));
  return ((100 - boatProgressOf(run)) / 100) * (L.boatSeconds / pace);
}

/** How much more a wind of the forecast size would burn (1: none). */
export function windAhead(run: RunState): number {
  if (isChillBlowing(run)) return 1;
  const size = chillForecast(run);
  return size === null ? 1 : chillBite(size);
}

export interface Habit {
  /** Which light a plain rule lets go first. */
  order?: "index" | "burn" | "company" | "ratio";
  /** A plain rule lets lights go only after this many seconds of the part. */
  after?: number;
  /** The reader's price of a resolve, in seconds of boat per resolve, when the whole trip is left. */
  weigh?: number;
  /** The reader counts the trip left (off: it assumes half is left). */
  trip?: boolean;
  /** The reader lets a heavy light go ahead of a forecast wind. */
  wind?: boolean;
  /** Cupping the flame against a wind: the reader weighs it, or a plain rule always does it or never does. */
  shelter?: "reads" | "always" | "never";
  skipEvery?: number;
  onlyEvery?: number;
}

/** The share of the boat's pace each second of burning costs: the pace letting it go would add, over the pace it would then have. */
function paceCostPerSecond(
  run: RunState,
  index: number,
  windy: boolean
): number {
  const warmth = warmthOf(run);
  const gain = Math.min(
    1 - warmth,
    burnOf(run, index) * (windy ? windAhead(run) : 1)
  );
  const after = paceAt(warmth + gain);
  return (after - paceAt(warmth)) / after;
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
 * Seconds of boat a resolve is worth right now: the sails still to buy save a
 * share of the trip left, for their price together. With no sail left (or none worth buying)
 * resolve buys nothing that matters, and the reader lets the lights go.
 */
export function secondsPerResolve(run: RunState, how: Habit = {}): number {
  const steps = UPGRADES.filter(
    (u) => SHOP_CHAINS.test(u.id) && (run.owned[u.id] ?? 0) === 0
  );
  if (steps.length === 0) return 0;
  const sails = steps.filter((u) => u.id.startsWith("sail-")).length;
  const trip = how.trip === false ? L.boatSeconds * 0.5 : tripLeft(run);
  // A sail saves a share of the trip left; a hearth step or a lamp's glass a little.
  const saved =
    trip * (1 - L.sailMult ** -sails) +
    trip * OTHER_STEP * (steps.length - sails);
  const price = steps.reduce((sum, u) => sum + upgradeCost(run, u), 0);
  return (how.weigh ?? READER_WEIGH) * (saved / price);
}

/** The light the reader would let go now, or -1: it costs more boat than it earns. */
export function readerPick(run: RunState, how: Habit = {}): number {
  const open = choices(run);
  if (open.length === 0) return -1;
  const lambda = secondsPerResolve(run, how);
  const warm = L.coldResolve + (1 - L.coldResolve) * warmthOf(run);
  let best = -1;
  let bestMargin = 0;
  for (const i of open) {
    const margin =
      paceCostPerSecond(run, i, how.wind !== false) -
      lambda * companyOf(run, i) * warm;
    if (margin > bestMargin) {
      bestMargin = margin;
      best = i;
    }
  }
  return best;
}

/**
 * Seconds of boat a cupped flame would save against the wind that is coming or
 * blowing: the pace the lights' burn would cost it, less the pace it costs when
 * the wind bites less. The wind lasts a while, and the flame takes a while to
 * warm up again after it.
 */
export function shelterSaves(run: RunState): number {
  const size = chillSize(run);
  const warmth = warmthOf(run);
  const base = hearthWarmth(run) + stokeOf(run);
  const burn = burnTotal(run);
  const reach = (isShelter: boolean): number => {
    const target = Math.min(
      1,
      Math.max(L.warmFloor, base - burn * biteWith(size, isShelter))
    );
    return warmth + (target - warmth) * 0.8;
  };
  const gain = paceAt(reach(true)) - paceAt(reach(false));
  return (L.chill.seconds * 1.5 * gain) / paceAt(warmth);
}

/** Cups the flame when it would save more boat than the resolve it costs is worth. */
function shelters(
  run: RunState,
  available: readonly string[],
  how: Habit
): string[] {
  if (!available.includes(SHELTER_ACTION) || !canShelter(run)) return [];
  const mode = how.shelter ?? "reads";
  if (mode === "never") return [];
  if (mode === "reads") {
    const cost = shelterCost(run) * secondsPerResolve(run, how);
    if (shelterSaves(run) <= cost) return [];
  }
  return [SHELTER_ACTION];
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
    // A plain rule cups the flame only if it says so.
    const cupped =
      how.order && !how.shelter ? [] : shelters(run, available, how);
    if (lockLeft(run) > 0) return cupped;
    let pick = -1;
    if (how.order) {
      const since = run.time - (run.transitions.at(-1)?.at ?? 0);
      pick = since >= (how.after ?? 0) ? pickByOrder(run, how.order) : -1;
    } else {
      pick = readerPick(run, how);
    }
    const id = letGoActionId(Math.max(0, pick));
    return pick >= 0 && available.includes(id) && isLit(run, pick)
      ? [...cupped, id]
      : cupped;
  };

/** What letting light `index` go pays, for tests that compare habits. */
export const lumpOf = memoryOf;
