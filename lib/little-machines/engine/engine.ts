import type { PhaseDef, RunState, UniverseDef, UpgradeDef } from "./types";

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

/** Reveal what is newly visible, fire due story, advance phases, finish. */
function settle(def: UniverseDef, run: RunState): void {
  // A phase can finish the moment it starts, so loop (bounded by phase count).
  for (let guard = 0; guard <= def.phases.length; guard += 1) {
    revealUpgrades(def, run);
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

function revealUpgrades(def: UniverseDef, run: RunState): void {
  for (const upgrade of def.upgrades) {
    if (!isInPhase(def, run, upgrade) || run.revealed.includes(upgrade.id))
      continue;
    if (!upgrade.visibleWhen || upgrade.visibleWhen(run))
      run.revealed.push(upgrade.id);
  }
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
  return (
    upgrade.baseCost * upgrade.costGrowth ** level * (run.mods.costMult ?? 1)
  );
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
