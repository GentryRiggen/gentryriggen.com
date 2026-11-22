import { SHIPWRECK_MAX_OPENED } from "@/lib/analytics/gameEvents";
import { trackGame } from "@/lib/analytics/trackGame";
import type { ShipId } from "./ships/types";
import type { CameraId, OutcomeId } from "./types";

/**
 * Anonymous stats for the dashboard. Only closed enums and small whole
 * numbers ever leave the device.
 */

export type RunMode = "real" | "whatif";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(n) ? n : lo)));

/**
 * A run began on `ship`; `opened` is how many openings the player made (0 to
 * 25, the most any ship offers).
 */
export function trackStart(mode: RunMode, opened: number, ship: ShipId): void {
  trackGame("shipwreck_start", {
    mode,
    opened: clamp(opened, 0, SHIPWRECK_MAX_OPENED),
    ship,
  });
}

/**
 * A run ended. `minutes` counts from the collision to when she sank, or to
 * when the player left or 6:00 AM came if she floated. Breaking in two is
 * sinking, as far as the stats go.
 */
export function trackEnd(
  mode: RunMode,
  outcome: OutcomeId,
  minutes: number,
  ship: ShipId
): void {
  trackGame("shipwreck_end", {
    mode,
    outcome: outcome === "floated" ? "floated" : "sank",
    minutes: clamp(minutes, 0, 600),
    ship,
  });
}

export function trackCamera(camera: CameraId): void {
  trackGame("shipwreck_camera", { camera });
}
