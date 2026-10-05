import { BufferGeometry, Color, Float32BufferAttribute } from "three";
import { slotNoise } from "./particles";

export const SEA_FLOOR_SIZE = 400;
const SEGMENTS = 64;
/** The most the sand rises or falls from its level. */
export const SEA_FLOOR_BUMP = 0.6;

const NEAR_SAND = new Color("#c9b283");
const FAR_SAND = new Color("#3f4a50");

/** Gentle dunes: a few crossed waves, always within ±SEA_FLOOR_BUMP. */
export function seaFloorHeight(x: number, z: number): number {
  const sum =
    0.5 * Math.sin(x * 0.21 + z * 0.13) +
    0.3 * Math.sin(z * 0.27 - x * 0.09 + 1.7) +
    0.2 * Math.sin((x + z) * 0.55 + 0.4);
  return sum * SEA_FLOOR_BUMP;
}

/** Sand colour at a distance from the centre: warm near, murky far. */
export function seaFloorColor(distance: number, out: Color): Color {
  const t = Math.min(1, distance / (SEA_FLOOR_SIZE / 2));
  return out.copy(NEAR_SAND).lerp(FAR_SAND, t);
}

/**
 * A grid lying in the XZ plane with deterministic bumps and vertex colours
 * that darken with distance. The same call always gives the same floor, so it
 * never flickers between renders.
 */
export function createSeaFloorGeometry(): BufferGeometry {
  const side = SEGMENTS + 1;
  const positions = new Float32Array(side * side * 3);
  const colors = new Float32Array(side * side * 3);
  const color = new Color();
  for (let row = 0; row < side; row++) {
    for (let col = 0; col < side; col++) {
      const index = row * side + col;
      const x = (col / SEGMENTS - 0.5) * SEA_FLOOR_SIZE;
      const z = (row / SEGMENTS - 0.5) * SEA_FLOOR_SIZE;
      positions.set([x, seaFloorHeight(x, z), z], index * 3);
      // A little per-vertex grain so the sand is not a flat wash.
      seaFloorColor(Math.hypot(x, z), color).multiplyScalar(
        1 + slotNoise(index, 5) * 0.04
      );
      colors.set([color.r, color.g, color.b], index * 3);
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < SEGMENTS; row++) {
    for (let col = 0; col < SEGMENTS; col++) {
      const a = row * side + col;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      // Counter-clockwise seen from above (+Y).
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
