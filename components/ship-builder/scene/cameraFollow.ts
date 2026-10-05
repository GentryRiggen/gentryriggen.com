import { FLOOR_DEPTH } from "@/lib/ship-builder/sim/descent";
import { PLUNGE_DEPTH } from "@/lib/ship-builder/sim/flooding";
import type { HalfPose } from "@/lib/ship-builder/sim/types";
import { CAMERA_TARGET, type CameraPosition } from "./cameraViews";
import type { TrialPlayback } from "./trialPlayback";

/** Below this much sink the ship is not "sinking" yet; the camera stays put. */
const FOLLOW_MIN_SINK = 0.5;
/** Within this many units of the floor the camera takes the wreck framing. */
const WRECK_MARGIN = 6;

export interface CameraFollow {
  /** Where the orbit target should be. */
  target: CameraPosition;
  /** Prefer looking at her from the side (slow-mo sinking). */
  isSideOn: boolean;
  /** Frame the wreck low, near the floor. */
  isLow: boolean;
}

/**
 * The world position of the middle of a half, using the contract's half
 * transform: `spanFrom`/`spanTo` are the half's ends in world X (unrotated).
 */
function halfCentre(
  half: HalfPose,
  lengthCells: number,
  spanFrom: number,
  spanTo: number
): CameraPosition {
  const pivot = lengthCells / 2 - half.pivotX;
  const middle = (spanFrom + spanTo) / 2 - pivot;
  return [
    half.driftX + pivot + middle * Math.cos(half.pitch),
    -half.sink + middle * Math.sin(half.pitch),
    0,
  ];
}

/**
 * Where the camera should look while the ship goes down, or null when it
 * should leave the orbit target alone (idle, sailing, barely sunk).
 */
export function cameraFollow(
  playback: Pick<
    TrialPlayback,
    "phase" | "sink" | "halves" | "breakup" | "speed"
  >,
  lengthCells: number
): CameraFollow | null {
  const { halves, breakup, phase, sink } = playback;
  const isGoingDown = phase === "sinking" || phase === "descending";
  const isLanded = phase === "done" && (halves !== null || sink > 0);
  if (!isGoingDown && !isLanded) return null;

  let x = 0;
  let y = -sink;
  let deepest = sink;
  let isLow = sink >= FLOOR_DEPTH - WRECK_MARGIN;
  if (halves && breakup) {
    // The bow half spans the bow tip to the break, the stern half the rest.
    const half = lengthCells / 2;
    const breakX = half - breakup.atX;
    const bow = halfCentre(halves.bow, lengthCells, breakX, half);
    const stern = halfCentre(halves.stern, lengthCells, -half, breakX);
    deepest = Math.max(halves.bow.sink, halves.stern.sink);
    isLow = deepest >= FLOOR_DEPTH - WRECK_MARGIN;
    if (phase === "descending" || isLow) {
      // On the way down and on the floor: frame both halves.
      x = (bow[0] + stern[0]) / 2;
      y = (bow[1] + stern[1]) / 2;
    } else {
      // At the surface the drama is whichever half is still up (the stern
      // rearing), and the camera stays near the surface as she slips under.
      const upper = bow[1] > stern[1] ? bow : stern;
      x = upper[0];
      y = Math.max(-PLUNGE_DEPTH, upper[1]);
    }
  } else if (sink < FOLLOW_MIN_SINK) {
    return null;
  }

  return {
    target: [x, y + CAMERA_TARGET[1], 0],
    isSideOn: playback.speed < 1,
    isLow,
  };
}
