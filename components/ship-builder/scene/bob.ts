import { STABILITY_THRESHOLDS } from "@/lib/ship-builder/model/stats";
import { clamp, TAU } from "./animationMath";

const DEG = Math.PI / 180;

export const BOB_AMPLITUDE = 0.05;
export const BOB_PERIOD = 4;
const ROLL_PERIOD = 5;
const PITCH_PERIOD = 6.5;
const ROLL_STABLE_DEG = 1;
const ROLL_DANGEROUS_DEG = 4;
const PITCH_DEG = 0.3;

export interface ShipPose {
  /** Vertical offset in world units. */
  y: number;
  /** Rotation about world X (the ship's long axis), radians. */
  roll: number;
  /** Rotation about world Z (bow up or down), radians. */
  pitch: number;
}

export function createShipPose(): ShipPose {
  return { y: 0, roll: 0, pitch: 0 };
}

/** Roll amplitude in degrees: 1 when level, rising to 4 at Dangerous. */
export function rollAmplitudeDeg(stabilityRatio: number): number {
  const ratio = Number.isFinite(stabilityRatio) ? stabilityRatio : 0;
  const t = clamp(Math.max(0, ratio) / STABILITY_THRESHOLDS.dangerous, 0, 1);
  return ROLL_STABLE_DEG + t * (ROLL_DANGEROUS_DEG - ROLL_STABLE_DEG);
}

/** Writes into `out` so the render loop reuses one object. */
export function bobPose(
  time: number,
  stabilityRatio: number,
  out: ShipPose
): ShipPose {
  out.y = BOB_AMPLITUDE * Math.sin((TAU * time) / BOB_PERIOD);
  out.roll =
    rollAmplitudeDeg(stabilityRatio) *
    DEG *
    Math.sin((TAU * time) / ROLL_PERIOD);
  out.pitch = PITCH_DEG * DEG * Math.sin((TAU * time) / PITCH_PERIOD + 1);
  return out;
}
