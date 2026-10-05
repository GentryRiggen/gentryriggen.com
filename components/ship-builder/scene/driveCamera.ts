import { gridLength } from "@/lib/ship-builder/model/grid";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import type { Ship } from "@/lib/ship-builder/model/types";
import type { SailState } from "@/lib/ship-builder/sail";
import { DECK_Y, footprintBase, LEVEL_HEIGHT, modelToWorld } from "./coords";

export type CameraVec = [number, number, number];

export interface DriveCameraPose {
  position: CameraVec;
  target: CameraVec;
  /** Which way is up on the screen; the world's up when left out. */
  up?: CameraVec;
}

/** Hull lengths outside this range are treated as these (cells). */
const MIN_LENGTH = 4;
const MAX_LENGTH = 60;
/** Cells per second beyond which the camera is as far back as it goes. */
const SPEED_FOR_FULL_PULLBACK = 5;
/** Camera distance behind the stern, in hull lengths, at rest and at speed. */
const BASE_BACK = 0.9;
const SPEED_BACK = 0.5;
/** Camera height above the deck, in hull lengths. */
const BASE_HEIGHT = 0.4;
const SPEED_HEIGHT = 0.1;
/** The camera looks this far past the bow, in hull lengths, at this height. */
const LOOK_AHEAD = 0.5;
const LOOK_HEIGHT = 1.2;

/** The most she leans into a turn, radians. */
const MAX_BANK = 0.14;

function finiteClamp(
  value: number,
  min: number,
  max: number,
  fallback: number
): number {
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * The chase camera in the ship's own frame (she stays at the origin with her
 * bow toward +X; the sea turns around her). It rides behind and above the bow
 * axis and backs off as she speeds up. Always finite, whatever it is fed.
 */
export function chaseCamera(
  sail: Pick<SailState, "speed">,
  shipLength: number
): DriveCameraPose {
  const length = finiteClamp(shipLength, MIN_LENGTH, MAX_LENGTH, MIN_LENGTH);
  const speedShare = finiteClamp(
    Math.abs(sail.speed) / SPEED_FOR_FULL_PULLBACK,
    0,
    1,
    0
  );
  // Reversing gets no extra pullback: she is slow and the view stays close.
  const pull = sail.speed > 0 ? speedShare : 0;
  const back = length / 2 + length * (BASE_BACK + SPEED_BACK * pull);
  const height = DECK_Y + length * (BASE_HEIGHT + SPEED_HEIGHT * pull);
  return {
    position: [-back, height, 0],
    target: [length / 2 + length * LOOK_AHEAD, LOOK_HEIGHT, 0],
  };
}

/**
 * How far she leans into a turn (positive is toward starboard), from the
 * rudder and how fast she is going. Visual only.
 */
export function bankAngle(sail: Pick<SailState, "rudder" | "speed">): number {
  const speedShare = finiteClamp(
    sail.speed / SPEED_FOR_FULL_PULLBACK,
    -1,
    1,
    0
  );
  const rudder = finiteClamp(sail.rudder, -1, 1, 0);
  return rudder * Math.abs(speedShare) * MAX_BANK;
}

/** Top view: camera height above the water, in hull lengths, and a floor. */
const TOP_BASE_HEIGHT = 1.7;
const TOP_SPEED_HEIGHT = 0.5;
const TOP_MIN_HEIGHT = 16;

/**
 * The top-down camera: straight above the ship, which stays at the origin
 * with her bow toward +X. Up on the screen is +X, so the bow points up the
 * screen (heading-up) and starboard (+Z) is on the right. It lifts a little
 * with speed to show more of what is ahead. Always finite.
 */
export function topCamera(
  sail: Pick<SailState, "speed">,
  shipLength: number
): DriveCameraPose {
  const length = finiteClamp(shipLength, MIN_LENGTH, MAX_LENGTH, MIN_LENGTH);
  const speedShare = finiteClamp(
    Math.abs(sail.speed) / SPEED_FOR_FULL_PULLBACK,
    0,
    1,
    0
  );
  const height = Math.max(
    TOP_MIN_HEIGHT,
    length * (TOP_BASE_HEIGHT + TOP_SPEED_HEIGHT * speedShare)
  );
  // Slightly ahead of the middle so more of the way ahead shows.
  return {
    position: [length * 0.12, height, 0],
    target: [length * 0.12, 0, 0],
    up: [1, 0, 0],
  };
}

