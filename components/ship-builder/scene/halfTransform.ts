import { Euler, Matrix4, Vector3, type Object3D } from "three";
import type { HalfPose } from "@/lib/ship-builder/sim/types";

/** World x of a point `cellsFromBow` along the hull (the bow points to +X). */
export function worldXOf(cellsFromBow: number, lengthCells: number): number {
  return lengthCells / 2 - cellsFromBow;
}

const rotation = new Euler();
const pivotOffset = new Vector3();

/**
 * Places one half of a broken ship: it turns (roll, pitch) about its pivot on
 * the long axis, then drifts and sinks. As a matrix that is
 * `T(driftX, -sink, 0) · T(px, 0, 0) · R(roll, 0, pitch) · T(-px, 0, 0)` with
 * `px` the pivot's world x, so an object's position is the pivot's offset
 * minus where the turn carries the pivot. Mutates and returns `target`.
 */
export function applyHalfPose(
  target: Object3D,
  pose: HalfPose,
  lengthCells: number
): Object3D {
  const px = worldXOf(pose.pivotX, lengthCells);
  target.rotation.set(pose.roll, 0, pose.pitch);
  rotation.set(pose.roll, 0, pose.pitch);
  pivotOffset.set(px, 0, 0).applyEuler(rotation);
  target.position.set(
    pose.driftX + px - pivotOffset.x,
    -pose.sink - pivotOffset.y,
    -pivotOffset.z
  );
  return target;
}

const turn = new Matrix4();
const step = new Matrix4();

/** The same placement as a matrix, written into `out`. */
export function halfMatrix(
  pose: HalfPose,
  lengthCells: number,
  out: Matrix4 = new Matrix4()
): Matrix4 {
  const px = worldXOf(pose.pivotX, lengthCells);
  rotation.set(pose.roll, 0, pose.pitch);
  turn.makeRotationFromEuler(rotation);
  out.makeTranslation(pose.driftX + px, -pose.sink, 0);
  out.multiply(turn);
  out.multiply(step.makeTranslation(-px, 0, 0));
  return out;
}
