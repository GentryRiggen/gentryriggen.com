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

/**
 * Sim seconds over which the whole ship's idle bob is handed over to the
 * halves after the break (about a second of the slow motion), so a choppy
 * sea's rise and pitch fade out instead of snapping off.
 */
export const BOB_HANDOFF_S = 0.25;

/** How much of the idle bob the halves still carry, 1 at the break to 0. */
export function bobCarryWeight(sinceBreak: number): number {
  if (sinceBreak < 0) return 0;
  const t = Math.min(1, sinceBreak / BOB_HANDOFF_S);
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Places the group a half hangs from so it carries the whole ship's bob: a
 * rise of `lift` and a pitch of `pitch` about the ship's own origin (`pivotY`
 * world y, her `-sink`), as the bobbing group applied to the whole ship.
 * Mutates and returns `target`.
 */
export function applyBobCarry(
  target: Object3D,
  lift: number,
  pitch: number,
  pivotY: number
): Object3D {
  target.rotation.set(0, 0, pitch);
  target.position.set(
    pivotY * Math.sin(pitch),
    lift + pivotY - pivotY * Math.cos(pitch),
    0
  );
  return target;
}

/**
 * Where the break was the moment she broke, written into `out`: the point on
 * the keel line at `atX` with the whole ship in the pose she broke from (both
 * halves start there), so it stays put however far apart they move.
 */
export function breakOrigin(
  atX: number,
  lengthCells: number,
  pitch: number,
  sink: number,
  out: Vector3
): Vector3 {
  const x = worldXOf(atX, lengthCells);
  return out.set(x * Math.cos(pitch), x * Math.sin(pitch) - sink, 0);
}
