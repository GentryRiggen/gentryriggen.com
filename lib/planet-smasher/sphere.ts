export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Unit direction for a texture coordinate, matching three.js SphereGeometry:
 * u is longitude 0..1, v = 1 at the north pole.
 */
export function uvToDir(u: number, v: number): Vec3 {
  const phi = 2 * Math.PI * u;
  const theta = Math.PI * (1 - v);
  return {
    x: -Math.cos(phi) * Math.sin(theta),
    y: Math.cos(theta),
    z: Math.sin(phi) * Math.sin(theta),
  };
}

/** Angle between two unit vectors, in radians. */
export function angularDistance(a: Vec3, b: Vec3): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}