/** The eye's height above the bridge floor, in levels: just over the roof. */
const EYE_HEIGHT = 1.3;
/** How far inside the bridge's bow edge the eye sits, in cells. */
const EYE_INSET = 0.15;
/** With no bridge, the eye is this far back from the bow, in hull lengths. */
const FALLBACK_FROM_BOW = 1 / 6;
/** The eye rises over what is ahead by this much, but never past this height. */
const CLEARANCE_MARGIN = 0.4;
const MAX_EYE_HEIGHT = 9;
/** Parts this far to either side of the centreline (cells) can block the view. */
const VIEW_CORRIDOR = 3;
/** How far ahead (cells) the bridge camera looks. */
const BRIDGE_LOOK_AHEAD = 40;

/** Where the helmsman stands: the bridge's own spot, or a default. */
export interface BridgeLayout {
  /** World position of the floor under the eye. */
  floor: CameraVec;
  /** Whether the ship has a bridge part (false means the default spot). */
  hasBridge: boolean;
  /**
   * World height of the tallest deck part ahead of the eye (a stack of
   * containers, say), so the eye can rise above it. Omitted when nothing is.
   */
  clearY?: number;
}

function isFiniteVec(v: CameraVec): boolean {
  return v.every((n) => Number.isFinite(n));
}

/**
 * Finds the bridge spot of a ship: the bow edge of her highest, most forward
 * bridge. Without a bridge it is the top of the superstructure in the forward
 * third of the deck, on the centreline.
 */
export function bridgeLayout(ship: Ship): BridgeLayout {
  const length = gridLength(ship);
  const beam = ship.hull.beam;
  let best: { level: number; x: number; floor: CameraVec } | null = null;
  let forwardTop = 0;
  for (const part of ship.parts) {
    if (part.anchor.kind !== "grid") continue;
    const def = getPartDef(part.type);
    if (def.placement !== "grid") continue;
    const { center, size } = footprintBase(def, part.anchor, part.rotation);
    if (part.anchor.x < length / 3) {
      forwardTop = Math.max(forwardTop, part.anchor.level + def.height);
    }
    if (def.role !== "bridge") continue;
    const [wx, wy, wz] = modelToWorld(length, beam, center);
    // The model x grows toward the stern, so the bow edge is the larger world x.
    const edge = wx + size.x / 2 - EYE_INSET;
    const isBetter =
      !best ||
      part.anchor.level > best.level ||
      (part.anchor.level === best.level && edge > best.x);
    if (isBetter) {
      best = { level: part.anchor.level, x: edge, floor: [edge, wy, wz] };
    }
  }
  const floor: CameraVec = best
    ? best.floor
    : [
        length / 2 - length * FALLBACK_FROM_BOW,
        DECK_Y + forwardTop * LEVEL_HEIGHT,
        0,
      ];
  return {
    floor,
    hasBridge: best !== null,
    clearY: tallestAhead(ship, floor),
  };
}

/** The top of the tallest deck part in the corridor ahead of `floor`, if any. */
function tallestAhead(ship: Ship, floor: CameraVec): number | undefined {
  const length = gridLength(ship);
  const beam = ship.hull.beam;
  let top: number | undefined;
  for (const part of ship.parts) {
    if (part.anchor.kind !== "grid") continue;
    const def = getPartDef(part.type);
    if (def.placement !== "grid" || def.role === "decor") continue;
    const { center, size } = footprintBase(def, part.anchor, part.rotation);
    const [wx, , wz] = modelToWorld(length, beam, center);
    const isAhead = wx - size.x / 2 > floor[0];
    if (!isAhead || Math.abs(wz - floor[2]) > VIEW_CORRIDOR) continue;
    const partTop = DECK_Y + (part.anchor.level + def.height) * LEVEL_HEIGHT;
    top = top === undefined ? partTop : Math.max(top, partTop);
  }
  return top;
}

/**
 * The bridge camera: the eye above the bridge floor, looking along the bow
 * (+X). Falls back to a point near the bow when the layout is not finite.
 */
export function bridgeCamera(layout: BridgeLayout): DriveCameraPose {
  const floor: CameraVec = isFiniteVec(layout.floor)
    ? layout.floor
    : [MIN_LENGTH, DECK_Y, 0];
  const clearY = Number.isFinite(layout.clearY) ? layout.clearY : undefined;
  const eyeY = Math.min(
    floor[1] + MAX_EYE_HEIGHT * LEVEL_HEIGHT,
    Math.max(
      floor[1] + EYE_HEIGHT * LEVEL_HEIGHT,
      clearY === undefined ? 0 : clearY + CLEARANCE_MARGIN
    )
  );
  return {
    position: [floor[0], eyeY, floor[2]],
    target: [floor[0] + BRIDGE_LOOK_AHEAD, eyeY - 1.5, floor[2]],
  };
}
