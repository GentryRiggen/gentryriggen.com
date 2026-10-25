import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  SphereGeometry,
  type InstancedMesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {
  BoatLaunch,
  EvacuationPlan,
} from "@/lib/ship-builder/crowd/evacuation";
import { OUTFIT_COUNT } from "@/lib/ship-builder/crowd/types";
import { boatAfloatLift } from "./crowdView";
import type { LifeboatHull } from "./lifeboatHulls";
import { FINISHES } from "./Surface";
import { withRust } from "./rust";

/**
 * The crowd's figures, drawn as a handful of instanced meshes for everyone
 * at once: torsos, legs and heads, arms, and crew caps. Each figure is about
 * 0.75 of a level tall, standing at its origin and facing local +X.
 */

/** Tops for passengers; outfit 0 is the crew uniform (see `CREW_OUTFIT`). */
const TOPS = ["#e4572e", "#f2c14e", "#3a86ff", "#2ec4b6", "#ff7aa2", "#8ac926"];
const CREW_NAVY = "#1d2d5c";
const CAP_WHITE = "#f5f5f0";
const SKIN = "#e0ac8a";
const TROUSERS = "#3b3f4a";
export const CREW_OUTFIT = 0;

/** The top colour of an outfit: navy for crew, a bright top for passengers. */
export function topColorOf(outfit: number): string {
  if (outfit === CREW_OUTFIT) return CREW_NAVY;
  const passenger = Math.max(1, outfit % OUTFIT_COUNT);
  return TOPS[(passenger - 1) % TOPS.length];
}

/** How far a sitter drops (cells) and leans back (radians). */
export const SIT_DROP = 0.25;
export const SIT_LEAN = 0.25;
const ARM_SWING = 0.6;
const ARM_SPEED = 6;
const ARM_Y = 0.42;
const ARM_SIDE = 0.12;
/** A floater lies on their back, body centred on their spot, just afloat. */
const LIE_SHIFT = 0.3;
const LIE_Y = 0.04;

export type Posture = "stand" | "sit" | "lie";

export interface CrowdGeometries {
  torso: BufferGeometry;
  /** Trousers and head in one, coloured per vertex. */
  legsHead: BufferGeometry;
  arm: BufferGeometry;
  cap: BufferGeometry;
}

