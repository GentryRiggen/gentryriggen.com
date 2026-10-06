import type { ReactNode } from "react";
import type { Rotation, Side } from "@/lib/ship-builder/model/types";
import type { PartEmphasis, PartTint } from "../Surface";

/** What every pirate fitting mesh receives; origin is the part's attach point. */
export interface PirateMeshProps {
  /** Paint colour for the part's main surface; absent means the default. */
  painted?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Side of the ship the point is on, for edge parts. */
  side?: Side;
}

export type PirateMesh = (props: PirateMeshProps) => ReactNode;

/** Grid decor gets a colour override and the rotation the player chose. */
export interface PirateDecorProps {
  color?: string;
  rotation: Rotation;
  tint: PartTint;
  emphasis: PartEmphasis;
}

export type PirateDecor = (props: PirateDecorProps) => ReactNode;

/** Wood, rope, cloth and iron shared across the pirate meshes. */
export const WOOD = {
  oak: "#9a6b3f",
  dark: "#5a3a22",
  pale: "#c9a56b",
  rope: "#cdb98a",
  canvas: "#efe6cf",
  iron: "#33383d",
  black: "#1c1c1f",
  bone: "#f1ede0",
} as const;
