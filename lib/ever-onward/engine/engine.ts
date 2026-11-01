import type {
  ActionDef,
  ActionView,
  PhaseDef,
  ProjectDef,
  RunState,
  TeaserDef,
  UniverseDef,
  UpgradeDef,
  VisitorDef,
} from "./types";

/** A frame longer than this (a throttled tab) never jumps the game. */
export const MAX_TICK_SECONDS = 1;

export const DEFAULT_SEED = 0x9e3779b9 | 0;

export function cloneRun(run: RunState): RunState {
  return {
    ...run,
    resources: { ...run.resources },
    owned: { ...run.owned },
    mods: { ...run.mods },
    flags: { ...run.flags },
    revealed: [...run.revealed],
    story: [...run.story],
    transitions: run.transitions.map((t) => ({ ...t })),
  };
}

function find<T extends { id: string }>(
  list: readonly T[],
  id: string,
  what: string
): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw new Error(`Unknown ${what}: ${id}`);
  return item;
}

export const currentPhase = (def: UniverseDef, run: RunState): PhaseDef =>
  def.phases[run.phase];

export const isLastPhase = (def: UniverseDef, run: RunState): boolean =>
  run.phase >= def.phases.length - 1;

/** A hook that leaves NaN or Infinity behind must not poison the run. */
function zeroNonFinite(run: RunState): void {
  for (const [id, value] of Object.entries(run.resources)) {
    if (!Number.isFinite(value)) run.resources[id] = 0;
  }
}

/** Reveal what is newly visible, fire due story, advance phases, finish. */
function settle(def: UniverseDef, run: RunState): void {
  zeroNonFinite(run);
  // A phase can finish the moment it starts, so loop (bounded by phase count).
  for (let guard = 0; guard <= def.phases.length; guard += 1) {
    revealUpgrades(def, run);
    revealProjects(def, run);
    arriveVisitors(def, run);
    fireStory(def, run);
    if (isLastPhase(def, run)) {
      if (!run.complete && def.isComplete(run)) run.complete = true;
      return;
    }
    const phase = currentPhase(def, run);
    if (!phase.isDone(run)) return;
    const next = def.phases[run.phase + 1];
    run.transitions.push({ from: phase.id, to: next.id, at: run.time });
    run.phase += 1;
    next.onEnter?.(run);
  }
}

/** Revealed here, not maxed and never bought: the cards "on offer". */
function pendingCount(def: UniverseDef, run: RunState): number {
  return def.upgrades.filter(
    (u) =>
      isVisible(def, run, u) &&
      !isMaxed(run, u) &&
      upgradeLevel(run, u.id) === 0
  ).length;
}

/**
 * Pops in what is newly visible, in definition order, while fewer than
 * `maxVisible` unbought upgrades are on offer. Buying one frees a slot.
 */
function revealUpgrades(def: UniverseDef, run: RunState): void {
  const limit = def.maxVisible ?? Infinity;
  let pending = limit === Infinity ? 0 : pendingCount(def, run);
  for (const upgrade of def.upgrades) {
    if (pending >= limit) return;
    if (!isInPhase(def, run, upgrade) || run.revealed.includes(upgrade.id))
      continue;
    if (upgrade.visibleWhen && !upgrade.visibleWhen(run)) continue;
    run.revealed.push(upgrade.id);
    pending += 1;
  }
}

// ----------------------------------------------------------------- projects

export const DEFAULT_MAX_PROJECTS = 3;
/** Flag set once a project has been offered, and once it is done. */
export const projectSeenFlag = (id: string): string => `project-seen-${id}`;
export const projectDoneFlag = (id: string): string => `project-${id}`;

export const isProjectDone = (run: RunState, id: string): boolean =>
  run.flags[projectDoneFlag(id)] === true;

const isProjectInPhase = (
  def: UniverseDef,
  run: RunState,
  project: ProjectDef
): boolean => project.phase === currentPhase(def, run).id;

/** A project is offered the first time its milestone is reached; it stays. */
function revealProjects(def: UniverseDef, run: RunState): void {
  for (const project of def.projects ?? []) {
    if (run.flags[projectSeenFlag(project.id)]) continue;
    if (!isProjectInPhase(def, run, project)) continue;
    if (project.revealWhen && !project.revealWhen(run)) continue;
    run.flags[projectSeenFlag(project.id)] = true;
  }
}

/**
 * Projects on offer now: revealed in this phase and not done, the first
 * `maxProjects` in definition order (the next one moves up when one is done).
 */
