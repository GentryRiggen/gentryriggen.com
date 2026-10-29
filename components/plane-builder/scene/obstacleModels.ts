import { useGLTF } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Color, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { slotMeshesOf } from "@/components/ship-builder/scene/glbSlots";
import type {
  LevelPalette,
  Obstacle,
  ObstacleKind,
} from "@/lib/plane-builder/levels/types";

/**
 * Obstacles drawn from Blender-made glbs. Each kind is a spec
 * (`assets/parts/obstacle-<kind>.json`) with one or two variants; a variant is
 * one glb, `public/plane-builder/models/obstacle-<kind>/<variant>.glb`, built
 * to fill the unit box (-0.5..0.5) so an instance's scale stretches it to the
 * obstacle's half-extents, exactly like the procedural shape it replaces.
 */
export const OBSTACLE_VARIANTS: Readonly<
  Record<ObstacleKind, readonly string[]>
> = {
  tree: ["pine", "broadleaf"],
  barn: ["barn"],
  balloon: ["balloon"],
  wall: ["wall"],
  arch: ["arch"],
  bird: ["gull"],
  peak: ["peak"],
  palm: ["palm"],
  skyscraper: ["deco", "glass"],
  iceberg: ["iceberg"],
  cloud: ["cumulus"],
};

/**
 * The size, in metres, a typical obstacle of the kind is stretched to. The
 * models are drawn at this aspect before being fitted to the unit box, and the
 * asset studio draws them at it.
 */
export const OBSTACLE_TYPICAL_SIZE: Readonly<
  Record<ObstacleKind, readonly [number, number, number]>
> = {
  tree: [4, 10, 4],
  barn: [16, 12, 20],
  balloon: [5, 6, 5],
  wall: [30, 90, 12],
  arch: [12, 40, 16],
  bird: [3, 2, 3],
  peak: [44, 120, 44],
  palm: [6, 18, 6],
  skyscraper: [20, 140, 20],
  iceberg: [36, 52, 28],
  cloud: [28, 14, 28],
};

/**
 * Colours for the glb's material slots that do not come from the level
 * palette (`soft` and `hard` do). These are the constants the procedural
 * shapes used, plus a few trims.
 */
export const FIXED_SLOT_COLORS: Readonly<Record<string, string>> = {
  trunk: "#7a4e2d",
  rock: "#8a8680",
  rock_dark: "#6f6a64",
  snow: "#f5f8ff",
  bird: "#3a3a46",
  bird_light: "#eef0f4",
  string: "#e8e8e8",
  coconut: "#5b3a1e",
  windows: "#cfe6f5",
  roof: "#4a5057",
  ice: "#e6f6ff",
  ice_deep: "#b4d8ee",
  storm: "#8a909c",
  storm_dark: "#6b7080",
  trim: "#f6f3ea",
  basket: "#9a6b3a",
  beak: "#f2b632",
};

export const OBSTACLE_SLOTS: readonly string[] = [
  "soft",
  "hard",
  ...Object.keys(FIXED_SLOT_COLORS),
];

export function obstacleModelUrl(kind: ObstacleKind, variant: string): string {
  return `/plane-builder/models/obstacle-${kind}/${variant}.glb`;
}

/** Every obstacle model the game can draw. */
export const OBSTACLE_MODEL_URLS: readonly string[] = (
  Object.keys(OBSTACLE_VARIANTS) as ObstacleKind[]
).flatMap((kind) =>
  OBSTACLE_VARIANTS[kind].map((variant) => obstacleModelUrl(kind, variant))
);

/** Starts loading every obstacle model, so they rarely show their stand-in. */
export function preloadObstacleModels(): void {
  for (const url of OBSTACLE_MODEL_URLS) useGLTF.preload(url, false, false);
}

/**
 * Which variant an obstacle draws: a stable hash of where it stands, so a
 * level looks the same every run and every viewer.
 */
export function obstacleVariant(obstacle: Obstacle): string {
  const variants = OBSTACLE_VARIANTS[obstacle.kind];
  if (variants.length === 1) return variants[0];
  const { x, z } = obstacle.center;
  const hash =
    Math.imul(Math.round(x * 4), 73856093) ^
    Math.imul(Math.round(z * 4), 19349663);
  return variants[(hash >>> 0) % variants.length];
}

function slotColor(slot: string, palette: LevelPalette): string {
  if (slot === "soft") return palette.soft;
  if (slot === "hard") return palette.hard;
  return FIXED_SLOT_COLORS[slot];
}

/**
 * One merged geometry with a `color` attribute from a loaded glb: each mesh's
 * slot colour (from the palette or the fixed table) times its baked ambient
 * occlusion (COLOR_0, where it has one). One draw call per kind and variant.
 */
export function obstacleGeometryFromScene(
  scene: Object3D,
  palette: LevelPalette,
  url: string
): BufferGeometry {
  const parts = slotMeshesOf(scene, OBSTACLE_SLOTS, url).map(
    ({ slot, geometry, matrix }) => {
      const part = new BufferGeometry();
      part.setAttribute("position", geometry.getAttribute("position").clone());
      part.setAttribute("normal", geometry.getAttribute("normal").clone());
      if (geometry.index) part.setIndex(geometry.index.clone());
      if (matrix) part.applyMatrix4(matrix);
      const count = part.getAttribute("position").count;
      const paint = new Color(slotColor(slot, palette));
      const baked = geometry.getAttribute("color");
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        const occlusion = baked ? baked.getX(i) : 1;
        colors[i * 3] = paint.r * occlusion;
        colors[i * 3 + 1] = paint.g * occlusion;
        colors[i * 3 + 2] = paint.b * occlusion;
      }
      part.setAttribute("color", new BufferAttribute(colors, 3));
      return part;
    }
  );
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error(`Could not merge the meshes of ${url}`);
  for (const part of parts) part.dispose();
  return merged;
}
