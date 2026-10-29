import { useGLTF } from "@react-three/drei";
import { ENV_MODEL_URLS, preloadEnvModels } from "./envModels";
import { GLB_PARTS } from "./glbRegistry";
import { KIT_MODEL_URLS } from "./kitFiles";
import { preloadKitModels } from "./kitModels";

/**
 * Blender-made part models the game loads (see assets/README.md). Each file
 * is copied in by `npm run assets:ship -- <part>` and committed.
 */
export function shipModelUrl(part: string, variant: string): string {
  return `/ship-builder/models/${part}/${variant}.glb`;
}

/** Every model the game draws: one per registry entry, plus the detail kit and the sea environment. */
export const SHIP_MODEL_URLS: readonly string[] = [
  ...new Set(
    Object.values(GLB_PARTS).map((entry) =>
      shipModelUrl(entry.model, entry.variant)
    )
  ),
  ...KIT_MODEL_URLS,
  ...ENV_MODEL_URLS,
];

/** Starts loading every model, so parts rarely show their stand-in. */
export function preloadShipModels(): void {
  for (const url of SHIP_MODEL_URLS) {
    if (!KIT_MODEL_URLS.includes(url) && !ENV_MODEL_URLS.includes(url)) {
      useGLTF.preload(url, false, false);
    }
  }
  preloadKitModels();
  preloadEnvModels();
}