export function shownProjects(def: UniverseDef, run: RunState): ProjectDef[] {
  return (def.projects ?? [])
    .filter(
      (p) =>
        isProjectInPhase(def, run, p) &&
        run.flags[projectSeenFlag(p.id)] === true &&
        !isProjectDone(run, p.id)
    )
    .slice(0, def.maxProjects ?? DEFAULT_MAX_PROJECTS);
}

/** Revealed in this phase but waiting for a free slot. */
export function waitingProjectCount(def: UniverseDef, run: RunState): number {
  return (def.projects ?? []).filter(
    (p) =>
      isProjectInPhase(def, run, p) &&
      run.flags[projectSeenFlag(p.id)] === true &&
      !isProjectDone(run, p.id)
  ).length;
}

/** Projects done in this phase, in definition order. */
export function doneProjects(def: UniverseDef, run: RunState): ProjectDef[] {
  return (def.projects ?? []).filter(
    (p) => isProjectInPhase(def, run, p) && isProjectDone(run, p.id)
  );
}

export const isProjectId = (def: UniverseDef, id: string): boolean =>
  (def.projects ?? []).some((p) => p.id === id);

export const canAffordProject = (run: RunState, project: ProjectDef): boolean =>
  project.costs.every((c) => (run.resources[c.resource] ?? 0) >= c.amount);

export function canStartProject(
  def: UniverseDef,
  run: RunState,
  projectId: string
): boolean {
  if (run.complete) return false;
  const project = shownProjects(def, run).find((p) => p.id === projectId);
  return !!project && canAffordProject(run, project);
}

/** Pays for and finishes a project. Returns the same run if it can't. */
export function startProject(
  def: UniverseDef,
  run: RunState,
  projectId: string
): RunState {
  if (!canStartProject(def, run, projectId)) return run;
  const project = find(def.projects ?? [], projectId, "project");
  const next = cloneRun(run);
  for (const cost of project.costs)
    next.resources[cost.resource] -= cost.amount;
  next.flags[projectDoneFlag(project.id)] = true;
  project.onDone?.(next);
  settle(def, next);
  return next;
}

/** Flag a visitor sets when it arrives, and when it has been greeted. */
export const visitorHereFlag = (id: string): string => `here-${id}`;
export const visitorMetFlag = (id: string): string => `met-${id}`;

/** A visitor arrives the first time its milestone is reached, then waits. */
function arriveVisitors(def: UniverseDef, run: RunState): void {
  if (!def.visitors) return;
  const phaseId = currentPhase(def, run).id;
  for (const visitor of def.visitors) {
    if (visitor.phase !== phaseId) continue;
    if (run.flags[visitorHereFlag(visitor.id)]) continue;
    if (visitor.arrivesWhen(run)) run.flags[visitorHereFlag(visitor.id)] = true;
  }
}

/** Visitors that have arrived and not been greeted yet, in arrival order. */
export function waitingVisitors(def: UniverseDef, run: RunState): VisitorDef[] {
  return (def.visitors ?? []).filter(
    (v) =>
      run.flags[visitorHereFlag(v.id)] === true &&
      run.flags[visitorMetFlag(v.id)] !== true
  );
}

/** Visitors the player has greeted (the logbook), in the order defined. */
export function metVisitors(def: UniverseDef, run: RunState): VisitorDef[] {
  return (def.visitors ?? []).filter(
    (v) => run.flags[visitorMetFlag(v.id)] === true
  );
}

/** Greets a waiting visitor: the gift is given and it joins the logbook. */
export function greetVisitor(
  def: UniverseDef,
  run: RunState,
  visitorId: string
): RunState {
  const visitor = waitingVisitors(def, run).find((v) => v.id === visitorId);
  if (!visitor || run.complete) return run;
  const next = cloneRun(run);
  visitor.give(next);
  next.flags[visitorMetFlag(visitor.id)] = true;
  settle(def, next);
  return next;
}

/** Teasers on show now: their upgrade is in this phase and not yet revealed. */
export function visibleTeasers(def: UniverseDef, run: RunState): TeaserDef[] {
  const phaseId = currentPhase(def, run).id;
  return (def.teasers ?? []).filter((t) => {
    const upgrade = def.upgrades.find((u) => u.id === t.upgradeId);
    if (!upgrade) return false;
    if (t.phase !== undefined) {
      if (t.phase !== phaseId) return false;
    } else if (upgrade.phases && !upgrade.phases.includes(phaseId)) {
      return false;
    }
    if (run.revealed.includes(t.upgradeId)) return false;
    return t.showWhen ? t.showWhen(run) : true;
  });
}

