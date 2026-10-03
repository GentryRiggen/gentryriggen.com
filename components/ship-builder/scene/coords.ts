import { GRID_WIDTH, rotatedFootprint } from "@/lib/ship-builder/model/grid";
import type {
  GridAnchor,
  GridPartDef,
  Rotation,
  Vec3,
} from "@/lib/ship-builder/model/types";

/** Main deck height above the waterline (world y = 0). */
export const DECK_Y = 1.2;
export const HULL_DRAFT = 1.6;
/** Red antifouling shows this far above the waterline. */
export const BOOT_TOP = 0.25;
export const LEVEL_HEIGHT = 1;

export type WorldPosition = [number, number, number];

/** Model → world: a 180° turn about Y so the bow faces +X. */
export function modelToWorld(lengthCells: number, p: Vec3): WorldPosition {
  return [
    lengthCells / 2 - p.x,
    DECK_Y + p.y * LEVEL_HEIGHT,
    GRID_WIDTH / 2 - p.z,
  ];
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
