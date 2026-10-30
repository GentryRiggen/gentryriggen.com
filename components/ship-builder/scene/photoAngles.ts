import { DEFAULT_BEAM } from "@/lib/ship-builder/model/grid";
import {
  CAMERA_TARGET,
  MAX_VIEW_DISTANCE,
  viewDistance,
  viewPosition,
  type CameraPosition,
} from "./cameraViews";

export type PhotoAngle = "three-quarter" | "side" | "bow-on" | "low";

export const PHOTO_ANGLES: { id: PhotoAngle; label: string }[] = [
  { id: "three-quarter", label: "¾ view" },
  { id: "side", label: "Side" },
  { id: "bow-on", label: "Bow-on" },
  { id: "low", label: "Dramatic low" },
];

export const DEFAULT_PHOTO_ANGLE: PhotoAngle = "three-quarter";

export interface PhotoPose {
  position: CameraPosition;
  target: CameraPosition;
}

/** The bow points toward +X, so a camera on +X faces the bow. */
const BOW_ON_SWING = 0.22;
const LOW_SWING = 0.7;
/** Height above the target as a share of distance; stays under the orbit's limit. */
const BOW_ON_RISE = 0.2;
const LOW_RISE = 0.1;

function clampDistance(distance: number): number {
  return Math.min(distance, MAX_VIEW_DISTANCE * 0.95);
}

/** Where the camera stands, and what it looks at, for a photo preset. */
export function photoPose(
  angle: PhotoAngle,
  lengthCells: number,
  aspect: number,
  beam: number = DEFAULT_BEAM
): PhotoPose {
  const [, targetY] = CAMERA_TARGET;
  // A narrow canvas needs more room to keep the whole ship in the picture.
  const roomy = 1 / Math.min(1, aspect);
  switch (angle) {
    case "three-quarter":
    case "side":
      return {
        position: viewPosition(angle, lengthCells, aspect, beam),
        target: CAMERA_TARGET,
      };
    case "bow-on": {
      const d = clampDistance(viewDistance(lengthCells, beam) * 0.85 * roomy);
      return {
        position: [
          d * Math.cos(BOW_ON_SWING),
          targetY + d * BOW_ON_RISE,
          d * Math.sin(BOW_ON_SWING),
        ],
        target: CAMERA_TARGET,
      };
    }
    case "low": {
      const d = clampDistance(viewDistance(lengthCells, beam) * 0.8 * roomy);
      return {
        position: [
          d * Math.cos(LOW_SWING),
          targetY + d * LOW_RISE,
          d * Math.sin(LOW_SWING),
        ],
        target: CAMERA_TARGET,
      };
    }
  }
}