/** Shown on a teaser whose goal is met while the shop is full. */
export const TEASER_READY_HINT =
  "Ready! It pops in when you buy one of the upgrades above.";

/**
 * The line under a teaser. Once its own goal is met it is only waiting for a
 * free slot in the shop (`maxVisible`), so say that instead of a goal the
 * player has already reached.
 */
export function teaserHint(
  def: UniverseDef,
  run: RunState,
  teaser: TeaserDef
): string {
  const upgrade = def.upgrades.find((u) => u.id === teaser.upgradeId);
  const isReady =
    !!upgrade && (!upgrade.visibleWhen || upgrade.visibleWhen(run));
  return isReady ? TEASER_READY_HINT : teaser.hint(run);
}

function fireStory(def: UniverseDef, run: RunState): void {
  const phaseId = currentPhase(def, run).id;
  for (const message of def.story) {
    if (run.story.includes(message.id)) continue;
    if (message.phase !== undefined && message.phase !== phaseId) continue;
    if (!message.when || message.when(run)) run.story.push(message.id);
  }
}

function isInPhase(
  def: UniverseDef,
  run: RunState,
  upgrade: UpgradeDef
): boolean {
  return !upgrade.phases || upgrade.phases.includes(currentPhase(def, run).id);
}

/** A fresh run. `prestigeLevels` are the permanent upgrades that shape it. */
export function newRun(
  def: UniverseDef,
  prestigeLevels: Readonly<Record<string, number>> = {},
  seed: number = DEFAULT_SEED
): RunState {
  const run: RunState = {
    phase: 0,
    time: 0,
    taps: 0,
    complete: false,
    resources: Object.fromEntries(
      def.resources.map((r) => [r.id, r.initial ?? 0])
    ),
    owned: {},
    mods: {},
    flags: {},
    revealed: [],
    story: [],
    transitions: [],
    rng: seed | 0,
  };
  for (const upgrade of def.prestige.upgrades) {
    const level = prestigeLevels[upgrade.id] ?? 0;
    if (level > 0) upgrade.apply(run, Math.min(level, upgrade.maxLevel));
  }
  def.phases[0].onEnter?.(run);
  settle(def, run);
  return run;
}

/** Advance the run by `dt` seconds (clamped to 0..MAX_TICK_SECONDS). */
export function tick(def: UniverseDef, run: RunState, dt: number): RunState {
  if (run.complete) return run;
  const step = Math.min(MAX_TICK_SECONDS, Math.max(0, dt));
  if (!(step > 0)) return run;
  const next = cloneRun(run);
  def.tick(next, step);
  next.time += step;
  settle(def, next);
  return next;
}

/** The free tap. Counts the tap and earns the phase's base income. */
export function manualAction(def: UniverseDef, run: RunState): RunState {
  if (run.complete) return run;
  const next = cloneRun(run);
  def.manualAction(next);
  next.taps += 1;
  settle(def, next);
  return next;
}

/** What one tap would earn right now (of the phase's manual resource). */
export function manualGain(def: UniverseDef, run: RunState): number {
  const { manualResource } = currentPhase(def, run);
  const before = run.resources[manualResource] ?? 0;
  const draft = cloneRun(run);
  def.manualAction(draft);
  return (draft.resources[manualResource] ?? 0) - before;
}

export function upgradeLevel(run: RunState, id: string): number {
  return run.owned[id] ?? 0;
}

export function isMaxed(run: RunState, upgrade: UpgradeDef): boolean {
  return upgradeLevel(run, upgrade.id) >= (upgrade.maxLevel ?? 1);
}

/** Cost of the next level, after the run's `costMult` mod (default 1). */
export function upgradeCost(run: RunState, upgrade: UpgradeDef): number {
  const level = upgradeLevel(run, upgrade.id);
  const mult = run.mods.costMult;
  const safeMult = mult !== undefined && Number.isFinite(mult) && mult > 0;
  return upgrade.baseCost * upgrade.costGrowth ** level * (safeMult ? mult : 1);
}

export function isVisible(
  def: UniverseDef,
  run: RunState,
  upgrade: UpgradeDef
): boolean {
  return isInPhase(def, run, upgrade) && run.revealed.includes(upgrade.id);
}

export function canAfford(run: RunState, upgrade: UpgradeDef): boolean {
  return (
    !isMaxed(run, upgrade) &&
    (run.resources[upgrade.currency] ?? 0) >= upgradeCost(run, upgrade)
  );
}

