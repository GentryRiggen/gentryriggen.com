import type { ReactNode } from "react";
import { CANNON_MESHES } from "./cannons";
import { CREW_DECOR, CREW_MESHES } from "./crew";
import { DECO_DECOR, DECO_MESHES } from "./deco";
import { SAIL_MESHES } from "./sails";
import type { PirateDecorProps, PirateMesh, PirateMeshProps } from "./shared";

export const PIRATE_FITTINGS = {
  ...SAIL_MESHES,
  ...CANNON_MESHES,
  ...DECO_MESHES,
  ...CREW_MESHES,
} satisfies Record<string, PirateMesh>;
export type PirateFittingType = keyof typeof PIRATE_FITTINGS;

export const PIRATE_DECOR = {
  ...DECO_DECOR,
  ...CREW_DECOR,
} satisfies Record<string, (props: PirateDecorProps) => ReactNode>;
export type PirateDecorType = keyof typeof PIRATE_DECOR;

export function isPirateFitting(type: string): type is PirateFittingType {
  return type in PIRATE_FITTINGS;
}

export function isPirateDecor(type: string): type is PirateDecorType {
  return type in PIRATE_DECOR;
}

export function renderPirateFitting(
  type: PirateFittingType,
  props: PirateMeshProps
): ReactNode {
  const Mesh = PIRATE_FITTINGS[type];
  return <Mesh {...props} />;
}

export function renderPirateDecor(
  type: PirateDecorType,
  props: PirateDecorProps
): ReactNode {
  const Decor = PIRATE_DECOR[type];
  return <Decor {...props} />;
}
