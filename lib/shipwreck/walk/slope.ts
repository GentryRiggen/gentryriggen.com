import type { BodyPose } from "../sim/track";
import type { V2 } from "./types";

/**
 * The ship frame under a sim pose, in the sim's earth axes (x, y level, z
 * up, the sea at z = 0). The same rotation as `shipToThreeInto` in
 * components/shipwreck/scene/cameraMath.ts (roll about x, then pitch, + bow
 * down, then yaw about z), ported here because lib must not import from
 * components; that one writes three.js axes, this one the sim's.
 */

export type V3 = [x: number, y: number, z: number];

/** A ship-frame point under the pose, in earth axes. */
export function shipToEarth(
  pose: BodyPose,
  p: readonly number[],
  out: V3 = [0, 0, 0]
): V3 {
  const [x, y, z] = p;
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  // Rx(roll): + lists to starboard (port side up)
  const y1 = cr * y - sr * z;
  const z1 = sr * y + cr * z;
  // Ry(pitch): + puts the bow (+x) down
  const x2 = cp * x + sp * z1;
  const z2 = -sp * x + cp * z1;
  // Rz(yaw)
  out[0] = pose.x + cy * x2 - sy * y1;
  out[1] = pose.y + sy * x2 + cy * y1;
  out[2] = pose.z + z2;
  return out;
}

/** An earth point in the ship frame under the pose (shipToEarth undone). */
export function earthToShip(
  pose: BodyPose,
  e: readonly number[],
  out: V3 = [0, 0, 0]
): V3 {
  const dx = e[0] - pose.x;
  const dy = e[1] - pose.y;
  const z2 = e[2] - pose.z;
  const cy = Math.cos(pose.yaw);
  const sy = Math.sin(pose.yaw);
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  const x2 = cy * dx + sy * dy;
  const y1 = -sy * dx + cy * dy;
  const x = cp * x2 - sp * z2;
  const z1 = sp * x2 + cp * z2;
  out[0] = x;
  out[1] = cr * y1 + sr * z1;
  out[2] = -sr * y1 + cr * z1;
  return out;
}

/** Gravity's direction in the ship frame for this pose (unit). */
export function gravityInShip(
  pose: BodyPose
): readonly [number, number, number] {
  // Earth's (0, 0, −1) through the inverse rotation (heading drops out).
  const cp = Math.cos(pose.pitch);
  return [
    Math.sin(pose.pitch),
    -Math.sin(pose.roll) * cp,
    -Math.cos(pose.roll) * cp,
  ];
}

/**
 * The deck's slope in degrees (the angle between her deck's up and the
 * true up) and the unit downhill direction on the deck plane (ship x, y);
 * [0, 0] on a level deck.
 */
export function deckSlope(pose: BodyPose): { deg: number; downhill: V2 } {
  const [gx, gy, gz] = gravityInShip(pose);
  const deg = (Math.acos(Math.max(-1, Math.min(1, -gz))) * 180) / Math.PI;
  const along = Math.hypot(gx, gy);
  const downhill: V2 = along > 1e-12 ? [gx / along, gy / along] : [0, 0];
  return { deg, downhill };
}
