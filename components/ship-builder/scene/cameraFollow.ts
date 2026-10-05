import { FLOOR_DEPTH } from "@/lib/ship-builder/sim/descent";
import { PLUNGE_DEPTH } from "@/lib/ship-builder/sim/flooding";
import type { HalfPose } from "@/lib/ship-builder/sim/types";
import { CAMERA_TARGET, type CameraPosition } from "./cameraViews";
import type { TrialPlayback } from "./trialPlayback";

/** Below this much sink the ship is not "sinking" yet; the camera stays put. */
const FOLLOW_MIN_SINK = 0.5;
/** Within this many units of the floor the camera takes the wreck framing. */
const WRECK_MARGIN = 6;
/**
 * Room above a half's keel line for its decks, funnels and masts, so a stern
 * standing on end is framed to the top of its superstructure.
 */
const SUPERSTRUCTURE_HEIGHT = 5;
/** How far under the surface a standing half still counts as in view. */
const VISIBLE_DEPTH = 2;
/**
 * Once both halves are under, the camera aims this far below the last one's
 * highest point: just under the surface, where it and its bubbles go down.
 */
const UNDER_AIM_DEPTH = 3;

export interface CameraFollow {
  /** Where the orbit target should be. */
  target: CameraPosition;
  /** Prefer looking at her from the side (slow-mo sinking). */
  isSideOn: boolean;
  /** Frame the wreck low, near the floor. */
  isLow: boolean;
  /**
   * World units of height the view should fit around the target (a stern
   * standing on end), or 0 when any zoom will do.
   */
  height: number;
  /**
   * The target is just under the surface (the last half slipping away), so
   * the camera should dip under too: the sea hides it from above.
   */
  isUnder: boolean;
}

/** A world point on a half's keel line, `along` world x from its pivot. */
function keelPoint(
  half: HalfPose,
  lengthCells: number,
  along: number
): CameraPosition {
  const pivot = lengthCells / 2 - half.pivotX;
  return [
    half.driftX + pivot + along * Math.cos(half.pitch),
    -half.sink + along * Math.sin(half.pitch),
    0,
  ];
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
  return keelPoint(half, lengthCells, (spanFrom + spanTo) / 2 - pivot);
}

/** The higher and lower ends of a half's keel line, in world space. */
function halfEnds(
  half: HalfPose,
  lengthCells: number,
  spanFrom: number,
  spanTo: number
): { top: CameraPosition; bottom: CameraPosition } {
  const pivot = lengthCells / 2 - half.pivotX;
  const a = keelPoint(half, lengthCells, spanFrom - pivot);
  const b = keelPoint(half, lengthCells, spanTo - pivot);
  return a[1] >= b[1] ? { top: a, bottom: b } : { top: b, bottom: a };
}

/**
 * At the surface the drama is whichever half is still up: frame what shows
 * above the water, superstructure included. Once it too is under, aim just
 * below its highest point, where it slips away, rather than down in the dark.
 */
function surfaceFraming(
  ends: { top: CameraPosition; bottom: CameraPosition },
  centre: CameraPosition
): Pick<CameraFollow, "target" | "height" | "isUnder"> {
  const { top, bottom } = ends;
  const high = top[1] + SUPERSTRUCTURE_HEIGHT;
  if (top[1] <= -VISIBLE_DEPTH) {
    return {
      target: [top[0], Math.max(-PLUNGE_DEPTH, top[1] - UNDER_AIM_DEPTH), 0],
      height: 0,
      isUnder: true,
    };
  }
  const low = Math.max(bottom[1], -VISIBLE_DEPTH);
  // Mostly level (settling back), the usual target height above it reads best.
  const isStanding = high - low > SUPERSTRUCTURE_HEIGHT + CAMERA_TARGET[1];
  if (!isStanding) {
    return {
      target: [centre[0], centre[1] + CAMERA_TARGET[1], 0],
      height: 0,
      isUnder: false,
    };
  }
  // Where the keel crosses `low`, so a leaning stern is framed over its body.
  const t = (top[1] - low) / Math.max(1e-6, top[1] - bottom[1]);
  const lowX = top[0] + (bottom[0] - top[0]) * t;
  return {
    target: [(top[0] + lowX) / 2, (high + low) / 2, 0],
    height: high - low,
    isUnder: false,
  };
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
      const bowEnds = halfEnds(halves.bow, lengthCells, breakX, half);
      const sternEnds = halfEnds(halves.stern, lengthCells, -half, breakX);
      const isBowUpper = bowEnds.top[1] > sternEnds.top[1];
      const framing = isBowUpper
        ? surfaceFraming(bowEnds, bow)
        : surfaceFraming(sternEnds, stern);
      return {
        ...framing,
        isSideOn: playback.speed < 1,
        isLow: false,
      };
    }
  } else if (sink < FOLLOW_MIN_SINK) {
    return null;
  }

  return {
    target: [x, y + CAMERA_TARGET[1], 0],
    isSideOn: playback.speed < 1,
    isLow,
    height: 0,
    isUnder: false,
  };
}
