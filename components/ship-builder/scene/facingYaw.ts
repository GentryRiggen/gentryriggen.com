import type { Rotation } from "@/lib/ship-builder/model/types";

/**
 * Turns a mesh drawn facing local +X to face the model direction its rotation
 * names. Rotation 0 faces model +x (stern), 90 faces +z (port), 180 faces -x
 * (bow) and 270 faces -z (starboard). World X and Z are the model's x and z
 * reversed (see modelToWorld), hence the half turn.
 */
export function facingYaw(rotation: Rotation): number {
  return Math.PI - (rotation * Math.PI) / 180;
}
