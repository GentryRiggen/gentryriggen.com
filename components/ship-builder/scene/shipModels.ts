import { useGLTF } from "@react-three/drei";
import type { FunnelDims } from "./funnelGeometry";

/**
 * Blender-made part models the game loads (see assets/README.md). Each file
 * is copied in by `npm run assets:ship -- <part>` and committed.
 */
export function shipModelUrl(part: string, variant: string): string {
  return `/ship-builder/models/${part}/${variant}.glb`;
}

/** The classic funnels' sizes (PartMesh) and their models. */
export const FUNNEL_MODELS: readonly { dims: FunnelDims; url: string }[] = [
  {
    dims: {
      baseRadius: 0.42,
      topRadius: 0.38,
      bodyHeight: 2.6,
      capHeight: 0.6,
    },
    url: shipModelUrl("funnel", "funnel"),
  },
  {
    dims: {
      baseRadius: 0.71,
      topRadius: 0.65,
      bodyHeight: 3.4,
      capHeight: 0.8,
    },
    url: shipModelUrl("funnel", "funnel-large"),
  },
];

/** The model for a funnel of these exact sizes, or null for any other. */
export function funnelModelUrl(dims: FunnelDims): string | null {
  const match = FUNNEL_MODELS.find(
    (model) =>
      model.dims.baseRadius === dims.baseRadius &&
      model.dims.topRadius === dims.topRadius &&
      model.dims.bodyHeight === dims.bodyHeight &&
      model.dims.capHeight === dims.capHeight
  );
  return match?.url ?? null;
}

/** Every model the game draws. */
export const SHIP_MODEL_URLS: readonly string[] = FUNNEL_MODELS.map(
  (model) => model.url
);

/** Starts loading every model, so parts rarely show their stand-in. */
export function preloadShipModels(): void {
  for (const url of SHIP_MODEL_URLS) useGLTF.preload(url, false, false);
}
