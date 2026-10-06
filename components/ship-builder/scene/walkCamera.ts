import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import type { Ship } from "@/lib/ship-builder/model/types";
import type { WalkState } from "@/lib/ship-builder/walk";
import { DECK_Y, LEVEL_HEIGHT, modelToWorld } from "./coords";

/** Eye height above the floor, in cells. */
export const EYE_HEIGHT = 0.45;
/** How far ahead of the eye the look target sits, in cells. */
export const LOOK_DISTANCE = 1;

export interface WalkCameraPose {
  /** Eye position in the ship's (bob group) frame. */
  eye: [number, number, number];
  /** Where the eye looks, level with it, along the heading. */
  target: [number, number, number];
}

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

/**
 * The first-person view of a walker, in the ship's frame (inside her bob
 * group), placed with the same model-to-world conversion as the parts so a
 * part beside the walker is drawn beside the eye. Finite for any input.
 */
export function walkCamera(state: WalkState, ship: Ship): WalkCameraPose {
  const length = gridLength(ship);
  const beam = beamOf(ship);
  const x = finiteOr(state.x, length / 2);
  const z = finiteOr(state.z, beam / 2);
  const yaw = finiteOr(state.yaw, 0);
  const level = finiteOr(state.level, 0);

  const [eyeX, , eyeZ] = modelToWorld(length, beam, { x, y: 0, z });
  const eyeY = DECK_Y + level * LEVEL_HEIGHT + EYE_HEIGHT;
  return {
    eye: [eyeX, eyeY, eyeZ],
    target: [
      eyeX + Math.cos(yaw) * LOOK_DISTANCE,
      eyeY,
      eyeZ + Math.sin(yaw) * LOOK_DISTANCE,
    ],
  };
}
