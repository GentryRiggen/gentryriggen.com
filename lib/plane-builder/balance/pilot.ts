import { coinBonus, payout } from "../economy/payout";
import {
  buyUpgrade,
  newProgress,
  recordFlight,
  type Progress,
} from "../economy/progress";
import { LEVELS, LEVEL_ORDER } from "../levels";
import { terrainHeight } from "../levels/terrain";
import type { LevelDef, LevelId } from "../levels/types";
import { TRACK_IDS, tierPrice } from "../plane/catalog";
import { planeStats, type PlaneStats } from "../plane/stats";
import {
  runFlight,
  flightResult,
  type FlightResult,
  type FlightState,
  type StickInput,
} from "../sim/flight";

export const PILOT_AIM = { pitch: 0.35, yaw: 0, power: 1 };

export interface PilotResult extends FlightResult {
  /** Sim seconds the flight lasted. */
  time: number;
}

/** Height above the ground the pilot cruises at while the engine runs, m. */
const CRUISE_HEIGHT = 30;

/** How far ahead the pilot looks for hard obstacles, m. */
const LOOKAHEAD = 300;
/** Extra room the pilot keeps beside an obstacle, m. */
const AVOID_MARGIN = 8;

/** Sideways position the pilot aims for: the middle, nudged round obstacles. */
function aimZ(level: LevelDef, s: FlightState): number {
  const limit = level.corridorHalfWidth - 4;
  let target = 0;
  for (const o of level.obstacles) {
    const ahead = o.center.x - s.x;
    if (!o.hard || ahead < -o.half.x || ahead > LOOKAHEAD) continue;
    const room = o.half.z + AVOID_MARGIN;
    if (Math.abs(target - o.center.z) >= room) continue;
    const left = o.center.z - room;
    const right = o.center.z + room;
    const options = [left, right].filter((z) => Math.abs(z) <= limit);
    if (options.length === 0) continue;
    target = options.reduce((best, z) =>
      Math.abs(z - s.z) < Math.abs(best - s.z) ? z : best
    );
  }
  return target;
}

/** Bank that turns toward the aim point without wobbling. */
function steer(level: LevelDef, s: FlightState): number {
  const bank = (aimZ(level, s) - s.z) / 25 - s.heading * 2.5;
  return Math.max(-1, Math.min(1, bank));
}

/**
 * The average pilot: climbs to a steady cruise height, holds it while there is
 * fuel (boosting for the first part of the tank), steers around obstacles it
 * can see, then glides hands-off.
 */
export function pilotSticks(level: LevelDef, stats: PlaneStats) {
  return (s: FlightState): StickInput => {
    const ground = terrainHeight(level.terrain, s.x, s.z);
    const climb = (CRUISE_HEIGHT - (s.y - ground)) / 40;
    return {
      pitch: s.fuel > 0 ? Math.max(-0.3, Math.min(0.3, climb)) : 0,
      bank: steer(level, s),
      boost: s.fuel > stats.fuel * 0.7,
    };
  };
}

export function pilotFlight(id: LevelId, stats: PlaneStats): PilotResult {
  const level = LEVELS[id];
  const { state } = runFlight(
    level,
    stats,
    PILOT_AIM,
    pilotSticks(level, stats)
  );
  return { ...flightResult(state, level), time: state.time };
}

/**
 * A kid who flies through every fuel can they can reach: the plane is pulled
 * onto every can's height and lane, so the sim picks each one up (the tank cap
 * still applies). Works on a copy so the shared level is never touched.
 */
export function canGrabberFlight(id: LevelId, stats: PlaneStats): PilotResult {
  const level: LevelDef = {
    ...LEVELS[id],
    fuelCans: LEVELS[id].fuelCans.map((c) => ({ ...c })),
  };
  const sticks = pilotSticks(level, stats);
  const { state } = runFlight(level, stats, PILOT_AIM, (s) => {
    for (const can of level.fuelCans) {
      can.y = s.y;
      can.z = s.z;
    }
    return sticks(s);
  });
  return { ...flightResult(state, level), time: state.time };
}

export function cheapestPrice(p: Progress, id: LevelId): number | null {
  const prices = TRACK_IDS.map((t) =>
    tierPrice(LEVELS[id].plane[t], p.levels[id].tiers[t])
  ).filter((x): x is number => x !== null);
  return prices.length ? Math.min(...prices) : null;
}

/** How the pilot spends coins: cheapest upgrade first, or engine and fuel first. */
export type ShopStrategy = "cheapest" | "engine-fuel-first";

/** The lower-tier of engine and fuel that can still be upgraded, if any. */
function nextEngineOrFuel(p: Progress, id: LevelId): "engine" | "fuel" | null {
  const open = (["engine", "fuel"] as const).filter(
    (t) => tierPrice(LEVELS[id].plane[t], p.levels[id].tiers[t]) !== null
  );
  if (open.length === 0) return null;
  return open.reduce((a, b) =>
    p.levels[id].tiers[b] < p.levels[id].tiers[a] ? b : a
  );
}

function shop(p: Progress, id: LevelId, strategy: ShopStrategy): Progress {
  for (;;) {
    const priority =
      strategy === "engine-fuel-first" ? nextEngineOrFuel(p, id) : null;
    if (priority) {
      const r = buyUpgrade(p, id, priority);
      if (!r.ok) return p;
      p = r.progress;
      continue;
    }
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
  endReason: FlightResult["endReason"];
  /** Sim seconds the flight lasted. */
  time: number;
  /** Cheapest upgrade price left before this flight's earnings (null = maxed). */
  cheapest: number | null;
  /** True when, after this flight, the coins in hand still buy nothing. */
  isDry: boolean;
}

export interface PlayOptions {
  maxFlights?: number;
  /** Which pilot flies: the can-grabber (default) or one that ignores cans. */
  flight?: (id: LevelId, stats: PlaneStats) => PilotResult;
  shop?: ShopStrategy;
}

export function playLevel(
  id: LevelId,
  {
    maxFlights = 80,
    flight = canGrabberFlight,
    shop: strategy = "cheapest",
  }: PlayOptions = {}
): FlightLog[] {
  let p = newProgress();
  p = { ...p, unlocked: [...LEVEL_ORDER] };
  const log: FlightLog[] = [];
  for (let i = 0; i < maxFlights; i += 1) {
    const stats = planeStats(LEVELS[id].plane, p.levels[id].tiers);
    const result = flight(id, stats);
    const total = payout(
      LEVELS[id],
      result,
      stats.multiplier,
      p.levels[id].best
    ).total;
    // The average pilot stops the coin gauge in the yellow.
    const earned = total + coinBonus(total, "yellow");
    log.push({
      distance: result.distance,
      earned,
      endReason: result.endReason,
      time: result.time,
      cheapest: cheapestPrice(p, id),
      isDry: false,
    });
    p = recordFlight(p, id, result, earned).progress;
    const cheapest = cheapestPrice(p, id);
    log[log.length - 1].isDry =
      cheapest !== null && p.levels[id].coins < cheapest;
    if (result.finished) break;
    p = shop(p, id, strategy);
  }
  return log;
}
