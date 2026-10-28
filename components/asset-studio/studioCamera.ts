export type Vec3 = [number, number, number];

export interface StudioView {
  azimuthDeg: number;
  elevationDeg: number;
  ortho: boolean;
}

export interface StudioCamera {
  ortho: boolean;
  position: Vec3;
  target: Vec3;
  up: Vec3;
  /** Ortho only. */
  orthoHalfHeight: number;
  /** Perspective only (vertical). */
  fovDeg: number;
}

export const MARGIN = 1.1;
export const PERSPECTIVE_FOV_DEG = 30;
export const ORTHO_DISTANCE_FACTOR = 4;

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function along(origin: Vec3, dir: Vec3, distance: number): Vec3 {
  return [
    origin[0] + dir[0] * distance,
    origin[1] + dir[1] * distance,
    origin[2] + dir[2] * distance,
  ];
}

/**
 * A port of `camera_for_view` in assets/blender/lib/render.py (see its
 * docstring for the rule), so the studio screenshot lines up with the Blender
 * render. Three.js coordinates, Y-up.
 */
export function cameraForView(
  view: StudioView,
  boundsMin: readonly number[],
  boundsMax: readonly number[]
): StudioCamera {
  const centre: Vec3 = [
    (boundsMin[0] + boundsMax[0]) / 2,
    (boundsMin[1] + boundsMax[1]) / 2,
    (boundsMin[2] + boundsMax[2]) / 2,
  ];
  const radius =
    Math.hypot(
      boundsMax[0] - boundsMin[0],
      boundsMax[1] - boundsMin[1],
      boundsMax[2] - boundsMin[2]
    ) / 2;
  const az = (view.azimuthDeg * Math.PI) / 180;
  const el = (view.elevationDeg * Math.PI) / 180;
  const dir: Vec3 = [
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  ];
  const up: Vec3 = [0, 1, 0];
  const right = normalize(cross([-dir[0], -dir[1], -dir[2]], up));
  if (view.ortho) {
    let rMin = Infinity;
    let rMax = -Infinity;
    let uMin = Infinity;
    let uMax = -Infinity;
    for (const x of [boundsMin[0], boundsMax[0]]) {
      for (const y of [boundsMin[1], boundsMax[1]]) {
        for (const z of [boundsMin[2], boundsMax[2]]) {
          const offset: Vec3 = [x - centre[0], y - centre[1], z - centre[2]];
          const pr = dot(offset, right);
          const pu = dot(offset, up);
          rMin = Math.min(rMin, pr);
          rMax = Math.max(rMax, pr);
          uMin = Math.min(uMin, pu);
          uMax = Math.max(uMax, pu);
        }
      }
    }
    const target = along(
      along(centre, right, (rMax + rMin) / 2),
      up,
      (uMax + uMin) / 2
    );
    return {
      ortho: true,
      position: along(target, dir, ORTHO_DISTANCE_FACTOR * radius),
      target,
      up,
      orthoHalfHeight: MARGIN * Math.max((rMax - rMin) / 2, (uMax - uMin) / 2),
      fovDeg: PERSPECTIVE_FOV_DEG,
    };
  }
  const distance =
    (MARGIN * radius) / Math.sin((PERSPECTIVE_FOV_DEG * Math.PI) / 360);
  return {
    ortho: false,
    position: along(centre, dir, distance),
    target: centre,
    up,
    orthoHalfHeight: 0,
    fovDeg: PERSPECTIVE_FOV_DEG,
  };
}
