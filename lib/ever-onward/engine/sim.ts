import {
  affordableUpgrades,
  buy,
  canPerformAction,
  manualAction,
  newRun,
  performAction,
  tick,
  upgradeCost,
  visibleActions,
} from "./engine";
import type { RunState, UniverseDef, UpgradeDef } from "./types";

export interface Strategy {
  /** Taps per simulated second (default 3). */
  tapsPerSecond?: number;
  /** Taps per second as a function of the run (overrides `tapsPerSecond`). */
  tapRate?(run: RunState): number;
  /** Stop tapping after this many seconds (default: never). */
  tapUntil?: number;
  /** Buy upgrades at all (false: only tap; default true). */
  buys?: boolean;
  /**
   * Pick from the affordable upgrades. Default: highest `priority`, then
   * cheapest.
   */
  choose?(run: RunState, affordable: UpgradeDef[]): UpgradeDef | undefined;
  /**
   * Seconds between trips to the shop (default 0: look every step). A trip
   * buys everything affordable, so this models a player who is busy tapping.
   */
  shopEvery?: number;
  /**
   * Action ids to perform this step (buying oil). Asked until it returns
   * nothing or the action can't be done.
   */
  actions?(run: RunState, available: readonly string[]): string[];
}

export interface SimOptions {
  strategy?: Strategy;
  maxSeconds: number;
  /** Seconds per step, at most 1 (default 0.5). */
  step?: number;
  /** Permanent upgrade levels shaping the fresh run. */
  prestige?: Record<string, number>;
  /** Start from this run instead of a fresh one. */
  startRun?: RunState;
  seed?: number;
  /** Stop as soon as this is true (checked after each step). */
  stopWhen?(run: RunState): boolean;
}

export interface TimedEvent {
  t: number;
  id: string;
}

export interface SimResult {
  finished: boolean;
  /** Run time at completion, or null if it did not finish. */
  finishTime: number | null;
  /** Run time the sim stopped at. */
  endTime: number;
  finalRun: RunState;
  purchases: (TimedEvent & { level: number })[];
  /** Actions performed (hand-made decisions). */
  actionsDone: TimedEvent[];
  /** With `shopEvery`: upgrades affordable at each trip, before buying. */
  affordableAtShop: number[];
  /** Upgrades popping in. */
  unlocks: TimedEvent[];
  /** Phase entries (phase id). */
  phases: TimedEvent[];
  /** Longest stretch with no purchase and no unlock (incl. start and end). */
  longestGap: { seconds: number; from: number; to: number };
  /**
   * Like `longestGap`, but only unlocks, phase changes, the first purchase of
   * each upgrade and upgrades capped at 10 levels or fewer count: buying
   * another level of a cheap repeatable is filler, not something new.
   */
  longestMilestoneGap: { seconds: number; from: number; to: number };
}

const FILLER_MIN_LEVELS = 10;

/** A step of 0 or less would never advance the clock. */
const MIN_STEP = 0.01;

const cheapestFirst = (
  run: RunState,
  affordable: UpgradeDef[]
): UpgradeDef | undefined =>
  [...affordable].sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      upgradeCost(run, a) - upgradeCost(run, b)
  )[0];

function longestGap(
  times: readonly number[],
  start: number,
  end: number
): SimResult["longestGap"] {
  let longest = { seconds: 0, from: start, to: start };
  let previous = start;
  for (const t of [...times, end]) {
    if (t - previous > longest.seconds)
      longest = { seconds: t - previous, from: previous, to: t };
    previous = t;
  }
  return longest;
}

/**
 * Plays a universe headless in simulated time: taps at a human rate and buys
 * what the strategy picks. Deterministic for a given seed.
 */
export function simulate(def: UniverseDef, options: SimOptions): SimResult {
  const strategy = options.strategy ?? {};
  const tapsPerSecond = strategy.tapsPerSecond ?? 3;
  const tapUntil = strategy.tapUntil ?? Infinity;
  const buys = strategy.buys ?? true;
  const choose = strategy.choose ?? cheapestFirst;
  const step = Math.min(1, Math.max(MIN_STEP, options.step ?? 0.5));

  let run = options.startRun ?? newRun(def, options.prestige, options.seed);
  const startTime = run.time;
  const purchases: SimResult["purchases"] = [];
  const actionsDone: TimedEvent[] = [];
  const affordableAtShop: number[] = [];
  const shopEvery = strategy.shopEvery ?? 0;
  let nextShop = startTime;
  const unlocks: TimedEvent[] = [];
  const phases: TimedEvent[] = [];
  const eventTimes: number[] = [];
  const milestoneTimes: number[] = [];
  const knownRevealed = new Set(run.revealed);
  let knownTransitions = run.transitions.length;
  let tapDebt = 0;

  const record = () => {
    for (const id of run.revealed) {
      if (knownRevealed.has(id)) continue;
      knownRevealed.add(id);
      unlocks.push({ t: run.time, id });
      eventTimes.push(run.time);
      milestoneTimes.push(run.time);
    }
    for (; knownTransitions < run.transitions.length; knownTransitions += 1) {
      const { to, at } = run.transitions[knownTransitions];
      phases.push({ t: at, id: to });
      milestoneTimes.push(at);
    }
  };

  const buyAll = () => {
    for (let guard = 0; guard < 1000; guard += 1) {
      const pick = choose(run, affordableUpgrades(def, run));
      if (!pick) return;
      run = buy(def, run, pick.id);
      purchases.push({
        t: run.time,
        id: pick.id,
        level: run.owned[pick.id] ?? 0,
      });
      eventTimes.push(run.time);
      const level = run.owned[pick.id] ?? 0;
      if (level === 1 || (pick.maxLevel ?? 1) <= FILLER_MIN_LEVELS)
        milestoneTimes.push(run.time);
      record();
    }
  };

  const act = () => {
    if (!strategy.actions) return;
    for (let guard = 0; guard < 20; guard += 1) {
      const available = visibleActions(def, run)
        .map((a) => a.id)
        .filter((id) => canPerformAction(def, run, id));
      const picks = strategy
        .actions(run, available)
        .filter((id) => available.includes(id));
      if (picks.length === 0) return;
      for (const id of picks) {
        run = performAction(def, run, id);
        actionsDone.push({ t: run.time, id });
      }
    }
  };

  record();
  while (
    !run.complete &&
    run.time - startTime < options.maxSeconds &&
    !options.stopWhen?.(run)
  ) {
    if (run.time < tapUntil) {
      tapDebt += (strategy.tapRate?.(run) ?? tapsPerSecond) * step;
      for (; tapDebt >= 1; tapDebt -= 1) run = manualAction(def, run);
    }
    run = tick(def, run, step);
    record();
    act();
    if (buys && run.time >= nextShop) {
      if (shopEvery > 0) {
        affordableAtShop.push(affordableUpgrades(def, run).length);
        nextShop = run.time + shopEvery;
      }
      buyAll();
    }
  }

  const endTime = run.time;
  const longest = longestGap(eventTimes, startTime, endTime);
  const longestMilestone = longestGap(milestoneTimes, startTime, endTime);
  return {
    finished: run.complete,
    finishTime: run.complete ? endTime : null,
    endTime,
    finalRun: run,
    purchases,
    actionsDone,
    affordableAtShop,
    unlocks,
    phases,
    longestGap: longest,
    longestMilestoneGap: longestMilestone,
  };
}
