import { Quaternion, Vector3, type Object3D } from "three";
import type { SimTrack } from "@/lib/shipwreck/sim/track";
import type { V3 } from "./titanicRecipe";

/**
 * The bent bow (R12): a visual rule, not physics. When her bow strikes the
 * floor while her stern is still above the sea (the Britannic's, 9:03 AM),
 * the bow forward of the recipe's hinge bends up and to port about the
 * C deck there, as her wreck's bow is "heavily deformed and attached to
 * the rest of the hull only by some pieces of C-Deck" [WP] ("severely bent
 * up" [GOL]). The sim is unchanged: the model's bow group turns.
 */

/** The bend at rest, radians (about 11°, the stem up and a little to port). */
export const BOW_BEND_REST = 0.2;
/** How much of the bend turns her stem to port (the rest lifts it). */
const PORT_SHARE = 0.35;
/** Seconds from the strike to the rest bend (the hull pressing down on it). */
export const BOW_BEND_EASE_S = 40;

/**
 * When the bow landed hard: the first `bow-lands` while her stern is still
 * up (before `sankAtT`), or null (no landing, or a gentle one after she
 * was all under).
 */
export function hardLandingAt(
  track: Pick<SimTrack, "events" | "sankAtT">
): number | null {
  for (const e of track.events)
    if (e.kind === "bow-lands")
      return track.sankAtT === null || e.t < track.sankAtT ? e.t : null;
  return null;
}

/** The bend at `t` (radians): 0 until `landedAt`, easing to the rest. */
export function bowBend(t: number, landedAt: number | null): number {
  if (landedAt === null || t <= landedAt) return 0;
  const u = Math.min(1, (t - landedAt) / BOW_BEND_EASE_S);
  // Fast at first (the strike), settling (ease out).
  return BOW_BEND_REST * (1 - (1 - u) * (1 - u) * (1 - u));
}

/**
 * A ship-frame point of the bow (forward of the hinge) bent by `b`: turned
 * about the line across the ship at (hinge.x, hinge.z), its stem up, then
 * about the upright through it, to port.
 */
export function bendShipPoint(
  p: V3,
  b: number,
  hinge: { x: number; z: number }
): V3 {
  const up = b * (1 - PORT_SHARE);
  const port = b * PORT_SHARE;
  const dx = p[0] - hinge.x;
  const dz = p[2] - hinge.z;
  // Stem up: x toward +z.
  const x1 = dx * Math.cos(up) - dz * Math.sin(up);
  const z1 = dx * Math.sin(up) + dz * Math.cos(up);
  // To port: x toward +y.
  const x2 = x1 * Math.cos(port) - p[1] * Math.sin(port);
  const y2 = x1 * Math.sin(port) + p[1] * Math.cos(port);
  return [hinge.x + x2, y2, hinge.z + z1];
}

const qa = new Quaternion();
const qb = new Quaternion();
const axisY = new Vector3(0, 1, 0);
const axisZ = new Vector3(0, 0, 1);
const pivot = new Vector3();

/**
 * Poses the model's bow group (a child of the ship-frame group, in its
 * three.js axes: x forward, y up, z to starboard) so every point in it
 * moves as `bendShipPoint` moves it. No allocation: safe every frame.
 */
export function applyBowBend(
  group: Object3D,
  b: number,
  hinge: { x: number; z: number }
): void {
  // Ship "stem up" is a turn about three's +z; "to port" about its +y.
  qa.setFromAxisAngle(axisY, b * PORT_SHARE);
  qb.setFromAxisAngle(axisZ, b * (1 - PORT_SHARE));
  group.quaternion.copy(qa).multiply(qb);
  pivot.set(hinge.x, hinge.z, 0);
  group.position.copy(pivot).applyQuaternion(group.quaternion).negate();
  group.position.add(pivot);
}

/**
 * The bend in the scene (Task 6): the same angle, turned about the line
 * through the hinge that stands upright in the sea for her pose right now
 * (her trim and roll; ship frame (sin pitch, -cos pitch sin roll,
 * -cos pitch cos roll), straight down), so the bent bow swings along the
 * floor where the sim lays her bow instead of lifting off it or digging
 * in: lying on her starboard side (roll 90°, trim 0) it is the stem bent
 * up from her keel line, as her wreck's bow. A ship-frame point moved as
 * `applyBowBendAbout` moves it.
 */
export function bendShipPointAbout(
  p: V3,
  b: number,
  hinge: { x: number; z: number },
  roll: number,
  pitch = 0
): V3 {
  // Rodrigues about the unit axis a through (hinge.x, 0, hinge.z).
  const cp = Math.cos(pitch);
  const ax = Math.sin(pitch);
  const ay = -cp * Math.sin(roll);
  const az = -cp * Math.cos(roll);
  const vx = p[0] - hinge.x;
  const vy = p[1];
  const vz = p[2] - hinge.z;
  const c = Math.cos(b);
  const s = Math.sin(b);
  const cx = ay * vz - az * vy;
  const cy = az * vx - ax * vz;
  const cz = ax * vy - ay * vx;
  const d = ax * vx + ay * vy + az * vz;
  return [
    hinge.x + vx * c + cx * s + ax * d * (1 - c),
    vy * c + cy * s + ay * d * (1 - c),
    hinge.z + vz * c + cz * s + az * d * (1 - c),
  ];
}

const axisAbout = new Vector3();

/** Poses the bow group as `bendShipPointAbout` moves a point (no allocation). */
export function applyBowBendAbout(
  group: Object3D,
  b: number,
  hinge: { x: number; z: number },
  roll: number,
  pitch = 0
): void {
  // Ship (ax, ay, az) is three (ax, az, -ay).
  const cp = Math.cos(pitch);
  axisAbout.set(Math.sin(pitch), -cp * Math.cos(roll), cp * Math.sin(roll));
  group.quaternion.setFromAxisAngle(axisAbout, b);
  pivot.set(hinge.x, hinge.z, 0);
  group.position.copy(pivot).applyQuaternion(group.quaternion).negate();
  group.position.add(pivot);
}
