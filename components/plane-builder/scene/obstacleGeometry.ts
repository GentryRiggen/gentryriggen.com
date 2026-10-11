import {
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  TetrahedronGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {
  LevelPalette,
  ObstacleKind,
} from "@/lib/plane-builder/levels/types";

const TRUNK = "#7a4e2d";
const ROCK = "#8a8680";
const SNOW = "#f5f8ff";
const BIRD = "#3a3a46";
const STRING = "#e8e8e8";

interface Part {
  geometry: BufferGeometry;
  color: string;
}

/**
 * Every shape fits the unit box (-0.5..0.5 on each axis); an instance's scale
 * stretches it to the obstacle's real size.
 */
function parts(kind: ObstacleKind, palette: LevelPalette): Part[] {
  switch (kind) {
    case "tree":
      return [
        {
          geometry: new CylinderGeometry(0.08, 0.1, 0.4, 6).translate(
            0,
            -0.3,
            0
          ),
          color: TRUNK,
        },
        {
          geometry: new ConeGeometry(0.42, 0.75, 8).translate(0, 0.125, 0),
          color: palette.soft,
        },
      ];
    case "barn":
      return [
        {
          geometry: new BoxGeometry(1, 0.6, 1).translate(0, -0.2, 0),
          color: palette.hard,
        },
        {
          // A 3-sided cylinder lying on its side is a triangular roof prism.
          geometry: new CylinderGeometry(0.5, 0.5, 1.04, 3)
            .rotateX(-Math.PI / 2)
            .scale(1 / 0.866, 0.4 / 0.75, 1)
            .translate(0, 0.233, 0),
          color: ROCK,
        },
      ];
    case "balloon":
      return [
        {
          geometry: new SphereGeometry(0.35, 12, 10).translate(0, 0.15, 0),
          color: palette.soft,
        },
        {
          geometry: new CylinderGeometry(0.01, 0.01, 0.3, 4).translate(
            0,
            -0.35,
            0
          ),
          color: STRING,
        },
      ];
    case "wall":
      return [{ geometry: new BoxGeometry(1, 1, 1), color: ROCK }];
    case "arch":
      return [{ geometry: new BoxGeometry(1, 1, 1), color: palette.hard }];
    case "bird":
      return [
        {
          geometry: new TetrahedronGeometry(0.5).scale(1, 0.3, 1.1),
          color: BIRD,
        },
      ];
    case "peak":
      return [
        {
          geometry: new ConeGeometry(0.5, 0.85, 7).translate(0, -0.075, 0),
          color: ROCK,
        },
        {
          geometry: new ConeGeometry(0.19, 0.3, 7).translate(0, 0.2, 0),
          color: SNOW,
        },
      ];
  }
}

/** One merged, vertex-coloured geometry per obstacle kind (one draw call). */
export function buildObstacleGeometry(
  kind: ObstacleKind,
  palette: LevelPalette
): BufferGeometry {
  const prepared = parts(kind, palette).map(({ geometry, color }) => {
    // Polyhedra are non-indexed; merging needs them all the same.
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const count = flat.getAttribute("position").count;
    const rgb = new Color(color);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      colors.set([rgb.r, rgb.g, rgb.b], i * 3);
    }
    flat.setAttribute("color", new BufferAttribute(colors, 3));
    return flat;
  });
  const merged = mergeGeometries(prepared);
  if (!merged) throw new Error(`Could not build the ${kind} shape`);
  return merged;
}
