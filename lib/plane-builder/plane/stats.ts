// lib/plane-builder/plane/stats.ts
import { BOOST_THRUST, G, LIFT_HEADROOM, MAX_SPEED } from "../sim/constants";
import type { PlaneCatalog, Tiers } from "./catalog";

export interface PlaneStats {
  /** Launch speed at full pull, m/s. */
  launchSpeed: number;
  /** Lift coefficient: lift accel = lift × speed² (m/s²). Stall speed = √(g / lift). */
  lift: number;
  /** Engine push, m/s². */
  thrust: number;
  /** Seconds of normal burn. */
  fuel: number;
  /** Drag coefficient: drag decel = drag × speed². */
  drag: number;
  /** Hard hits survived. */
  shields: number;
  /** Payout multiplier. */
  multiplier: number;
}

export function planeStats(catalog: PlaneCatalog, tiers: Tiers): PlaneStats {
  return {
    launchSpeed: catalog.launcher.values[tiers.launcher],
    lift: catalog.wings.values[tiers.wings],
    thrust: catalog.engine.values[tiers.engine],
    fuel: catalog.fuel.values[tiers.fuel],
    drag: catalog.body.values[tiers.body],
    shields: Math.ceil(tiers.body / 2),
    multiplier: catalog.multiplier.values[tiers.multiplier],
  };
}

/** Below this speed the wings can't hold the plane up, m/s. */
export function stallSpeed(stats: PlaneStats): number {
  return Math.sqrt(G / (stats.lift * LIFT_HEADROOM));
}

/** Fastest the plane gets: its launch, or flat out on boost, m/s. */
export function topSpeed(stats: PlaneStats): number {
  const boosted =
    stats.thrust > 0
      ? Math.sqrt((stats.thrust * BOOST_THRUST) / stats.drag)
      : 0;
  return Math.min(MAX_SPEED, Math.max(stats.launchSpeed, boosted));
}
