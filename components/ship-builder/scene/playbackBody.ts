import type { BodyPose } from "@/lib/ship-builder/crowd/evacuation";
import type { WalkHalf } from "@/lib/ship-builder/walk";
import { halfOfX } from "./partHalves";
import type { TrialPlayback } from "./trialPlayback";

/** Where she is broken in the playback (cells from the bow), or null. */
export function brokenAtX(playback: TrialPlayback): number | null {
  const { halves, breakup } = playback;
  if (!halves) return null;
  return breakup?.atX ?? halves.bow.pivotX;
}

/** The body carrying someone `cellsFromBow` along, from the playback now. */
export function playbackBody(
  playback: TrialPlayback,
  cellsFromBow: number
): BodyPose {
  const atX = brokenAtX(playback);
  if (atX !== null && playback.halves) {
    return playback.halves[halfOfX(cellsFromBow, atX)];
  }
  return playback;
}

/**
 * The body under the walker: the half they ride once she breaks (`half`),
 * else whatever carries the spot they stand on.
 */
export function walkerBody(
  playback: TrialPlayback,
  half: WalkHalf | null,
  cellsFromBow: number
): BodyPose {
  if (half !== null && playback.halves) return playback.halves[half];
  return playbackBody(playback, cellsFromBow);
}
