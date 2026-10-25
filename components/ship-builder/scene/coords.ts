import { DECK_Y, LEVEL_HEIGHT } from "@/lib/ship-builder/model/worldFrame";
import { rotatedFootprint } from "@/lib/ship-builder/model/grid";
import type {
  GridAnchor,
  GridPartDef,
  Rotation,
  Vec3,
} from "@/lib/ship-builder/model/types";

export { DECK_Y, LEVEL_HEIGHT } from "@/lib/ship-builder/model/worldFrame";

export const HULL_DRAFT = 1.6;
/** Red antifouling shows this far above the waterline. */
export const BOOT_TOP = 0.25;

export type WorldPosition = [number, number, number];

/**
 * Model → world: a 180° turn about Y so the bow faces +X, centred on the
 * hull's length and beam (both in cells).
 */
export function modelToWorld(
  lengthCells: number,
  beam: number,
  p: Vec3
): WorldPosition {
  return [lengthCells / 2 - p.x, DECK_Y + p.y * LEVEL_HEIGHT, beam / 2 - p.z];
}

export function footprintBase(
  def: GridPartDef,
  anchor: GridAnchor,
  rotation: Rotation
): { center: Vec3; size: { x: number; z: number } } {
  const size = rotatedFootprint(def.footprint, rotation);
  return {
    center: {
      x: anchor.x + size.x / 2,
      y: anchor.level,
      z: anchor.z + size.z / 2,
    },
    size,
  };
}
