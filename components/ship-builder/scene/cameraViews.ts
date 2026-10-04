import { PROW_LENGTH } from "@/lib/ship-builder/model/attach";
import { DEFAULT_BEAM, WING_REACH } from "@/lib/ship-builder/model/grid";
import type { Ship } from "@/lib/ship-builder/model/types";
import type { CameraView } from "@/lib/ship-builder/state/store";
import { DECK_Y } from "./coords";

export type CameraPosition = [number, number, number];

export const CAMERA_TARGET: CameraPosition = [0, DECK_Y + 1.5, 0];

/** Keeps the orbit camera a little above the horizon (≈85.4°). */
export const MAX_POLAR_ANGLE = Math.PI / 2 - 0.08;

/**
 * The side preset's polar angle (≈83.1°). It must sit inside MAX_POLAR_ANGLE,
 * or OrbitControls clamps it and the preset lands somewhere else.
 */
const SIDE_POLAR_ANGLE = Math.PI / 2 - 0.12;

/** Extra camera distance per cell of beam beyond the default hull. */
const DISTANCE_PER_EXTRA_BEAM = 1.5;

function beamAllowance(beam: number): number {
  return (beam - DEFAULT_BEAM) * DISTANCE_PER_EXTRA_BEAM;
}

export function viewDistance(lengthCells: number, beam = DEFAULT_BEAM): number {
  return lengthCells * 0.9 + 12 + beamAllowance(beam);
}

/** OrbitControls' maxDistance; presets never place the camera beyond it. */
export const MAX_VIEW_DISTANCE = 120;

const THREE_QUARTER_OFFSET = [0.65, 0.45, 0.65] as const;

/**
 * Three-quarter distance. The ship's length runs across the screen, so a
 * narrow canvas (aspect < 1) needs proportionally more room to keep the prow
 * in frame.
 */
function threeQuarterDistance(
  lengthCells: number,
  aspect: number,
  beam: number
): number {
  const wanted =
    (lengthCells * 1.1 + 12 + beamAllowance(beam)) / Math.min(1, aspect);
  return Math.min(
    wanted,
    MAX_VIEW_DISTANCE / Math.hypot(...THREE_QUARTER_OFFSET)
  );
}

export function viewPosition(
  view: CameraView,
  lengthCells: number,
  aspect = 1,
  beam = DEFAULT_BEAM
): CameraPosition {
  const distance = viewDistance(lengthCells, beam);
  const [, targetY] = CAMERA_TARGET;
  switch (view) {
    case "side":
      return [
        0,
        targetY + distance * Math.cos(SIDE_POLAR_ANGLE),
        distance * Math.sin(SIDE_POLAR_ANGLE),
      ];
    case "top":
      return [0, distance * 1.2, 0.01];
    case "three-quarter": {
      const [dx, dy, dz] = THREE_QUARTER_OFFSET;
      const d = threeQuarterDistance(lengthCells, aspect, beam);
      return [d * dx, d * dy, d * dz];
    }
  }
}

/** Angle from straight up, as OrbitControls measures it around the target. */
export function polarAngle(position: CameraPosition): number {
  const [x, y, z] = position.map((value, i) => value - CAMERA_TARGET[i]);
  return Math.atan2(Math.hypot(x, z), y);
}

/**
 * A hull length that differs from the previous length by more than this (in
 * segments) reframes the camera, e.g. loading a much longer ship. Single −/+
 * clicks stay under it so the camera doesn't jump while the player is editing.
 */
export const REFRAME_SEGMENT_THRESHOLD = 2;

export function shouldReframe(
  previousSegments: number,
  lengthSegments: number
): boolean {
  return (
    Math.abs(lengthSegments - previousSegments) > REFRAME_SEGMENT_THRESHOLD
  );
}

/** A beam change bigger than this (in cells) reframes, e.g. loading a ship. */
export const REFRAME_BEAM_THRESHOLD = 2;

export function shouldReframeBeam(previousBeam: number, beam: number): boolean {
  return Math.abs(beam - previousBeam) > REFRAME_BEAM_THRESHOLD;
}

export interface FrameRequest {
  camera: { view: CameraView; nonce: number };
  lengthSegments: number;
  beam: number;
}

/**
 * Whether the camera should be placed for `next`, given the previous request
 * (null on the first run). A new preset request always frames; a length or
 * beam change only when it jumped from the previous one.
 */
export function shouldFrame(
  seen: FrameRequest | null,
  next: FrameRequest
): boolean {
  if (!seen || seen.camera !== next.camera) return true;
  return (
    shouldReframe(seen.lengthSegments, next.lengthSegments) ||
    shouldReframeBeam(seen.beam, next.beam)
  );
}

/** The ship's beam in cells. */
export function shipBeam(ship: Ship): number {
  return ship.hull.beam;
}

/** Room to pan past the ship's outline, in world units. */
export const PAN_MARGIN = 3;

/**
 * The target's height range: low enough to look along the waterline, and high
 * enough that MAX_POLAR_ANGLE keeps the camera above the water.
 */
const PAN_HEIGHT: [number, number] = [0.5, 6];

export interface PanBounds {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}

/** The box the orbit target may be panned within, centred on the ship. */
export function panBounds(lengthCells: number, beam: number): PanBounds {
  const halfX = lengthCells / 2 + PROW_LENGTH + PAN_MARGIN;
  const halfZ = beam / 2 + WING_REACH + PAN_MARGIN;
  return { x: [-halfX, halfX], y: PAN_HEIGHT, z: [-halfZ, halfZ] };
}

const clamp = (value: number, [min, max]: [number, number]) =>
  Math.min(max, Math.max(min, value));

export function clampTarget(
  [x, y, z]: CameraPosition,
  bounds: PanBounds
): CameraPosition {
  return [clamp(x, bounds.x), clamp(y, bounds.y), clamp(z, bounds.z)];
}
