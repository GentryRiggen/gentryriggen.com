import type { LevelDef } from "../levels/types";
import type { FlightResult } from "../sim/flight";

export interface Payout {
  distancePay: number;
  coinPay: number;
  landingBonus: number;
  milestoneBonus: number;
  multiplier: number;
  total: number;
}

/** Where the milestone flags stand, as shares of the level's finish distance. */
const MILESTONE_SHARES = [0.25, 0.5, 0.75] as const;
/** Each milestone flag pays this share of the whole level's distance pay, once. */
export const MILESTONE_SHARE = 0.1;
/** A landing pays this share of the distance pay on top. */
export const LANDING_BONUS = 0.25;

/** How many milestones this flight passed that no earlier flight had. */
export function newMilestones(
  level: LevelDef,
  previousBest: number,
  distance: number
): number {
  return MILESTONE_SHARES.filter((share) => {
    const at = level.finishDistance * share;
    return previousBest < at && distance >= at;
  }).length;
}

export function payout(
  level: LevelDef,
  result: FlightResult,
  multiplier: number,
  previousBest = 0
): Payout {
  const distancePay = Math.round(result.distance * level.payPerMeter);
  const coinPay = result.coins;
  const landingBonus =
    result.endReason === "landed" ? Math.round(distancePay * LANDING_BONUS) : 0;
  const milestoneBonus =
    newMilestones(level, previousBest, result.distance) *
    Math.round(level.finishDistance * level.payPerMeter * MILESTONE_SHARE);
  const total = Math.max(
    level.minPayout,
    Math.round(
      (distancePay + coinPay + landingBonus + milestoneBonus) * multiplier
    )
  );
  return {
    distancePay,
    coinPay,
    landingBonus,
    milestoneBonus,
    multiplier,
    total,
  };
}
