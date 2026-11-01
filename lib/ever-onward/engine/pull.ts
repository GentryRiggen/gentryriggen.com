import {
  canAfford,
  isMaxed,
  upgradeCost,
  upgradeNoEffectReason,
  visibleUpgrades,
} from "./engine";
import type { RunState, UniverseDef, UpgradeDef } from "./types";

/** The resource the player is mostly earning and spending in this phase. */
export function primaryResourceId(def: UniverseDef, run: RunState): string {
  return def.phases[run.phase].manualResource;
}

export interface NextUpgrade {
  upgrade: UpgradeDef;
  cost: number;
  /** Whole percent of the cost held, 0 to 100 (100 only once affordable). */
  percent: number;
  isReady: boolean;
}

/** Whole percent of `cost` that `have` covers; never rounds up to 100. */
export function progressPercent(have: number, cost: number): number {
  if (!(cost > 0)) return 100;
  const ratio = have / cost;
  if (!(ratio > 0)) return 0;
  return ratio >= 1 ? 100 : Math.min(99, Math.floor(ratio * 100));
}

function describe(run: RunState, upgrade: UpgradeDef): NextUpgrade {
  const cost = upgradeCost(run, upgrade);
  return {
    upgrade,
    cost,
    percent: progressPercent(run.resources[upgrade.currency] ?? 0, cost),
    isReady: canAfford(run, upgrade),
  };
}

/**
 * The upgrade to dangle in front of the player: the cheapest visible one they
 * can't afford yet (in the phase's main currency when there is one). A
 * `stickyId` that has just become affordable stays the pick, so it can glow
 * until it is bought. Upgrades whose preview would change nothing are never
 * picked. Falls back to the cheapest affordable one.
 */
export function pickNextUpgrade(
  def: UniverseDef,
  run: RunState,
  stickyId?: string
): NextUpgrade | null {
  // Never steer the player to a buy that would change nothing right now.
  const open = visibleUpgrades(def, run).filter(
    (u) => !isMaxed(run, u) && upgradeNoEffectReason(run, u) === null
  );
  if (open.length === 0) return null;
  const primary = primaryResourceId(def, run);
  const inPrimary = open.filter((u) => u.currency === primary);
  const pool = inPrimary.length > 0 ? inPrimary : open;

  const sticky = pool.find((u) => u.id === stickyId);
  if (sticky && canAfford(run, sticky)) return describe(run, sticky);

  const byCost = pool
    .map((u) => describe(run, u))
    .sort((a, b) => a.cost - b.cost);
  return byCost.find((n) => !n.isReady) ?? byCost[0] ?? null;
}
