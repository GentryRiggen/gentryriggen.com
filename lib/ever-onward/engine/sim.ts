import {
  affordableUpgrades,
  buy,
  canPerformAction,
  cloneRun,
  isMaxed,
  manualAction,
  manualGain,
  newRun,
  performAction,
  previewUpgrade,
  tick,
  upgradeCost,
  visibleActions,
  visibleUpgrades,
} from "./engine";
import { upkeepRate } from "./rate";
import {
  isMeaningful,
  type NoveltyEvent,
  type OptionView,
  type PhaseSpan,
  type PurchaseRecord,
  type Trace,
  type TraceSample,
} from "./trace";
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
  /**
   * Record the scorecard trace (time series, purchase detail, novelty). Off
   * by default: it clones the run to probe effects, so it is slower.
   */
  trace?: { sampleEvery?: number };
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
  /** Present when `options.trace` was set. */
  trace?: Trace;
}

const FILLER_MIN_LEVELS = 10;

const MAX_EFFECT_RATIO = 100;
/** A tiny income can't make every purchase look like a 1000% jump. */
const INCOME_FLOOR = 0.01;
const DEFAULT_SAMPLE_EVERY = 5;

interface Income {
  /** Gross gains per second with no taps (never negative). */
  auto: number;
  manual: number;
  upkeep: number;
  /** What the player feels: auto + manual - upkeep. */
  net: number;
}

/**
 * Income of the phase's main resource, found by probing: tick a clone one
 * second for the automatic part and add `manualGain` times the tap rate.
 * Upkeep (lamp oil paid in coins) is not inside the tick, so it is taken off;
 * a tick that already loses the resource (a fading flame) is already net.
 */
function incomeOf(def: UniverseDef, run: RunState, tps: number): Income {
  const main = def.phases[run.phase].manualResource;
  const diff =
    (tick(def, run, 1).resources[main] ?? 0) - (run.resources[main] ?? 0);
  const manual = manualGain(def, run) * tps;
  const upkeep = diff < 0 ? 0 : upkeepRate(def, run, main);
  return {
    auto: Math.max(0, diff),
    manual,
    upkeep,
    net: diff + manual - upkeep,
  };
}

const ratioOf = (before: number, after: number): number =>
  Math.min(
    MAX_EFFECT_RATIO,
    Math.max(-1, (after - before) / Math.max(Math.abs(before), INCOME_FLOOR))
  );

/**
 * What buying `upgrade` would do to income and the scene, even if it can't be
 * afforded yet (the clone gets the money).
 */
