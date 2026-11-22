import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import {
  floorZ,
  WALK_EYE_M,
  type SwimmerState,
  type WalkerState,
  type WalkMap,
} from "@/lib/shipwreck/walk";
import { shipToThreeInto, type V3 } from "./cameraMath";

/**
 * The walker's eyes, pure (no three.js): where the first-person camera
 * stands and which way it looks, on her deck or floating in the sea, plus
 * the few numbers Look under changes in the scene. The view is always
 * level with the horizon: yaw and pitch come from the player's look only,
 * never from her pitch or roll, and there is no head bob on deck.
 */

/**
 * A first-person view in three.js axes (x her heading at the start, y up,
 * z to starboard). `yaw` is an earth heading in the sim's convention (0
 * along earth x, + turns to port, i.e. toward three −z); `pitch` is up (+)
 * or down (−) from level. No roll, ever.
 */
export interface WalkerView {
  pos: V3;
  yaw: number;
  pitch: number;
}

/** Eyes over the sea while floating (m). */
export const FLOAT_EYE_M = 0.3;
/** Eyes under the sea while looking under (three y, m). */
export const LOOK_UNDER_EYE_Y = -1.0;
/** The swell under a swimmer: amplitude (m) and period (s). */
export const BOB_AMPLITUDE_M = 0.25;
export const BOB_PERIOD_S = 7;
/** How far the look tilts up or down (rad, about 75°). */
export const WALK_PITCH_LIMIT = 1.3;
/** Her hull lights' least power while looking under (a dim lit shape). */
export const LOOK_UNDER_MIN_POWER = 0.12;
/** The night's under-water fog while looking under (exp² density). */
export const LOOK_UNDER_NIGHT_FOG = 0.0018;
/** The afternoon's under-water fog is this share of its own while looking under. */
export const LOOK_UNDER_DAY_FOG_SHARE = 0.35;
/** The scene's ambient light while walking, a faint lift (×). */
export const WALK_AMBIENT_LIFT = 1.25;

const feet: V3 = [0, 0, 0];
const feetAt: [number, number, number] = [0, 0, 0];

/**
 * The eyes of a walker on her deck: the feet on the area's floor through
 * the pose, then 1.6 m straight up (true up, so a list never tilts the
 * view). Heading is her heading plus the walker's (exact on a level deck,
 * close on a tilted one).
 */
export function deckEyes(
  w: WalkerState,
  pose: BodyPose,
  spec: ShipSpec,
  map: WalkMap,
  lookPitch: number,
  out: WalkerView = newView()
): WalkerView {
  feetAt[0] = w.x;
  feetAt[1] = w.y;
  feetAt[2] = floorZ(map, w.area, w.x, spec);
  shipToThreeInto(pose, feetAt, feet);
  out.pos[0] = feet[0];
  out.pos[1] = feet[1] + WALK_EYE_M;
  out.pos[2] = feet[2];
  out.yaw = pose.yaw + w.yaw;
  out.pitch = lookPitch;
  return out;
}

/** A fresh view (the frame loop keeps one and passes it as `out`). */
export function newView(): WalkerView {
  return { pos: [0, 0, 0], yaw: 0, pitch: 0 };
}

/**
 * The swell under a swimmer (m): a 0.25 m, 7 s sine, so floating rises
 * and falls gently. The sea quad is flat (Sea.tsx's `height()` only bends
 * its normals), so this is the camera's own swell, not read off the GPU.
 */
export function bob(wallT: number): number {
  return BOB_AMPLITUDE_M * Math.sin((2 * Math.PI * wallT) / BOB_PERIOD_S);
}

/** The eyes of a swimmer: on the swell, or 1 m under to look under. */
export function waterEyes(
  s: SwimmerState,
  wallT: number,
  lookPitch: number,
  lookUnder: boolean,
  out: WalkerView = newView()
): WalkerView {
  out.pos[0] = s.x;
  out.pos[1] = lookUnder ? LOOK_UNDER_EYE_Y : bob(wallT) + FLOAT_EYE_M;
  out.pos[2] = -s.y;
  out.yaw = s.yaw;
  out.pitch = lookPitch;
  return out;
}

/**
 * The pitch that looks from `eye` at `target` (three.js points), no lower
 * than `minPitch`: Look under tilts down with it to keep her in frame.
 */
export function followShipPitch(eye: V3, target: V3, minPitch: number): number {
  const dh = Math.hypot(target[0] - eye[0], target[2] - eye[2]);
  return Math.max(minPitch, Math.atan2(target[1] - eye[1], dh));
}

/** Her hull lights' power: kept faintly on while looking under. */
export function walkHullPower(power: number, lookUnder: boolean): number {
  return lookUnder ? Math.max(power, LOOK_UNDER_MIN_POWER) : power;
}

/** The under-water fog density: clearer water while looking under. */
export function lookUnderFog(
  timeOfDay: "night" | "afternoon",
  density: number,
  lookUnder: boolean
): number {
  if (!lookUnder) return density;
  return timeOfDay === "night"
    ? LOOK_UNDER_NIGHT_FOG
    : density * LOOK_UNDER_DAY_FOG_SHARE;
}

/** The scene's ambient light: a faint lift while walking. */
export function walkAmbient(intensity: number, walking: boolean): number {
  return walking ? intensity * WALK_AMBIENT_LIFT : intensity;
}

/** The camera's look direction for a view (three.js axes, unit), into `out`. */
export function viewDirection(v: WalkerView, out: V3): V3 {
  const cp = Math.cos(v.pitch);
  out[0] = Math.cos(v.yaw) * cp;
  out[1] = Math.sin(v.pitch);
  out[2] = -Math.sin(v.yaw) * cp;
  return out;
}
