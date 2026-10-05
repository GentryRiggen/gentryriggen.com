import type { BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Bevel radius for toy-like blocks: soft, but the block still reads square. */
export const DEFAULT_BEVEL = 0.06;

const cache = new Map<string, BufferGeometry>();

/**
 * A box with rounded edges, centred on the origin, at exactly the given outer
 * size. Cached per size for the session (shared, never disposed), so every
 * block of the same size reuses one geometry. The radius is capped so thin
 * pieces stay valid.
 */
export function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius = DEFAULT_BEVEL,
  segments = 2
): BufferGeometry {
  const r = Math.min(radius, width / 2, height / 2, depth / 2) * 0.999;
  const key = [width, height, depth, r, segments]
    .map((n) => n.toFixed(4))
    .join(":");
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = new RoundedBoxGeometry(width, height, depth, segments, r);
    cache.set(key, geometry);
  }
  return geometry;
}
