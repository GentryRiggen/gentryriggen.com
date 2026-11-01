import {
  affordableUpgrades,
  buy,
  canPerformAction,
  cloneRun,
  greetVisitor,
  isMaxed,
  manualAction,
  manualGain,
  newRun,
  performAction,
  projectSeenFlag,
  shownProjects,
  canAffordProject,
  startProject,
  previewUpgrade,
  tick,
  upgradeCost,
  visibleActions,
  visibleTeasers,
  visibleUpgrades,
  waitingVisitors,
} from "./engine";
import { upkeepRate } from "./rate";
import {
  isMeaningful,
  TEASER_MIN_SECONDS,
  type NoveltyEvent,
  type OptionView,
  type PhaseSpan,
  type PurchaseRecord,
  type Trace,
  type TraceSample,
} from "./trace";
import type { ProjectDef, RunState, UniverseDef, UpgradeDef } from "./types";

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
  /**
   * Projects (see `ProjectDef`), looked at on each shop trip: "best" starts
   * the affordable one worth the most (forward income gain plus its
   * `botValue`), a function picks ids itself, omitted never starts one.
   */
  projects?: "best" | ((run: RunState, shown: ProjectDef[]) => string[]);
  /**
   * Seconds a visitor waits before this player greets it (default 4). A
   * player who presses no buttons never greets anyone (Infinity).
   */
  greetAfter?: number;
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
  /** Projects started (see `ProjectDef`). */
  projectsDone: TimedEvent[];
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

/** A plate counts as attended for this long after one of its actions. */
export const ATTENTION_SECONDS = 90;

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
  const probe = def.incomeView?.(run) ?? run;
  const diff =
    (tick(def, probe, 1).resources[main] ?? 0) - (probe.resources[main] ?? 0);
  const manual = manualGain(def, run) * tps;
  const upkeep = diff < 0 ? 0 : upkeepRate(def, run, main);
  return {
    auto: Math.max(0, diff),
    manual,
    upkeep,
    net: diff + manual - upkeep,
  };
}

/**
 * What one tap earns and what the machines earn per second on their own, in
 * the phase's main resource: the two halves of the manual share. Bots that
 * tap only when it helps read this.
 */
export function tapAndAuto(
  def: UniverseDef,
  run: RunState
): { tap: number; auto: number } {
  return { tap: manualGain(def, run), auto: incomeOf(def, run, 0).auto };
}

/** Seconds of play looked ahead when judging what a purchase really does. */
const FORWARD_SECONDS = 60;
const FORWARD_STEP = 5;

/**
 * Income of the main resource after `FORWARD_SECONDS` of play with no buying
 * and no taps: a purchase that compounds (probes copying themselves) pays off
 * over the minute, not at the instant it is bought. Steps are coarse (the
 * universe's own tick, called directly), which is fine for an estimate.
 */