export function canBuy(
  def: UniverseDef,
  run: RunState,
  upgradeId: string
): boolean {
  const upgrade = find(def.upgrades, upgradeId, "upgrade");
  return (
    !run.complete && isVisible(def, run, upgrade) && canAfford(run, upgrade)
  );
}

/** True while this phase still holds upgrades that have not popped in. */
export function hasUnrevealedUpgrades(
  def: UniverseDef,
  run: RunState
): boolean {
  return def.upgrades.some(
    (u) => isInPhase(def, run, u) && !run.revealed.includes(u.id)
  );
}

/** Visible upgrades, in definition order (maxed ones included). */
export function visibleUpgrades(def: UniverseDef, run: RunState): UpgradeDef[] {
  return def.upgrades.filter((u) => isVisible(def, run, u));
}

/** Visible, not maxed and affordable now. */
export function affordableUpgrades(
  def: UniverseDef,
  run: RunState
): UpgradeDef[] {
  return visibleUpgrades(def, run).filter((u) => canAfford(run, u));
}

/** Buy one level. Returns the same run if it can't be bought. */
export function buy(
  def: UniverseDef,
  run: RunState,
  upgradeId: string
): RunState {
  if (!canBuy(def, run, upgradeId)) return run;
  const upgrade = find(def.upgrades, upgradeId, "upgrade");
  const next = cloneRun(run);
  next.resources[upgrade.currency] -= upgradeCost(run, upgrade);
  const level = upgradeLevel(run, upgrade.id) + 1;
  next.owned[upgrade.id] = level;
  upgrade.onBuy?.(next, level);
  settle(def, next);
  return next;
}

/** The upgrade's before-to-after line, or null when it has none. */
export function previewUpgrade(
  def: UniverseDef,
  run: RunState,
  upgradeId: string
): string | null {
  const upgrade = find(def.upgrades, upgradeId, "upgrade");
  return upgrade.effectPreview?.(run) ?? null;
}

const PREVIEW_ARROW = /\s*(?:→|->)\s*/;

/** Shown when an upgrade would change nothing and has no reason of its own. */
export const GENERIC_NO_EFFECT_REASON = "This won't change anything yet.";

/**
 * True when every before-to-after pair in a preview line is the same
 * ("Picks/sec 388 -> 388"). A line with no arrow is never "nothing".
 */
export function previewChangesNothing(preview: string | null): boolean {
  if (!preview) return false;
  let pairs = 0;
  for (const segment of preview.split(" · ")) {
    const [before, ...rest] = segment.split(PREVIEW_ARROW);
    if (rest.length === 0) continue;
    pairs += 1;
    // The label is shared, so compare whole sides after the arrow split.
    if (before.trim().split(/\s+/).slice(-1)[0] !== rest.join(" ").trim())
      return false;
  }
  return pairs > 0;
}

/** A change smaller than this share of the stat reads as "barely helps". */
export const BARELY_HELPS_BELOW = 0.02;

const UNIT = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 } as const;

/** "1.50K" -> 1500, "388" -> 388; null when there is no number. */
function readShown(text: string): number | null {
  const m = text.match(/-?\d[\d,]*\.?\d*(?:e\d+)?\s*(K|M|B|T)?(?![a-z])/);
  if (!m) return null;
  const n = Number(m[0].replace(/[,KMBT\s]/g, ""));
  return Number.isNaN(n)
    ? null
    : n * (m[1] ? UNIT[m[1] as keyof typeof UNIT] : 1);
}

/**
 * The biggest relative change among a preview's before-to-after pairs (0.005
 * is half a percent), or null when it has no readable pair.
 */
export function previewBiggestChange(preview: string | null): number | null {
  if (!preview) return null;
  let biggest: number | null = null;
  for (const segment of preview.split(" · ")) {
    const [before, ...rest] = segment.split(PREVIEW_ARROW);
    if (rest.length === 0) continue;
    const b = readShown(before.trim().split(/\s+/).slice(-1)[0]);
    const a = readShown(rest.join(" "));
    if (b === null || a === null) return null;
    const change = b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / b;
    biggest = Math.max(biggest ?? 0, change);
  }
  return biggest;
}

/**
 * Why buying this would do (almost) nothing right now, or null when it
 * helps. A preview that changes nothing gets the upgrade's own reason or a
 * generic one; one that moves a stat by under 2% counts only when the
 * upgrade declares a reason. Buying is never blocked; this only steers the
 * HUD and the card.
 */
