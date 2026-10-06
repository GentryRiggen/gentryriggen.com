import { beamOf, facingCell, gridLength } from "@/lib/ship-builder/model/grid";
import type { PlacedPart, Ship } from "@/lib/ship-builder/model/types";
import type { WalkState } from "@/lib/ship-builder/walk";
import { DECK_Y, LEVEL_HEIGHT, modelToWorld } from "./coords";

/** Eye height above the floor, in cells. */
export const EYE_HEIGHT = 0.45;
/** How far ahead of the eye the look target sits, in cells. */
export const LOOK_DISTANCE = 1;

/**
 * The flight's own length across its cell (see `Stairs` in deckDecor.tsx):
 * the steps start this far in from the back edge and the top step ends this
 * far short of the faced edge.
 */
const STAIRS_MARGIN = 0.05;

const stairsByShip = new WeakMap<Ship, PlacedPart[]>();

function stairsOf(ship: Ship): PlacedPart[] {
  let stairs = stairsByShip.get(ship);
  if (!stairs) {
    stairs = ship.parts.filter(
      (part) => part.type === "stairs" && part.anchor.kind === "grid"
    );
    stairsByShip.set(ship, stairs);
  }
  return stairs;
}

/**
 * The height of the floor under the walker in levels: whole levels on a deck,
 * and a smooth climb from level L to L + 1 while crossing a flight of stairs
 * (the walker's level only changes at the top, so without this the eye would
 * sit inside the steps all the way up).
 */
export function floorHeight(state: WalkState, ship: Ship): number {
  const cellX = Math.floor(state.x);
  const cellZ = Math.floor(state.z);
  for (const part of stairsOf(ship)) {
    const { anchor } = part;
    if (anchor.kind !== "grid") continue;
    if (anchor.x !== cellX || anchor.z !== cellZ) continue;
    if (anchor.level !== state.level) continue;
    const faced = facingCell(anchor, part.rotation);
    const dx = faced.x - anchor.x;
    const dz = faced.z - anchor.z;
    const progress =
      dx !== 0
        ? dx > 0
          ? state.x - cellX
          : cellX + 1 - state.x
        : dz > 0
          ? state.z - cellZ
          : cellZ + 1 - state.z;
    const climbed = (progress - STAIRS_MARGIN) / (1 - 2 * STAIRS_MARGIN);
    return state.level + Math.min(1, Math.max(0, climbed));
  }
  return state.level;
}

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
  const floor = floorHeight({ ...state, x, z, level }, ship);
  const eyeY = DECK_Y + floor * LEVEL_HEIGHT + EYE_HEIGHT;
  return {
    eye: [eyeX, eyeY, eyeZ],
    target: [
      eyeX + Math.cos(yaw) * LOOK_DISTANCE,
      eyeY,
      eyeZ + Math.sin(yaw) * LOOK_DISTANCE,
    ],
  };
}