function probeUpgrade(
  def: UniverseDef,
  run: RunState,
  upgrade: UpgradeDef,
  tps: number,
  incomeBefore: number
): OptionView {
  const cost = upgradeCost(run, upgrade);
  const clone = cloneRun(run);
  clone.resources[upgrade.currency] = Math.max(
    clone.resources[upgrade.currency] ?? 0,
    cost
  );
  const bought = buy(def, clone, upgrade.id);
  const didBuy = bought !== clone;
  const phaseChanged = didBuy && bought.phase !== run.phase;
  const effectRatio =
    didBuy && !phaseChanged
      ? ratioOf(incomeBefore, incomeOf(def, bought, tps).net)
      : 0;
  const sceneChanged =
    phaseChanged || (didBuy && (def.sceneDiff?.(run, bought) ?? false));
  const kind = upgrade.kind ?? "scale";
  return {
    id: upgrade.id,
    cost,
    currency: upgrade.currency,
    effect: previewUpgrade(def, run, upgrade.id),
    effectRatio,
    sceneChanged,
    kind,
    meaningful: isMeaningful({ effectRatio, sceneChanged, kind }),
  };
}

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

  const traceOn = options.trace !== undefined;
  const sampleEvery = options.trace?.sampleEvery ?? DEFAULT_SAMPLE_EVERY;
  const samples: TraceSample[] = [];
  const tracePurchases: PurchaseRecord[] = [];
  const novelty: NoveltyEvent[] = [];
  const knownStory = new Set(run.story);
  const knownActions = new Set<string>();
  const knownResources = new Set<string>();
  const knownPlates = new Set<string>();
  const affordableSince = new Map<string, number>();
  let nextSample = startTime;
  let lastPurchaseAt = startTime;

  const currentTaps = (): number =>
    run.time < tapUntil ? (strategy.tapRate?.(run) ?? tapsPerSecond) : 0;

  const recordNovelty = () => {
    for (const id of run.story) {
      if (knownStory.has(id)) continue;
      knownStory.add(id);
      novelty.push({ t: run.time, kind: "story", id });
    }
    for (const action of visibleActions(def, run)) {
      if (knownActions.has(action.id)) continue;
      knownActions.add(action.id);
      novelty.push({ t: run.time, kind: "action", id: action.id });
    }
    const phaseId = def.phases[run.phase].id;
    for (const resource of def.resources) {
      const shown = resource.phases
        ? resource.phases.includes(phaseId) && resource.phases.length > 0
        : true;
      if (!shown || knownResources.has(resource.id)) continue;
      if ((run.resources[resource.id] ?? 0) <= 0) continue;
      knownResources.add(resource.id);
      novelty.push({ t: run.time, kind: "resource", id: resource.id });
    }
  };

  const sample = () => {
    const tps = currentTaps();
    const income = incomeOf(def, run, tps);
    const visible = visibleUpgrades(def, run).filter((u) => !isMaxed(run, u));
    const affordableNow = new Set(
      affordableUpgrades(def, run).map((u) => u.id)
    );
    const views = visible.map((u) => ({
      view: probeUpgrade(def, run, u, tps, income.net),
      isAffordable: affordableNow.has(u.id),
    }));
    const goals = views.filter((v) => !v.isAffordable).map((v) => v.view);
    const wait = goals
      .filter((g) => g.meaningful)
      .map((g) => (g.cost - (run.resources[g.currency] ?? 0)) / income.net);
    const phaseId = def.phases[run.phase].id;
    const plates = def.plates?.(run) ?? [];
    for (const plate of plates) {
      if (knownPlates.has(plate)) continue;
      knownPlates.add(plate);
      novelty.push({ t: run.time, kind: "plate", id: plate });
    }
    samples.push({
      t: run.time,
      phase: run.phase,
      resources: Object.fromEntries(
        def.resources
          .filter((r) => !r.phases || r.phases.includes(phaseId))
          .map((r) => [r.id, run.resources[r.id] ?? 0])
      ),
      autoRate: income.auto,
      manualRate: income.manual,
      upkeep: income.upkeep,
      tapsPerSecond: tps,
      visible: visible.map((u) => u.id),
      affordable: views.filter((v) => v.isAffordable).map((v) => v.view),
      goals,
      cheapestVisibleCost: views.length
        ? Math.min(...views.map((v) => v.view.cost))
        : null,
      waitEstimate:
        income.net > 0 && wait.length ? Math.max(0, Math.min(...wait)) : null,
      consumables: Object.fromEntries(
        (def.consumables ?? []).map((c) => [c.id, c.level(run)])
      ),
      plates,
    });
  };

  const trackAffordable = () => {
    const now = new Set(affordableUpgrades(def, run).map((u) => u.id));
    for (const id of now)
      if (!affordableSince.has(id)) affordableSince.set(id, run.time);
    for (const id of [...affordableSince.keys()])
      if (!now.has(id)) affordableSince.delete(id);
  };

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
    if (traceOn) recordNovelty();
  };

  const logPurchase = (
    before: RunState,
    pick: UpgradeDef,
    tps: number,
    incomeBefore: number
  ) => {
    const level = run.owned[pick.id] ?? 0;
    const phaseChanged = run.phase !== before.phase;
    const incomeAfter = phaseChanged
      ? incomeBefore
      : incomeOf(def, run, tps).net;
    const effectRatio = phaseChanged ? 0 : ratioOf(incomeBefore, incomeAfter);
    const sceneChanged =
      phaseChanged || (def.sceneDiff?.(before, run) ?? false);
    const kind = pick.kind ?? "scale";
    tracePurchases.push({
      t: run.time,
      id: pick.id,
      level,
      phase: before.phase,
      cost: upgradeCost(before, pick),
      currency: pick.currency,
      currencyBefore: before.resources[pick.currency] ?? 0,
      incomeBefore,
      incomeAfter,
      effectRatio,
      sceneChanged,
      kind,
      meaningful: isMeaningful({ effectRatio, sceneChanged, kind }),
      sinceLastPurchase: run.time - lastPurchaseAt,
      waitedFor: run.time - (affordableSince.get(pick.id) ?? run.time),
    });
    if (level === 1 && sceneChanged)
      novelty.push({ t: run.time, kind: "scene", id: pick.id });
    lastPurchaseAt = run.time;
    affordableSince.delete(pick.id);
  };

  const buyAll = () => {
    for (let guard = 0; guard < 1000; guard += 1) {
      const pick = choose(run, affordableUpgrades(def, run));
      if (!pick) return;
      const before = run;
      const tps = traceOn ? currentTaps() : 0;
      const incomeBefore = traceOn ? incomeOf(def, before, tps).net : 0;
      run = buy(def, run, pick.id);
      if (traceOn) logPurchase(before, pick, tps, incomeBefore);
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
  if (traceOn) {
    sample();
    nextSample = startTime + sampleEvery;
  }
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
    if (traceOn) {
      trackAffordable();
      if (run.time >= nextSample) {
        sample();
        nextSample += sampleEvery;
      }
    }
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
  let trace: Trace | undefined;
  if (traceOn) {
    for (const p of phases) novelty.push({ t: p.t, kind: "phase", id: p.id });
    for (const u of unlocks) {
      novelty.push({
        t: u.t,
        kind: "upgrade",
        id: u.id,
        upgradeKind: def.upgrades.find((x) => x.id === u.id)?.kind ?? "scale",
      });
    }
    novelty.sort((a, b) => a.t - b.t);
    const bounds: PhaseSpan[] = [];
    let spanStart = startTime;
    const marks = [...run.transitions.filter((x) => x.at >= startTime)];
    const firstIndex = options.startRun?.phase ?? 0;
    marks.forEach((m, i) => {
      bounds.push({
        id: m.from,
        index: firstIndex + i,
        start: spanStart,
        end: m.at,
      });
      spanStart = m.at;
    });
    bounds.push({
      id: def.phases[run.phase].id,
      index: run.phase,
      start: spanStart,
      end: endTime,
    });
    trace = {
      sampleEvery,
      samples,
      purchases: tracePurchases,
      novelty,
      phases: bounds,
    };
  }
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
    trace,
  };
}