function painted(geometry: BufferGeometry, hex: string): BufferGeometry {
  const color = new Color(hex);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) {
    colors[k * 3] = color.r;
    colors[k * 3 + 1] = color.g;
    colors[k * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

let geometries: CrowdGeometries | null = null;

/** The figure's shared geometries, made once for the session. */
export function crowdGeometries(): CrowdGeometries {
  if (!geometries) {
    const legs = painted(
      new CylinderGeometry(0.085, 0.085, 0.14, 8).translate(0, 0.07, 0),
      TROUSERS
    );
    const head = painted(
      new SphereGeometry(0.095, 10, 8).translate(0, 0.6, 0),
      SKIN
    );
    const legsHead = mergeGeometries([legs, head]);
    legs.dispose();
    head.dispose();
    geometries = {
      torso: new CapsuleGeometry(0.09, 0.32, 3, 8).translate(0, 0.25, 0),
      legsHead: legsHead ?? new BufferGeometry(),
      // Hangs from the shoulder, which is the arm's origin.
      arm: new BoxGeometry(0.05, 0.26, 0.05).translate(0, -0.12, 0),
      cap: new CylinderGeometry(0.1, 0.1, 0.05, 10).translate(0, 0.69, 0),
    };
  }
  return geometries;
}

export interface CrowdMaterials {
  /** White, so each instance's colour (its top) shows as is. */
  instanced: MeshStandardMaterial;
  vertex: MeshStandardMaterial;
  cap: MeshStandardMaterial;
}

let materials: CrowdMaterials | null = null;

/** Satin paint like every part (`Surface`), rusting with the wreck. */
export function crowdMaterials(): CrowdMaterials {
  if (!materials) {
    const paint = FINISHES.paint;
    materials = {
      instanced: withRust(
        new MeshStandardMaterial({ color: "#ffffff", ...paint })
      ),
      vertex: withRust(
        new MeshStandardMaterial({
          color: "#ffffff",
          vertexColors: true,
          ...paint,
        })
      ),
      cap: withRust(new MeshStandardMaterial({ color: CAP_WHITE, ...paint })),
    };
  }
  return materials;
}

export interface CrowdMeshes {
  torso: InstancedMesh;
  legsHead: InstancedMesh;
  /** Two per person: left at `2i`, right at `2i + 1`. */
  arms: InstancedMesh;
  /** Crew only, at the person's cap slot. */
  cap: InstancedMesh | null;
}

const posture = new Matrix4();
const body = new Matrix4();
const arm = new Matrix4();
const swingTurn = new Matrix4();
/** Writes nothing visible: a person with no place this frame. */
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

/** The posture's offset from standing, in the figure's own frame. */
export function postureMatrix(kind: Posture, out: Matrix4): Matrix4 {
  if (kind === "sit") {
    return out.makeRotationZ(SIT_LEAN).setPosition(0, -SIT_DROP, 0);
  }
  if (kind === "lie") {
    // Turning +Y to -X lays them on their back, head behind them.
    return out.makeRotationZ(Math.PI / 2).setPosition(LIE_SHIFT, LIE_Y, 0);
  }
  return out.identity();
}

/** Arm swing (-1 to 1) for a walker at `time`, offset per person. */
export function armSwing(isWalking: boolean, time: number, i: number): number {
  return isWalking ? Math.sin(time * ARM_SPEED + i * 1.7) : 0;
}

/**
 * Writes person `i`'s instances: their figure placed by `place` (world
 * frame: where they stand, facing local +X) in `kind`'s posture, arms swung
 * by `swing`. `capSlot` is their cap's instance, or -1. Null `place` hides
 * them.
 */
export function writePerson(
  meshes: CrowdMeshes,
  i: number,
  capSlot: number,
  place: Matrix4 | null,
  kind: Posture,
  swing: number
): void {
  if (!place) {
    meshes.torso.setMatrixAt(i, HIDDEN);
    meshes.legsHead.setMatrixAt(i, HIDDEN);
    meshes.arms.setMatrixAt(2 * i, HIDDEN);
    meshes.arms.setMatrixAt(2 * i + 1, HIDDEN);
    if (meshes.cap && capSlot >= 0) meshes.cap.setMatrixAt(capSlot, HIDDEN);
    return;
  }
  body.multiplyMatrices(place, postureMatrix(kind, posture));
  meshes.torso.setMatrixAt(i, body);
  meshes.legsHead.setMatrixAt(i, body);
  if (meshes.cap && capSlot >= 0) meshes.cap.setMatrixAt(capSlot, body);
  for (const side of [1, -1]) {
    swingTurn
      .makeRotationZ(side * swing * ARM_SWING)
      .setPosition(0, ARM_Y, side * ARM_SIDE);
    arm.multiplyMatrices(body, swingTurn);
    meshes.arms.setMatrixAt(side === 1 ? 2 * i : 2 * i + 1, arm);
  }
}

const euler = new Euler();

/**
 * A launched boat's world transform at `t`: `boatPoseAt`, lifted so the hull
 * rides on the water (`boatAfloatLift`). Its origin is the boat's hang point.
 */
export function launchedBoatMatrix(
  plan: EvacuationPlan,
  launch: BoatLaunch,
  hull: LifeboatHull,
  t: number,
  out: Matrix4
): Matrix4 {
  const { position, rotation } = plan.boatPoseAt(launch, t);
  euler.set(rotation.x, rotation.y, rotation.z);
  return out
    .makeRotationFromEuler(euler)
    .setPosition(
      position.x,
      position.y + boatAfloatLift(hull, t - launch.at),
      position.z
    );
}
