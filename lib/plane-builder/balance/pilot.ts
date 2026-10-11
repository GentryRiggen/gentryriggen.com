import { payout } from "../economy/payout";
import {
  buyUpgrade,
  newProgress,
  recordFlight,
  type Progress,
} from "../economy/progress";
import { LEVELS } from "../levels";
import type { LevelId } from "../levels/types";
import { TRACK_IDS, tierPrice } from "../plane/catalog";
import { planeStats, type PlaneStats } from "../plane/stats";
import { runFlight, flightResult, type FlightResult } from "../sim/flight";

export const PILOT_AIM = { pitch: 0.35, yaw: 0, power: 1 };

export function pilotFlight(id: LevelId, stats: PlaneStats): FlightResult {
  const level = LEVELS[id];
  const { state } = runFlight(level, stats, PILOT_AIM, (s) => ({
    pitch: s.fuel > 0 ? 0.3 : 0,
    bank: 0,
    boost: s.fuel > stats.fuel * 0.7,
  }));
  return flightResult(state, level);
}

export function cheapestPrice(p: Progress, id: LevelId): number | null {
  const prices = TRACK_IDS.map((t) =>
    tierPrice(LEVELS[id].plane[t], p.levels[id].tiers[t])
  ).filter((x): x is number => x !== null);
  return prices.length ? Math.min(...prices) : null;
}

function shop(p: Progress, id: LevelId): Progress {
  for (;;) {
    const cheapest = cheapestPrice(p, id);
    if (cheapest === null || p.levels[id].coins < cheapest) return p;
    const track = TRACK_IDS.find(
      (t) => tierPrice(LEVELS[id].plane[t], p.levels[id].tiers[t]) === cheapest
    )!;
    const r = buyUpgrade(p, id, track);
    if (!r.ok) return p;
    p = r.progress;
  }
}

export interface FlightLog {
  distance: number;
  earned: number;
  /** Cheapest upgrade price left before this flight's earnings (null = maxed). */
  cheapest: number | null;
}

export function playLevel(id: LevelId, maxFlights = 80): FlightLog[] {
  let p = newProgress();
  p = { ...p, unlocked: ["meadow", "canyon", "mountains"] };
  const log: FlightLog[] = [];
  for (let i = 0; i < maxFlights; i += 1) {
    const stats = planeStats(LEVELS[id].plane, p.levels[id].tiers);
    const result = pilotFlight(id, stats);
    const earned = payout(LEVELS[id], result, stats.multiplier).total;
    log.push({
      distance: result.distance,
      earned,
      cheapest: cheapestPrice(p, id),
    });
    p = recordFlight(p, id, result, earned).progress;
    if (result.finished) break;
    p = shop(p, id);
  }
  return log;
}
