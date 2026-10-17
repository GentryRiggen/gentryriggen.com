import {
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
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
const COCONUT = "#5b3a1e";
const WINDOWS = "#cfe6f5";
const ROOF = "#4a4f57";
const ICE = "#e6f6ff";
const ICE_DEEP = "#b4d8ee";
const STORM = "#8a909c";
const STORM_DARK = "#6b7080";

interface Part {
  geometry: BufferGeometry;
  color: string;
}

const PALM_FROND_COUNT = 6;
const PALM_CROWN = { x: 0.1, y: 0.28 };

/** A palm frond: a flat blade drooping outward from the crown. */
function palmFrond(index: number): BufferGeometry {
  const angle = (index / PALM_FROND_COUNT) * Math.PI * 2 + 0.3;
  return new BoxGeometry(0.36, 0.025, 0.1)
    .translate(0.18, 0, 0)
    .rotateZ(-0.5)
    .rotateY(angle)
    .translate(PALM_CROWN.x, PALM_CROWN.y, 0);
}

/** A sphere squashed and moved into a cloud puff. */
function cloudPuff(
  radius: number,
  x: number,
  y: number,
  z: number
): BufferGeometry {
  return new SphereGeometry(radius, 8, 6).scale(1, 0.75, 1).translate(x, y, z);
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
    case "palm":
      return [
        // Three tapered segments, each nudged sideways, make a leaning trunk.
        ...[0, 1, 2].map((i) => ({
          geometry: new CylinderGeometry(
            0.05 - i * 0.012,
            0.07 - i * 0.012,
            0.24,
            6
          ).translate(0.02 + i * 0.04, -0.38 + i * 0.24, 0),
          color: TRUNK,
        })),
        ...Array.from({ length: PALM_FROND_COUNT }, (_, i) => ({
          geometry: palmFrond(i),
          color: palette.soft,
        })),
        {
          geometry: new SphereGeometry(0.04, 6, 5).translate(0.07, 0.23, 0.03),
          color: COCONUT,
        },
        {
          geometry: new SphereGeometry(0.04, 6, 5).translate(0.14, 0.23, -0.03),
          color: COCONUT,
        },
      ];
    case "skyscraper":
      return [
        {
          geometry: new BoxGeometry(0.8, 0.6, 0.8).translate(0, -0.2, 0),
          color: palette.hard,
        },
        {
          geometry: new BoxGeometry(0.55, 0.24, 0.55).translate(0, 0.22, 0),
          color: palette.hard,
        },
        {
          geometry: new BoxGeometry(0.3, 0.04, 0.3).translate(0, 0.36, 0),
          color: ROOF,
        },
        {
          geometry: new CylinderGeometry(0.012, 0.012, 0.12, 4).translate(
            0,
            0.44,
            0
          ),
          color: ROOF,
        },
        // Window bands wrap each block, a hair proud of the walls.
        ...[-0.35, -0.15, 0.05].map((y) => ({
          geometry: new BoxGeometry(0.82, 0.06, 0.82).translate(0, y, 0),
          color: WINDOWS,
        })),
        {
          geometry: new BoxGeometry(0.57, 0.05, 0.57).translate(0, 0.22, 0),
          color: WINDOWS,
        },
      ];
    case "iceberg":
      return [
        {
          geometry: new IcosahedronGeometry(0.5, 0)
            .scale(1, 0.6, 0.9)
            .translate(0, -0.2, 0),
          color: ICE_DEEP,
        },
        {
          geometry: new DodecahedronGeometry(0.32, 0)
            .scale(0.9, 1.5, 0.9)
            .translate(-0.12, -0.02, 0.02),
          color: ICE,
        },
        {
          geometry: new DodecahedronGeometry(0.2, 0)
            .scale(1, 1.2, 1)
            .translate(0.27, -0.2, -0.1),
          color: ICE,
        },
      ];
    case "cloud":
      return [
        { geometry: cloudPuff(0.3, 0, 0.02, 0), color: STORM },
        { geometry: cloudPuff(0.25, -0.22, -0.05, 0.05), color: STORM_DARK },
        { geometry: cloudPuff(0.26, 0.22, -0.04, -0.04), color: STORM_DARK },
        { geometry: cloudPuff(0.22, -0.06, 0.1, 0.2), color: STORM },
        { geometry: cloudPuff(0.22, 0.08, 0.06, -0.22), color: STORM },
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
