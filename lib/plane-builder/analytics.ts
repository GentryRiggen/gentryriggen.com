import { crashBucket, tenths } from "@/lib/analytics/gameEvents";
import { trackGame } from "@/lib/analytics/trackGame";
import type { LevelDef } from "./levels/types";
import type { Tiers } from "./plane/catalog";
import type { FlightState } from "./sim/flight";

/** How the flight ended, in the words the dashboard shows. */
export function outcomeOf(
  s: Pick<FlightState, "finished" | "endReason">
): "finish" | "crash" | "landed" | "stalled" | "timeout" | "out_of_fuel" {
  if (s.finished) return "finish";
  switch (s.endReason) {
    case "crash":
      return "crash";
    case "landed":
      return "landed";
    case "stalled":
      return "stalled";
    case "runout":
      return "out_of_fuel";
    default:
      return "timeout";
  }
}

export function sumTiers(tiers: Tiers): number {
  return Object.values(tiers).reduce((sum, tier) => sum + tier, 0);
}

/** Records a finished flight (anonymous; see lib/analytics/gameEvents.ts). */
export function trackFlightEnd(
  s: FlightState,
  level: LevelDef,
  tiers: Tiers,
  isDaily: boolean
): void {
  const outcome = outcomeOf(s);
  const crashed = outcome === "crash";
  trackGame("flight_end", {
    world: level.id,
    outcome,
    dist: tenths(s.maxX, level.finishDistance),
    crashX: crashed ? crashBucket(s.x) : -1,
    obstacle: crashed ? (s.crashKind ?? "none") : "none",
    tiers: Math.min(48, sumTiers(tiers)),
    daily: isDaily ? 1 : 0,
  });
}

/** Records a flight the player left before it ended. */
export function trackFlightQuit(s: FlightState, level: LevelDef): void {
  trackGame("quit_mid_flight", {
    world: level.id,
    dist: tenths(s.maxX, level.finishDistance),
  });
}
