/**
 * The grid-block detail kit: small Blender-made pieces (a window frame, a
 * wheelhouse windscreen, a bridge-wing cab end, a porthole rim) that the
 * block and hull code place with instancing at the slots it already works
 * out. Each file holds one mesh. While a file loads, or if it fails, the
 * caller draws its procedural stand-in.
 */
export const KIT_NAMES = [
  "kit-window",
  "kit-windscreen",
  "kit-bridge-wing",
  "kit-porthole",
] as const;

export type KitName = (typeof KIT_NAMES)[number];

/** The committed file for a kit piece (`npm run assets:ship -- <name>`). */
export function kitModelUrl(name: KitName): string {
  return `/ship-builder/models/${name}/${name}.glb`;
}

export const KIT_MODEL_URLS: readonly string[] = KIT_NAMES.map(kitModelUrl);