export function upgradeNoEffectReason(
  run: RunState,
  upgrade: UpgradeDef
): string | null {
  const preview = upgrade.effectPreview?.(run) ?? null;
  if (previewChangesNothing(preview))
    return upgrade.noEffectReason?.(run) ?? GENERIC_NO_EFFECT_REASON;
  const change = previewBiggestChange(preview);
  if (change !== null && change < BARELY_HELPS_BELOW)
    return upgrade.noEffectReason?.(run) ?? null;
  return null;
}

export function visibleActions(def: UniverseDef, run: RunState): ActionDef[] {
  const phaseId = currentPhase(def, run).id;
  return (def.actions ?? []).filter(
    (a) =>
      (!a.phases || a.phases.includes(phaseId)) &&
      (!a.visibleWhen || a.visibleWhen(run))
  );
}

export function canPerformAction(
  def: UniverseDef,
  run: RunState,
  actionId: string
): boolean {
  if (run.complete) return false;
  const action = find(def.actions ?? [], actionId, "action");
  if (!visibleActions(def, run).includes(action)) return false;
  const view: ActionView = action.describe(run);
  if (view.isBlocked) return false;
  return (
    !view.cost || (run.resources[view.cost.resource] ?? 0) >= view.cost.amount
  );
}

/** Pays for and performs an action. Returns the same run if it can't be done. */
export function performAction(
  def: UniverseDef,
  run: RunState,
  actionId: string
): RunState {
  if (!canPerformAction(def, run, actionId)) return run;
  const action = find(def.actions ?? [], actionId, "action");
  const { cost } = action.describe(run);
  const next = cloneRun(run);
  if (cost) next.resources[cost.resource] -= cost.amount;
  action.perform(next, cost?.amount ?? 0);
  settle(def, next);
  return next;
}

const finiteOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

function finiteEntries(
  record: Record<string, number>,
  minimum?: number
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, value] of Object.entries(record)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (minimum !== undefined && value < minimum) continue;
    out[id] = value;
  }
  return out;
}

/**
 * Makes a loaded run playable by this build: resources a newer release added
 * get their defaults, damaged numbers are replaced, and a phase out of range
 * (or a run that can't be repaired) becomes a fresh run.
 */
export function reconcileRun(
  def: UniverseDef,
  run: RunState,
  prestigeLevels: Readonly<Record<string, number>> = {}
): RunState {
  const isPhaseValid =
    Number.isInteger(run.phase) &&
    run.phase >= 0 &&
    run.phase < def.phases.length;
  if (!isPhaseValid) return newRun(def, prestigeLevels);
  const saved = finiteEntries(run.resources);
  const resources = Object.fromEntries(
    def.resources.map((r) => [r.id, saved[r.id] ?? r.initial ?? 0])
  );
  const next: RunState = {
    ...cloneRun(run),
    time: finiteOr(run.time, 0),
    taps: finiteOr(run.taps, 0),
    rng: Number.isInteger(run.rng) ? run.rng : DEFAULT_SEED,
    resources: { ...saved, ...resources },
    owned: finiteEntries(run.owned, 0),
    mods: finiteEntries(run.mods),
  };
  if (!(next.mods.costMult === undefined || next.mods.costMult > 0))
    delete next.mods.costMult;
  clampToMaxLevels(def, next);
  settle(def, next);
  return next;
}

/**
 * A save from before an upgrade's cap was lowered may own more levels than
 * now exist. Clamp them, and when the run is still in that upgrade's phase
 * give back what the extra levels cost (at today's prices, in its currency),
 * so nobody loses what they paid for. Out of its phase the currency no
 * longer matters, so the levels are only clamped.
 */
function clampToMaxLevels(def: UniverseDef, run: RunState): void {
  for (const upgrade of def.upgrades) {
    const max = upgrade.maxLevel ?? 1;
    const owned = run.owned[upgrade.id] ?? 0;
    if (!Number.isFinite(max) || owned <= max) continue;
    if (isInPhase(def, run, upgrade)) {
      let refund = 0;
      for (let level = max; level < Math.floor(owned); level += 1)
        refund += upgradeCost(
          { ...run, owned: { [upgrade.id]: level } },
          upgrade
        );
      const before = run.resources[upgrade.currency] ?? 0;
      if (Number.isFinite(refund) && refund > 0)
        run.resources[upgrade.currency] = before + refund;
    }
    run.owned[upgrade.id] = max;
  }
}
