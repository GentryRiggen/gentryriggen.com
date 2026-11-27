import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import {
  floorZ,
  jumpHeight,
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
/**
 * Her hull lights' least power while looking under: well lit, so a child
 * can watch her go down (0.12 read as a near-black silhouette).
 */
export const LOOK_UNDER_MIN_POWER = 0.5;
/** The camera's lamp while looking under (it aims where the look follows her). */
export const LOOK_UNDER_LAMP = { night: 1600, afternoon: 500 } as const;
/** And its reach (m): she sinks a few hundred metres away. */
export const LOOK_UNDER_LAMP_RANGE_M = 900;
/** The night's starlight while looking under (it is 0.25 under the sea). */
export const LOOK_UNDER_NIGHT_AMBIENT = 0.9;
/** The night's water while looking under: lifted from near black to a deep teal. */
export const LOOK_UNDER_NIGHT_WATER = 0x0c3546;
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
  feetAt[2] = floorZ(map, w.area, w.x, spec, w.y);
  shipToThreeInto(pose, feetAt, feet);
  out.pos[0] = feet[0];
  out.pos[1] = feet[1] + WALK_EYE_M + jumpHeight(w.jumpS);
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

/** The camera lamp's power: strong while looking under. */
export function lookUnderLamp(
  timeOfDay: "night" | "afternoon",
  intensity: number,
  lookUnder: boolean
): number {
  return lookUnder
    ? Math.max(intensity, LOOK_UNDER_LAMP[timeOfDay])
    : intensity;
}

/** The night's starlight under the sea: lifted while looking under. */
export function lookUnderAmbient(
  intensity: number,
  lookUnder: boolean
): number {
  return lookUnder ? Math.max(intensity, LOOK_UNDER_NIGHT_AMBIENT) : intensity;
}

/** The field of view inside her (degrees): wider for tight rooms. */
export const WALK_INSIDE_FOV = 65;
/** And outside (the Canvas's own, which CameraRig restores after walk). */
export const WALK_OUTSIDE_FOV = 42;
/** How long the view takes to widen or narrow (s). */
export const WALK_FOV_EASE_S = 0.4;

/**
 * The field of view a frame later (degrees): toward 65° inside, the
 * scene's own (`outside`, 42° unless given) outside, at a steady rate that
 * crosses 42° to 65° in 0.4 s, and never past the target.
 */
export function insideFov(
  current: number,
  inside: boolean,
  dt: number,
  outside: number = WALK_OUTSIDE_FOV
): number {
  const want = inside ? WALK_INSIDE_FOV : outside;
  if (!(dt > 0)) return current;
  const step =
    ((WALK_INSIDE_FOV - WALK_OUTSIDE_FOV) / WALK_FOV_EASE_S) * Math.min(dt, 1);
  if (Math.abs(want - current) <= step) return want;
  return current + Math.sign(want - current) * step;
}

/**
 * Crossing a deck door moves the feet about 0.7 m in one substep: the eyes
 * ease there over this long (s), so it reads as a step, not a cut.
 */
export const EYE_EASE_S = 0.12;

/**
 * Blends the view's position from `from` (the eyes before the door) toward
 * where it now is, `t` seconds after the door (smoothstep over
 * EYE_EASE_S; exactly the view from then on). In place, no allocation.
 */
export function easeEyes(view: WalkerView, from: V3, t: number): WalkerView {
  const u = Math.max(0, Math.min(1, t / EYE_EASE_S));
  const k = u * u * (3 - 2 * u);
  for (let i = 0; i < 3; i += 1)
    view.pos[i] = from[i] + (view.pos[i] - from[i]) * k;
  return view;
}
