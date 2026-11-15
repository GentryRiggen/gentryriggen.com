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

/** Inverse of `uvToDir` for a unit direction. */
export function dirToUv(d: Vec3): { u: number; v: number } {
  const phi = Math.atan2(d.z, -d.x);
  const u = (((phi / (2 * Math.PI)) % 1) + 1) % 1;
  const theta = Math.acos(Math.min(1, Math.max(-1, d.y)));
  return { u, v: 1 - theta / Math.PI };
}

/**
 * East and north unit vectors at a surface direction (increasing u and v), so
 * a heading angle of 0 is east and a quarter turn is north. Finite at the poles.
 */
export function surfaceBasis(p: Vec3): { east: Vec3; north: Vec3 } {
  const sinTheta = Math.hypot(p.x, p.z);
  const phi = Math.atan2(p.z, -p.x);
  const east = { x: Math.sin(phi), y: 0, z: Math.cos(phi) };
  const cosTheta = p.y;
  const north = {
    x: Math.cos(phi) * cosTheta,
    y: sinTheta,
    z: -Math.sin(phi) * cosTheta,
  };
  return { east, north };
}

/**
 * Walks `angle` radians from `p` along the great circle that leaves in the
 * unit tangent `t`. Returns the new direction and the tangent there.
 */
export function moveOnSphere(
  p: Vec3,
  t: Vec3,
  angle: number
): { p: Vec3; t: Vec3 } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    p: {
      x: p.x * c + t.x * s,
      y: p.y * c + t.y * s,
      z: p.z * c + t.z * s,
    },
    t: {
      x: -p.x * s + t.x * c,
      y: -p.y * s + t.y * c,
      z: -p.z * s + t.z * c,
    },
  };
}

/**
 * `moveOnSphere` without allocating: writes the new position to `outP` and
 * (if given) the new tangent to `outT`. `p`, `t` and the outputs may be the
 * same objects.
 */
export function moveOnSphereInto(
  p: Vec3,
  t: Vec3,
  angle: number,
  outP: Vec3,
  outT?: Vec3
): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const px = p.x;
  const py = p.y;
  const pz = p.z;
  const tx = t.x;
  const ty = t.y;
  const tz = t.z;
  outP.x = px * c + tx * s;
  outP.y = py * c + ty * s;
  outP.z = pz * c + tz * s;
  if (outT) {
    outT.x = -px * s + tx * c;
    outT.y = -py * s + ty * c;
    outT.z = -pz * s + tz * c;
  }
}