function forwardIncome(def: UniverseDef, run: RunState, tps: number): number {
  const draft = cloneRun(def.incomeView?.(run) ?? run);
  for (let t = 0; t < FORWARD_SECONDS; t += FORWARD_STEP)
    def.tick(draft, FORWARD_STEP);
  return incomeOf(def, draft, tps).net;
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
  incomeBefore: number,
  forwardBefore: number
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
      ? Math.max(
          ratioOf(incomeBefore, incomeOf(def, bought, tps).net),
          ratioOf(forwardBefore, forwardIncome(def, bought, tps))
        )
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

/**
 * What starting a project is worth to a bot: the income it adds a minute on
 * (as a ratio), plus the project's own hint for effects income can't show.
 */
export function projectValue(
  def: UniverseDef,
  run: RunState,
  project: ProjectDef,
  tps = 0
): number {
  const clone = cloneRun(run);
  for (const cost of project.costs)
    clone.resources[cost.resource] = Math.max(
      clone.resources[cost.resource] ?? 0,
      cost.amount
    );
  const started = startProject(def, clone, project.id);
  const gain =
    started === clone
      ? 0
      : ratioOf(
          forwardIncome(def, clone, tps),
          forwardIncome(def, started, tps)
        );
  return gain + (project.botValue ?? 0);
}

/** The affordable project worth the most, or undefined. */
export function bestProject(
  def: UniverseDef,
  run: RunState,
  shown: readonly ProjectDef[]
): ProjectDef | undefined {
  return shown
    .filter((p) => canAffordProject(run, p))
    .map((p) => ({ p, value: projectValue(def, run, p) }))
    .sort((a, b) => b.value - a.value)[0]?.p;
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
  const projectsDone: TimedEvent[] = [];
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
  const knownProjects = new Set<string>();
  const affordableSince = new Map<string, number>();
  const teaserSeen = new Map<string, number>();
  const visitorSeen = new Map<string, number>();
  const lastActionAt = new Map<string, number>();
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
    // A teaser counts once, on first sight, and only if it stood on show long
    // enough before its upgrade popped in to be something to look forward to.
    const showing = new Set(visibleTeasers(def, run).map((t) => t.upgradeId));
    for (const id of showing)
      if (!teaserSeen.has(id)) teaserSeen.set(id, run.time);
    for (const [id, seen] of [...teaserSeen]) {
      if (showing.has(id)) continue;
      teaserSeen.delete(id);
      if (run.revealed.includes(id) && run.time - seen >= TEASER_MIN_SECONDS)
        novelty.push({ t: seen, kind: "teaser", id, isSoft: true });
    }
    for (const project of def.projects ?? []) {
      if (knownProjects.has(project.id)) continue;
      if (!run.flags[projectSeenFlag(project.id)]) continue;
      knownProjects.add(project.id);
      novelty.push({ t: run.time, kind: "project", id: project.id });
    }
    for (const visitor of def.visitors ?? []) {
      if (visitorSeen.has(visitor.id)) continue;
      if (!run.flags[`here-${visitor.id}`]) continue;
      visitorSeen.set(visitor.id, run.time);
      novelty.push({ t: run.time, kind: "visitor", id: visitor.id });
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
    const forward = forwardIncome(def, run, tps);
    const views = visible.map((u) => ({
      view: probeUpgrade(def, run, u, tps, income.net, forward),
      isAffordable: affordableNow.has(u.id),
    }));
    const goals = views.filter((v) => !v.isAffordable).map((v) => v.view);
    const wait = goals
      .filter((g) => g.meaningful)
      .map((g) => (g.cost - (run.resources[g.currency] ?? 0)) / income.net);
    const phaseId = def.phases[run.phase].id;
    const offered = def.plates?.(run) ?? [];
    for (const plate of offered) {
      if (knownPlates.has(plate)) continue;
      knownPlates.add(plate);
      novelty.push({ t: run.time, kind: "plate", id: plate });
    }
    const plateActions = def.plateActions ?? {};
    const isAttended = (plate: string): boolean =>
      (plateActions[plate] ?? []).some(
        (id) =>
          run.time - (lastActionAt.get(id) ?? -Infinity) <= ATTENTION_SECONDS
      );
    // Attention events: a tended plate counts while the player tends it, an
    // untended one only when it is on offer and needs no action.
    const plates = [
      ...offered.filter((plate) => !(plate in plateActions)),
      ...Object.keys(plateActions).filter(isAttended),
    ];
    samples.push({
      t: run.time,
      phase: run.phase,
      sinceEntry: run.time - (run.transitions.at(-1)?.at ?? 0),
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
      teasers: visibleTeasers(def, run).map((t) => t.upgradeId),
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
    // What the purchase does at once, or a minute on against a clone that did
    // not buy it: probes that copy themselves read about 0% at the instant.
    const effectRatio = phaseChanged
      ? 0
      : Math.max(
          ratioOf(incomeBefore, incomeAfter),
          ratioOf(forwardIncome(def, before, tps), forwardIncome(def, run, tps))
        );
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
    // The first purchase of a scene-changing upgrade is a beat; later steps
    // of the same thing (the sixth keeper) are not, or they would pad the
    // cadence.
    if (level === 1 && sceneChanged)
      novelty.push({ t: run.time, kind: "scene", id: pick.id });
    lastPurchaseAt = run.time;
    affordableSince.delete(pick.id);
  };

  const startProjects = () => {
    if (!strategy.projects) return;
    for (let guard = 0; guard < 20; guard += 1) {
      if (run.complete) return;
      const shown = shownProjects(def, run);
      if (shown.length === 0) return;
      const picks =
        strategy.projects === "best"
          ? [bestProject(def, run, shown)?.id].filter(
              (id): id is string => id !== undefined
            )
          : strategy.projects(run, shown);
      const before = run;
      for (const id of picks) {
        const next = startProject(def, run, id);
        if (next === run) continue;
        run = next;
        projectsDone.push({ t: run.time, id });
        record();
      }
      if (run === before) return;
    }
  };

  const buyAll = () => {
    for (let guard = 0; guard < 1000; guard += 1) {
      // A finished run refuses every buy, so an upgrade still "affordable" at
      // the moment the run completes must not loop (or log a phantom buy).
      if (run.complete) return;
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

  const greetAfter = strategy.greetAfter ?? 4;
  const greet = () => {
    for (const visitor of waitingVisitors(def, run)) {
      const seen = visitorSeen.get(visitor.id) ?? run.time;
      if (!visitorSeen.has(visitor.id)) visitorSeen.set(visitor.id, seen);
      if (run.time - seen < greetAfter) continue;
      run = greetVisitor(def, run, visitor.id);
      actionsDone.push({ t: run.time, id: `greet-${visitor.id}` });
    }
  };

  const act = () => {
    greet();
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
        lastActionAt.set(id, run.time);
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
      startProjects();
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
    projectsDone,
    affordableAtShop,
    unlocks,
    phases,
    longestGap: longest,
    longestMilestoneGap: longestMilestone,
    trace,
  };
}
