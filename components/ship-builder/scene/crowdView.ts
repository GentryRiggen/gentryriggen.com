import type { PersonPose } from "@/lib/ship-builder/crowd/types";
import type { WalkGrid } from "@/lib/ship-builder/walk";
import { DECK_Y, LEVEL_HEIGHT } from "./coords";

export interface PersonTransform {
  x: number;
  y: number;
  z: number;
  /** Rotation about world Y for a figure drawn facing local +X. */
  rotationY: number;
}

/**
 * Where a person stands in the ship's world frame (inside the bob group).
 * x and z follow `modelToWorld`; y is the floor height, which sits a little
 * under the whole level on bridge and container roofs. Yaw is the walker's
 * heading, facing `(cos yaw, sin yaw)` in (worldX, worldZ); three.js turns
 * local +X to `(cos r, -sin r)`, so the rotation is `-yaw`.
 */
export function personWorldTransform(
  pose: PersonPose,
  grid: WalkGrid,
  length: number,
  beam: number
): PersonTransform {
  const height = grid.surfaceHeight(
    Math.floor(pose.x),
    Math.floor(pose.z),
    pose.level
  );
  return {
    x: length / 2 - pose.x,
    y: DECK_Y + height * LEVEL_HEIGHT,
    z: beam / 2 - pose.z,
    rotationY: -pose.yaw,
  };
}
