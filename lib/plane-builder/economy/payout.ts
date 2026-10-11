import type { LevelDef } from "../levels/types";
import type { FlightResult } from "../sim/flight";

export interface Payout {
  distancePay: number;
  coinPay: number;
  multiplier: number;
  total: number;
}

export function payout(
  level: LevelDef,
  result: FlightResult,
  multiplier: number
): Payout {
  const distancePay = Math.round(result.distance * level.payPerMeter);
  const coinPay = result.coins;
  const total = Math.max(
    level.minPayout,
    Math.round((distancePay + coinPay) * multiplier)
  );
  return { distancePay, coinPay, multiplier, total };
}
