import type { CameraView } from "@/lib/ship-builder/state/store";
import { DECK_Y } from "./coords";

export type CameraPosition = [number, number, number];

export const CAMERA_TARGET: CameraPosition = [0, DECK_Y + 1.5, 0];

/** Keeps the orbit camera a little above the horizon (≈85.4°). */
export const MAX_POLAR_ANGLE = Math.PI / 2 - 0.08;

/**
 * The side preset's polar angle (≈83.1°). It must sit inside MAX_POLAR_ANGLE,
 * or OrbitControls clamps it and the preset lands somewhere else.
 */
const SIDE_POLAR_ANGLE = Math.PI / 2 - 0.12;

export function viewDistance(lengthCells: number): number {
  return lengthCells * 0.9 + 12;
}

/** OrbitControls' maxDistance; presets never place the camera beyond it. */
export const MAX_VIEW_DISTANCE = 120;

const THREE_QUARTER_OFFSET = [0.65, 0.45, 0.65] as const;

/**
 * Three-quarter distance. The ship's length runs across the screen, so a
 * narrow canvas (aspect < 1) needs proportionally more room to keep the prow
 * in frame.
 */
function threeQuarterDistance(lengthCells: number, aspect: number): number {
  const wanted = (lengthCells * 1.1 + 12) / Math.min(1, aspect);
  return Math.min(
    wanted,
    MAX_VIEW_DISTANCE / Math.hypot(...THREE_QUARTER_OFFSET)
  );
}

export function viewPosition(
  view: CameraView,
  lengthCells: number,
  aspect = 1
): CameraPosition {
  const distance = viewDistance(lengthCells);
  const [, targetY] = CAMERA_TARGET;
  switch (view) {
    case "side":
      return [
        0,
        targetY + distance * Math.cos(SIDE_POLAR_ANGLE),
        distance * Math.sin(SIDE_POLAR_ANGLE),
      ];
    case "top":
      return [0, distance * 1.2, 0.01];
    case "three-quarter": {
      const [dx, dy, dz] = THREE_QUARTER_OFFSET;
      const d = threeQuarterDistance(lengthCells, aspect);
      return [d * dx, d * dy, d * dz];
    }
  }
}

/** Angle from straight up, as OrbitControls measures it around the target. */
export function polarAngle(position: CameraPosition): number {
  const [x, y, z] = position.map((value, i) => value - CAMERA_TARGET[i]);
  return Math.atan2(Math.hypot(x, z), y);
}

/**
 * A hull length that differs from the previous length by more than this (in
 * segments) reframes the camera, e.g. loading a much longer ship. Single −/+
 * clicks stay under it so the camera doesn't jump while the player is editing.
 */
export const REFRAME_SEGMENT_THRESHOLD = 2;

export function shouldReframe(
  previousSegments: number,
  lengthSegments: number
): boolean {
  return (
    Math.abs(lengthSegments - previousSegments) > REFRAME_SEGMENT_THRESHOLD
  );
}

export interface FrameRequest {
  camera: { view: CameraView; nonce: number };
  lengthSegments: number;
}

/**
 * Whether the camera should be placed for `next`, given the previous request
 * (null on the first run). A new preset request always frames; a length change
 * only when it jumped from the previous length.
 */
export function shouldFrame(
  seen: FrameRequest | null,
  next: FrameRequest
): boolean {
  if (!seen || seen.camera !== next.camera) return true;
  return shouldReframe(seen.lengthSegments, next.lengthSegments);
}
