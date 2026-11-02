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
  const cost = upgradeCost(run, next);
  return {
    label,
    current,
    target: ids.length,
    unit: "milestones",
    next: visible
      ? `${next.name}: ${formatNumber(Math.ceil(cost))} ${next.currency}`
      : "Grow your helpers to unlock the next milestone",
    progress:
      visible && cost > 0
        ? goalAmount(run.resources[next.currency], cost) / cost
        : 0,
  };
}

/** Continuous progress, displayed in whole percentages with a partial next point. */
export function percentGoal(
  label: string,
  fraction: number,
  next: string
): GoalView {
  const amount = goalAmount(fraction * 100, 100);
  const current = Math.floor(amount);
  return {
    label,
    current,
    target: 100,
    unit: "%",
    next,
    progress: amount - current,
  };
}
