import { useGLTF } from "@react-three/drei";
import type { GlbSlotLook } from "./glbSlots";

/**
 * The sea-environment models (assets/parts/env-*.json): the iceberg, the
 * rocks, the buoy and the passing ship. Each file is committed by
 * `npm run assets:ship -- env-<name>`. While one loads, or if it fails, the
 * obstacle draws its procedural stand-in (see ObstacleMesh.tsx).
 */
export const ENV_MODELS = {
  iceberg: { model: "env-iceberg", variants: ["iceberg", "iceberg-b"] },
  rock: { model: "env-rock", variants: ["rock", "rock-skerry", "rock-pair"] },
  buoy: { model: "env-buoy", variants: ["buoy"] },
  ship: { model: "env-ship", variants: ["ship"] },
} as const;

export type EnvName = keyof typeof ENV_MODELS;

export function envModelUrl(model: string, variant: string): string {
  return `/ship-builder/models/${model}/${variant}.glb`;
}

/** Every environment model file, for preloading and the offline cache. */
export const ENV_MODEL_URLS: readonly string[] = Object.values(
  ENV_MODELS
).flatMap(({ model, variants }) =>
  variants.map((variant) => envModelUrl(model, variant))
);

/** Starts loading every environment model, so obstacles rarely show a stand-in. */
export function preloadEnvModels(): void {
  for (const url of ENV_MODEL_URLS) useGLTF.preload(url, false, false);
}

export const ICE_TOP = "#f5fbff";
export const ICE_UNDER = "#a9d8ee";
/** How see-through the berg's underwater bulk is. */
export const ICE_UNDER_OPACITY = 0.7;
export const ROCK_COLOR = "#7b7f86";
export const ROCK_DARK = "#5d6168";
export const ROCK_WET = "#34383e";
export const BUOY_RED = "#d9342b";
export const BUOY_WHITE = "#f4f1ea";
export const BUOY_STEEL = "#3a3f45";
export const BUOY_LAMP = "#ffd84a";
/** Where the glb buoy's cage holds the lamp (model units). */
export const BUOY_LAMP_Y = 1.22;
export const SHIP_HULL = "#35506a";
export const SHIP_BOOT = "#8e2a22";
export const SHIP_CABIN = "#f1eee4";
export const SHIP_WINDOWS = "#2c3e50";

export const ICEBERG_SLOTS: Readonly<Record<string, GlbSlotLook>> = {
  top: { color: ICE_TOP, castShadow: true },
  under: { color: ICE_UNDER, opacity: ICE_UNDER_OPACITY },
};

export const ROCK_SLOTS: Readonly<Record<string, GlbSlotLook>> = {
  rock: { color: ROCK_COLOR, castShadow: true },
  layer: { color: ROCK_DARK, castShadow: true },
  wet: { color: ROCK_WET, castShadow: true },
};

export const BUOY_SLOTS: Readonly<Record<string, GlbSlotLook>> = {
  body: { color: BUOY_RED, castShadow: true },
  band: { color: BUOY_WHITE, castShadow: true },
  frame: { color: BUOY_STEEL, finish: "metal", castShadow: true },
};

export const SHIP_SLOTS: Readonly<Record<string, GlbSlotLook>> = {
  hull: { color: SHIP_HULL, castShadow: true },
  boot: { color: SHIP_BOOT, castShadow: true },
  cabin: { color: SHIP_CABIN, castShadow: true },
  windows: { color: SHIP_WINDOWS },
};
