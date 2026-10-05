import type { Density } from "./field";
import type { ObstacleKind } from "./types";

export type DriveView = "chase" | "top" | "bridge";

export interface DriveConfig {
  seed: number;
  kinds: ObstacleKind[];
  density: Density;
}

/** What the picker remembers between visits; the seed is new for every sail. */
export interface DrivePrefs {
  kinds: ObstacleKind[];
  density: Density;
}

export const OBSTACLE_KINDS: readonly ObstacleKind[] = [
  "iceberg",
  "rock",
  "buoy",
  "ship",
];
export const DENSITIES: readonly Density[] = ["few", "some", "many"];

export const DEFAULT_DRIVE_PREFS: DrivePrefs = {
  kinds: ["iceberg", "rock", "buoy"],
  density: "some",
};

const STORAGE_KEY = "ship-builder:ui:drive";

function isDensity(value: unknown): value is Density {
  return DENSITIES.includes(value as Density);
}

/** The remembered picker choices; the defaults when storage is missing, blocked or garbled. */
export function loadDrivePrefs(): DrivePrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_DRIVE_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_DRIVE_PREFS;
    }
    const { kinds, density } = parsed as Record<string, unknown>;
    return {
      kinds: Array.isArray(kinds)
        ? OBSTACLE_KINDS.filter((k) => kinds.includes(k))
        : DEFAULT_DRIVE_PREFS.kinds,
      density: isDensity(density) ? density : DEFAULT_DRIVE_PREFS.density,
    };
  } catch {
    return DEFAULT_DRIVE_PREFS;
  }
}

/** Remembers the picker choices; silently skipped when storage throws. */
export function saveDrivePrefs(prefs: DrivePrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked or full: the choices just won't be remembered.
  }
}
