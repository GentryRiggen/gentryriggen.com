import { useGLTF } from "@react-three/drei";

/**
 * Course props drawn from Blender-made glbs: each is a spec
 * (`assets/parts/prop-<id>.json`) with one or more variants, built at the
 * real size in metres (the game scales only the banner and the best-wall
 * pylon), and loaded with the obstacles' loader: slot colour x baked AO into
 * one vertex-coloured geometry (`obstacleGeometryFromScene`). Anything that
 * moves, glows or carries a label (the slingshot band, flag and sign boards,
 * the banner's FINISH text, the best wall's fade) stays procedural.
 */
export const PROP_MODELS = {
  coin: { spec: "prop-coin", variant: "coin" },
  ring: { spec: "prop-ring", variant: "ring" },
  can: { spec: "prop-can", variant: "can" },
  gatePost: { spec: "prop-gatepost", variant: "post" },
  gateBanner: { spec: "prop-gatebanner", variant: "banner" },
  slingshotWood: { spec: "prop-slingshot", variant: "wood" },
  slingshotMetal: { spec: "prop-slingshot", variant: "metal" },
  slingshotPowered: { spec: "prop-slingshot-powered", variant: "powered" },
  flagPole: { spec: "prop-flagpole", variant: "flagpole" },
  signPost: { spec: "prop-signpost", variant: "signpost" },
  corridorPole: { spec: "prop-corridorpole", variant: "corridorpole" },
  bestPylon: { spec: "prop-bestpylon", variant: "pylon" },
  hangar: { spec: "prop-hangar", variant: "hangar" },
} as const;

export type PropName = keyof typeof PROP_MODELS;

export function propUrl(name: PropName): string {
  const { spec, variant } = PROP_MODELS[name];
  return `/plane-builder/models/${spec}/${variant}.glb`;
}

/** Every prop model the game can draw. */
export const PROP_MODEL_URLS: readonly string[] = (
  Object.keys(PROP_MODELS) as PropName[]
).map(propUrl);

/** Starts loading every prop model, so they rarely show their stand-in. */
export function preloadPropModels(): void {
  for (const url of PROP_MODEL_URLS) useGLTF.preload(url, false, false);
}
