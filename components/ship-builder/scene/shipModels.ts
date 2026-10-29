import { useGLTF } from "@react-three/drei";
import { GLB_PARTS } from "./glbRegistry";

/**
 * Blender-made part models the game loads (see assets/README.md). Each file
 * is copied in by `npm run assets:ship -- <part>` and committed.
 */
export function shipModelUrl(part: string, variant: string): string {
  return `/ship-builder/models/${part}/${variant}.glb`;
}

/** Every model the game draws: one per registry entry. */
export const SHIP_MODEL_URLS: readonly string[] = [
  ...new Set(
    Object.values(GLB_PARTS).map((entry) =>
      shipModelUrl(entry.model, entry.variant)
    )
  ),
];

/** Starts loading every model, so parts rarely show their stand-in. */
export function preloadShipModels(): void {
  for (const url of SHIP_MODEL_URLS) useGLTF.preload(url, false, false);
}
