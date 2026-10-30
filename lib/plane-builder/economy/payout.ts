import type { LevelDef } from "../levels/types";
import { COIN_ZONE_MULTIPLIER, type GaugeZone } from "../minigame/gauge";
import { MILESTONES } from "../sim/constants";
import type { FlightResult } from "../sim/flight";

export interface Payout {
  distancePay: number;
  coinPay: number;
  landingBonus: number;
  milestoneBonus: number;
  /** Coins from near-miss combos (already counted in `total`). */
  nearMissPay?: number;
  /** The near-miss share of `total` after the plane multiplier and bonuses. */
  nearMissEarned?: number;
  multiplier: number;
  total: number;
}

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
  return MILESTONES.filter((share) => {
    const at = level.finishDistance * share;
    return previousBest < at && distance >= at;
  }).length;
}

export function payout(
  level: LevelDef,
  result: FlightResult,
  multiplier: number,
  previousBest = 0,
  coinFactor = 1
): Payout {
  const distancePay = Math.round(result.distance * level.payPerMeter);
  const coinPay = result.coins;
  const landingBonus =
    result.endReason === "landed" ? Math.round(distancePay * LANDING_BONUS) : 0;
  const nearMissPay = Math.max(0, result.nearMissCoins ?? 0);
  const milestoneBonus =
    newMilestones(level, previousBest, result.distance) *
    Math.round(level.finishDistance * level.payPerMeter * MILESTONE_SHARE);
  const total = Math.round(
    Math.max(
      level.minPayout,
      Math.round(
        (distancePay + coinPay + nearMissPay + landingBonus + milestoneBonus) *
          multiplier
      )
    ) * coinFactor
  );
  return {
    distancePay,
    coinPay,
    landingBonus,
    milestoneBonus,
    nearMissPay,
    nearMissEarned: Math.min(
      total,
      Math.round(nearMissPay * multiplier * coinFactor)
    ),
    multiplier,
    total,
  };
}

/** Extra coins the after-flight gauge adds on top of a flight's total. */
export function coinBonus(total: number, zone: GaugeZone): number {
  return Math.round(Math.max(0, total) * (COIN_ZONE_MULTIPLIER[zone] - 1));
}
