import { trackGame } from "@/lib/analytics/trackGame";
import type { CameraId } from "./types";

/**
 * Anonymous stats for the dashboard. Only closed enums and small whole
 * numbers ever leave the device.
 */

export type RunMode = "real" | "whatif";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(n) ? n : lo)));

/** A run began; `opened` is how many openings the player made (0 to 16). */
export function trackStart(mode: RunMode, opened: number): void {
  trackGame("shipwreck_start", { mode, opened: clamp(opened, 0, 16) });
}

/**
 * A run ended. `minutes` counts from the collision to when she sank, or to
 * when the player left or 6:00 AM came if she floated.
 */
export function trackEnd(
  mode: RunMode,
  outcome: "sank" | "floated",
  minutes: number
): void {
  trackGame("shipwreck_end", {
    mode,
    outcome,
    minutes: clamp(minutes, 0, 600),
  });
}

export function trackCamera(camera: CameraId): void {
  trackGame("shipwreck_camera", { camera });
}
