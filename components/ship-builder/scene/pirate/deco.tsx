import type { ReactNode } from "react";
import { CrateDecor, CrateMesh } from "./fallback";
import type { PirateDecor, PirateMesh } from "./shared";
import type { PartEmphasis, PartTint } from "../Surface";

/** Task 5 replaces these crates with the figurehead and the rowboat. */
export const DECO_MESHES = {
  figurehead: CrateMesh,
  rowboat: CrateMesh,
} satisfies Record<string, PirateMesh>;

/** Task 5 replaces these crates with the anchor, barrels, crates and chest. */
export const DECO_DECOR = {
  "ship-anchor": CrateDecor,
  "barrel-stack": CrateDecor,
  "crate-stack": CrateDecor,
  "treasure-chest": CrateDecor,
} satisfies Record<string, PirateDecor>;

interface HelmWheelMeshProps {
  tint: PartTint;
  emphasis: PartEmphasis;
}

/** Task 5 draws the wheel and binnacle on the helm block's roof. */
export function HelmWheelMesh(props: HelmWheelMeshProps): ReactNode {
  void props;
  return null;
}

interface CaptainCabinTrimProps {
  size: { x: number; z: number };
  tint: PartTint;
  emphasis: PartEmphasis;
}

/** Task 5 draws the stern windows on the captain's cabin block. */
export function CaptainCabinTrim(props: CaptainCabinTrimProps): ReactNode {
  void props;
  return null;
}
