// lib/plane-builder/plane/stats.ts
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
