import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  RingGeometry,
  SphereGeometry,
} from "three";

/**
 * Fake light is additive: vertex colours fade from bright to black, and black
 * adds nothing, so no texture or alpha map is needed and nothing is lit by a
 * real light. Builders are pure; GlowShapes caches the results.
 */

function paintFalloff(
  geometry: BufferGeometry,
  falloffAt: (index: number) => number
): BufferGeometry {
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = falloffAt(i);
    colors.set([v, v, v], i * 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Brightness at fraction `t` (0 bright end, 1 faded end) of a soft falloff. */
export function softFalloff(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return (1 - clamped) ** 2;
}

/** A flat disc in the XZ plane, brightest at its centre. */
export function createPoolGeometry(radius: number): BufferGeometry {
  const geometry = new RingGeometry(0.0001, radius, 28, 6);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  return paintFalloff(geometry, (i) =>
    softFalloff(Math.hypot(positions.getX(i), positions.getZ(i)) / radius)
  );
}

/**
 * An open cone along +X, narrow and bright at the origin, wide and faded at
 * `length`: the visible beam of a lamp.
 */
export function createBeamGeometry(
  length: number,
  startRadius: number,
  endRadius: number
): BufferGeometry {
  const geometry = new CylinderGeometry(
    endRadius,
    startRadius,
    length,
    14,
    6,
    true
  );
  geometry.translate(0, length / 2, 0);
  geometry.rotateZ(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  return paintFalloff(geometry, (i) => softFalloff(positions.getX(i) / length));
}

/** A small sphere, drawn faintly additive around a bulb as its halo. */
export function createHaloGeometry(radius: number): BufferGeometry {
  return new SphereGeometry(radius, 12, 8);
}
