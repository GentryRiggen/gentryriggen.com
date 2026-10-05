import { DoubleSide, FrontSide } from "three";
import { PALETTE } from "./palette";

export type PartTint = keyof typeof PALETTE.tint | null;
export type PartEmphasis = keyof typeof PALETTE.emphasis | null;

/** How a surface catches the light: satin paint, glass, metal or wood. */
export type SurfaceFinish = "paint" | "glass" | "metal" | "wood";

export const FINISHES: Record<
  SurfaceFinish,
  { roughness: number; metalness: number }
> = {
  paint: { roughness: 0.55, metalness: 0 },
  glass: { roughness: 0.1, metalness: 0 },
  metal: { roughness: 0.4, metalness: 0.6 },
  wood: { roughness: 0.8, metalness: 0 },
};

interface SurfaceProps {
  color: string;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Opacity when not a ghost (glass); ghosts are always 0.55. */
  opacity?: number;
  /** Draw both faces, for flat cloth and open shells. */
  doubleSided?: boolean;
  /** Defaults to satin paint. */
  finish?: SurfaceFinish;
}

/**
 * The material every part mesh uses: a ghost/removal tint replaces the colour,
 * and emphasis adds a hover/selection glow.
 */
export default function Surface({
  color,
  tint,
  emphasis,
  opacity = 1,
  doubleSided = false,
  finish = "paint",
}: SurfaceProps) {
  const ghost = tint === "ghost-ok" || tint === "ghost-bad";
  const alpha = ghost ? 0.55 : opacity;
  return (
    <meshStandardMaterial
      color={tint ? PALETTE.tint[tint] : color}
      transparent={alpha < 1}
      opacity={alpha}
      side={doubleSided ? DoubleSide : FrontSide}
      emissive={emphasis ? PALETTE.emphasis[emphasis] : "#000000"}
      emissiveIntensity={emphasis ? 0.4 : 0}
      roughness={FINISHES[finish].roughness}
      metalness={FINISHES[finish].metalness}
    />
  );
}
