import type { ObstacleKind } from "@/lib/ship-builder/sail";

/** A marker is never smaller than this share of the camera's height. */
const MIN_MARKER_SHARE = 0.03;
/** The ring sits this far outside the obstacle's own edge. */
const MARKER_MARGIN = 1.25;

/**
 * Ring colours for the top view. Buoys are friendly; everything you can hit
 * is a warning. Bright enough on the dark sea, and saturated enough to stand
 * out on a pale iceberg, in either theme (the sea looks the same in both).
 */
const MARKER_COLORS: Record<ObstacleKind, string> = {
  buoy: "#34d399",
  iceberg: "#ff4d4d",
  rock: "#ff4d4d",
  ship: "#ffb020",
};

export function markerColor(kind: ObstacleKind): string {
  return MARKER_COLORS[kind];
}

/**
 * The radius of an obstacle's ring seen from `cameraHeight`: just outside the
 * obstacle, but never so small that it vanishes from a high camera. Always
 * finite and positive.
 */
export function markerRadius(radius: number, cameraHeight: number): number {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const safeHeight =
    Number.isFinite(cameraHeight) && cameraHeight > 0 ? cameraHeight : 0;
  return Math.max(safeRadius * MARKER_MARGIN, safeHeight * MIN_MARKER_SHARE);
}
