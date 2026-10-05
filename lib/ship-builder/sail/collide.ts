import type { HullPart } from "./types";

export interface HullBody {
  x: number;
  z: number;
  heading: number;
  length: number;
  beam: number;
  /** World velocity, cells per second. */
  vx: number;
  vz: number;
}

export interface CircleBody {
  x: number;
  z: number;
  radius: number;
  vx: number;
  vz: number;
}

export interface HullHit {
  impactX: number;
  part: HullPart;
  closingSpeed: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/**
 * Circle against the hull's oriented rectangle. Works in the hull's frame:
 * `u` runs along the bow (+) to stern (-), `v` across the beam.
 */
export function hullHit(hull: HullBody, c: CircleBody): HullHit | null {
  const cos = Math.cos(hull.heading);
  const sin = Math.sin(hull.heading);
  const dx = c.x - hull.x;
  const dz = c.z - hull.z;
  const u = dx * cos + dz * sin;
  const v = -dx * sin + dz * cos;

  const halfL = hull.length / 2;
  const halfB = hull.beam / 2;
  const cu = clamp(u, -halfL, halfL);
  const cv = clamp(v, -halfB, halfB);

  const du = u - cu;
  const dv = v - cv;
  const distance = Math.hypot(du, dv);
  if (distance > c.radius) return null;

  const part: HullPart = u > halfL ? "bow" : u < -halfL ? "stern" : "side";

  // Contact normal in the hull frame, hull toward obstacle. A centre inside
  // the hull has no direction of its own, so use the bow.
  const nu = distance > 0 ? du / distance : 1;
  const nv = distance > 0 ? dv / distance : 0;
  const nx = nu * cos - nv * sin;
  const nz = nu * sin + nv * cos;
  const closing = (hull.vx - c.vx) * nx + (hull.vz - c.vz) * nz;

  return {
    impactX: clamp(halfL - cu, 0, hull.length),
    part,
    closingSpeed: Math.max(0, closing),
  };
}
