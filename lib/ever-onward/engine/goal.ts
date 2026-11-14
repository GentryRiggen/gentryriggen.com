import { upgradeCost } from "./engine";
import { formatNumber } from "./format";
import type { GoalView, RunState, UpgradeDef } from "./types";

/** Values from older saves must never turn a progress bar into NaN. */
export function goalAmount(
  value: number | undefined,
  target: number,
  fallback = 0
): number {
  return Math.min(
    target,
    Math.max(0, Number.isFinite(value) ? value! : fallback)
  );
}

/** What an upgrade waits for before it pops in: owning some of another. */
export interface OwnedNeed {
  upgradeId: string;
  count: number;
}

/** A `visibleWhen` that says what it waits for, so the goal can name it. */
export type OwnedGate = ((run: RunState) => boolean) & { needs: OwnedNeed };

/** Pops in once `count` of `upgradeId` are owned. */
export function ownsAtLeast(upgradeId: string, count = 1): OwnedGate {
  const gate = (run: RunState): boolean => (run.owned[upgradeId] ?? 0) >= count;
  return Object.assign(gate, { needs: { upgradeId, count } });
}

const withoutArticle = (name: string): string =>
  name.replace(/^(a|an|the) /i, "");

/**
 * The next milestone while it is still hidden: what it is and what brings it
 * ("A green tractor: at 3 friendly scarecrow (2/3)"), so the goal line always
 * names a real next step.
 */
function hiddenMilestone(
  run: RunState,
  upgrades: readonly UpgradeDef[],
  next: UpgradeDef
): { text: string; progress: number } {
  const needs = (next.visibleWhen as Partial<OwnedGate> | undefined)?.needs;
  const before = needs && upgrades.find((u) => u.id === needs.upgradeId);
  if (!needs || !before)
    return {
      text: `Next: ${next.name}. Keep buying helpers to find it`,
      progress: 0,
    };
  const have = Math.min(needs.count, run.owned[needs.upgradeId] ?? 0);
  return {
    text: `${next.name}: unlocks at ${needs.count} × ${withoutArticle(before.name)} (${have}/${needs.count})`,
    progress: needs.count > 0 ? have / needs.count : 0,
  };
}

/** A chapter's permanent milestones, separate from its spendable wallet. */
export function milestoneGoal(
  run: RunState,
  upgrades: readonly UpgradeDef[],
  label: string,
  ids: readonly string[]
): GoalView {
  const current = ids.filter((id) => (run.owned[id] ?? 0) > 0).length;
  const nextId = ids.find((id) => !(run.owned[id] > 0));
  const next = upgrades.find((u) => u.id === nextId);
  if (!next)
    return {
      label,
      current,
      target: ids.length,
      unit: "milestones",
      next: "Ready for the next chapter",
    };
  const visible = !next.visibleWhen || next.visibleWhen(run);
  if (!visible) {
    const hidden = hiddenMilestone(run, upgrades, next);
    return {
      label,
      current,
      target: ids.length,
      unit: "milestones",
      next: hidden.text,
      progress: hidden.progress,
    };
  }
  const cost = upgradeCost(run, next);
  return {
    label,
    current,
    target: ids.length,
    unit: "milestones",
    next: `${next.name}: ${formatNumber(Math.ceil(cost))} ${next.currency}`,
    progress:
      cost > 0 ? goalAmount(run.resources[next.currency], cost) / cost : 0,
  };
}

/** Continuous progress, displayed in whole percentages with a partial next point. */
export function percentGoal(
  label: string,
  fraction: number,
  next: string
): GoalView {
  const amount = goalAmount(fraction * 100, 100);
  // Under 10% the count shows tenths, so the first minutes visibly move.
  const current =
    amount < 10 ? Math.floor(amount * 10) / 10 : Math.floor(amount);
  return {
    label,
    current,
    target: 100,
    unit: "%",
    next,
    progress: Math.max(0, amount - current),
  };
}
