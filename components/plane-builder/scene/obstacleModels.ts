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
  cloud: ["puff", "storm"],
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
  windows: "#9bd3f7",
  roof: "#6d747c",
  ice: "#e6f6ff",
  ice_deep: "#b4d8ee",
  cloud_top: "#fbfcff",
  cloud_mid: "#eef2f9",
  cloud_base: "#dde5f0",
  trim: "#f6f3ea",
  basket: "#9a6b3a",
  beak: "#f2b632",
  // Course props (propModels.ts): the same table and loader.
  coin_gold: "#fbbf24",
  coin_rim: "#d99a0b",
  ring_blue: "#38bdf8",
  ring_white: "#f4fbff",
  can_red: "#ef4444",
  can_dark: "#3f3f46",
  can_cap: "#fbbf24",
  check_black: "#111827",
  check_white: "#f9fafb",
  banner_red: "#dc2626",
  banner_trim: "#f9fafb",
  frame: "#8b5a2b",
  dark: "#3f3f46",
  glow: "#22d3ee",
  pole_light: "#e5e7eb",
  pole_cap: "#f59e0b",
  sign_frame: "#334155",
  wall_blue: "#38bdf8",
  tarmac: "#4b5563",
  paint_white: "#f3f4f6",
  paint_yellow: "#facc15",
};

/** Slot colours a variant draws in place of the fixed table's (a storm's greys). */
export const VARIANT_SLOT_COLORS: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  "slingshot/metal": { frame: "#9aa4b2" },
  "slingshot-powered/powered": { frame: "#9aa4b2" },
  "cloud/storm": {
    cloud_top: "#dfe3ec",
    cloud_mid: "#b8bfcc",
    cloud_base: "#939bab",
  },
};

export const OBSTACLE_SLOTS: readonly string[] = [
  "soft",
  "hard",
  "palette_trim",
  "palette_ground",
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

/**
 * The obstacle models one level draws: only its own kinds, and only the
 * variants a clouds-or-hash pick can reach in it.
 */
export function obstacleModelUrlsFor(
  obstacles: readonly Obstacle[],
  levelId?: string
): string[] {
  const urls = new Set<string>();
  for (const o of obstacles) {
    // Clouds are sprite puffs; their glbs are only a fallback, not preloaded.
    if (o.kind === "cloud") continue;
    urls.add(obstacleModelUrl(o.kind, obstacleVariant(o, levelId)));
  }
  return [...urls];
}

/**
 * Starts loading a level's obstacle models, so they rarely show their
 * stand-in. Other worlds' models load when that world is picked.
 */
export function preloadObstacleModels(
  obstacles: readonly Obstacle[],
  levelId?: string
): void {
  for (const url of obstacleModelUrlsFor(obstacles, levelId)) {
    useGLTF.preload(url, false, false);
  }
}

/**
 * Which variant an obstacle draws: a stable hash of where it stands, so a
 * level looks the same every run and every viewer.
 */
export function obstacleVariant(obstacle: Obstacle, levelId?: string): string {
  const variants = OBSTACLE_VARIANTS[obstacle.kind];
  if (variants.length === 1) return variants[0];
  // Clouds follow the weather, not a hash: a storm level draws thunderheads.
  if (obstacle.kind === "cloud") return levelId === "storm" ? "storm" : "puff";
  const { x, z } = obstacle.center;
  const hash =
    Math.imul(Math.round(x * 4), 73856093) ^
    Math.imul(Math.round(z * 4), 19349663);
  return variants[(hash >>> 0) % variants.length];
}

/**
 * The baked AO never darkens below this, and a slot's colour is raised to
 * `PAINT_LIFT` (a power under 1 brightens dark colours most). The sun sits
 * ahead of the chase camera, so the faces it sees are lit only by the sky:
 * without these, dark slot colours (a jungle's green, a city's steel) read as
 * black from behind.
 */
const MIN_OCCLUSION = 0.75;
const PAINT_LIFT = 0.7;

/**
 * Brightness multipliers (above 1 is fine, colours are floats): clouds are lit
 * only by the cool sky from the camera's side, so their paint is pushed up to
 * keep a white cloud white.
 */
const SLOT_GAIN: Readonly<Record<string, number>> = {
  cloud_top: 2.6,
  cloud_mid: 2.4,
  cloud_base: 2.1,
  windows: 1.5,
  snow: 1.3,
  // Pickups keep their emissive glow (Pickups.tsx); these markers have none.
  wall_blue: 1.6,
  glow: 3,
  paint_white: 1.2,
  paint_yellow: 1.2,
  check_white: 1.2,
};

/**
 * Extra gain for a palette slot on one kind (`kind/slot`): the level palettes
 * paint a city's towers steel and a jungle's trees deep green, which the sky
 * alone lights to near black.
 */
const KIND_SLOT_GAIN: Readonly<Record<string, number>> = {
  "skyscraper/hard": 2.0,
  "tree/soft": 1.5,
  "palm/soft": 1.5,
  "barn/hard": 1.3,
  "wall/soft": 1.5,
  "arch/soft": 1.5,
};

function kindOf(url: string): string {
  return /obstacle-(\w+)\//.exec(url)?.[1] ?? "";
}

function slotColor(slot: string, palette: LevelPalette, url: string): string {
  if (slot === "soft") return palette.soft;
  if (slot === "hard") return palette.hard;
  if (slot === "palette_trim") return palette.trim;
  if (slot === "palette_ground") return palette.ground;
  const variantKey = /(?:obstacle|prop)-([\w-]+)\/([\w-]+)\.glb$/.exec(url);
  const own =
    variantKey && VARIANT_SLOT_COLORS[`${variantKey[1]}/${variantKey[2]}`];
  return own?.[slot] ?? FIXED_SLOT_COLORS[slot];
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
      const paint = new Color(slotColor(slot, palette, url));
      paint.setRGB(
        paint.r ** PAINT_LIFT,
        paint.g ** PAINT_LIFT,
        paint.b ** PAINT_LIFT
      );
      const gain =
        (SLOT_GAIN[slot] ?? 1) *
        (KIND_SLOT_GAIN[`${kindOf(url)}/${slot}`] ?? 1);
      paint.multiplyScalar(gain);
      const baked = geometry.getAttribute("color");
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        const occlusion = baked ? Math.max(MIN_OCCLUSION, baked.getX(i)) : 1;
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
