import type { Object3D } from "three";
import type { BodyPose } from "@/lib/shipwreck/sim/track";

/**
 * Puts a part of the model (`whole`, `bow` or `stern`) where the sim says.
 * The sim's ship-to-earth rotation is Rz(yaw)·Ry(pitch)·Rx(roll) in the
 * ship/earth frame (x forward, y to port, z up). In three.js axes
 * (three.x = x, three.y = z, three.z = -y) that is Ry(yaw)·Rz(−pitch)·Rx(roll),
 * an Euler in "YZX" order. Writes position and rotation only: no allocation,
 * safe to call every frame.
 */
export function applyBodyPose(object: Object3D, pose: BodyPose): void {
  object.position.set(pose.x, pose.z, -pose.y);
  object.rotation.set(pose.roll, pose.yaw, -pose.pitch, "YZX");
}
