import type { SailState } from "@/lib/ship-builder/sail";
import { DECK_Y } from "./coords";

export type CameraVec = [number, number, number];

export interface DriveCameraPose {
  position: CameraVec;
  target: CameraVec;
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
