import { upgradeCost } from "../../engine/engine";
import { formatNumber } from "../../engine/format";
import type { GoalView, RunState } from "../../engine/types";
import { COAST_LIGHTHOUSES } from "./resources";
import { lighthouseCount } from "./tick";
import { UPGRADES } from "./upgrades";

const LIGHTHOUSE = UPGRADES.find((u) => u.id === "lighthouse");

/**
 * The big meter on the HUD. The Coast's goal is the lighthouses; the other
 * parts have none yet.
 */
export function lightGoal(run: RunState): GoalView | null {
  if (run.complete || run.phase !== 0 || !LIGHTHOUSE) return null;
  const current = Math.min(COAST_LIGHTHOUSES, lighthouseCount(run));
  if (current >= COAST_LIGHTHOUSES) return null;
  const cost = upgradeCost(run, LIGHTHOUSE);
  const coins = run.resources.coins ?? 0;
  return {
    label: "LIGHT THE COAST",
    current,
    target: COAST_LIGHTHOUSES,
    unit: "lighthouses",
    next: `Next lighthouse: ${formatNumber(Math.ceil(cost))} coins`,
    progress: Math.min(1, Math.max(0, coins / cost)),
  };
}
