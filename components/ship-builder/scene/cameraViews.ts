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

export function viewPosition(
  view: CameraView,
  lengthCells: number
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
    case "three-quarter":
      return [distance * 0.65, distance * 0.45, distance * 0.65];
  }
}

/** Angle from straight up, as OrbitControls measures it around the target. */
export function polarAngle(position: CameraPosition): number {
  const [x, y, z] = position.map((value, i) => value - CAMERA_TARGET[i]);
  return Math.atan2(Math.hypot(x, z), y);
}
