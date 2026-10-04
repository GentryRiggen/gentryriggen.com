import { PALETTE } from "./palette";

export type PartTint = keyof typeof PALETTE.tint | null;
export type PartEmphasis = keyof typeof PALETTE.emphasis | null;

interface SurfaceProps {
  color: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

/**
 * The material every part mesh uses: a ghost/removal tint replaces the colour,
 * and emphasis adds a hover/selection glow.
 */
export default function Surface({ color, tint, emphasis }: SurfaceProps) {
  const ghost = tint === "ghost-ok" || tint === "ghost-bad";
  return (
    <meshStandardMaterial
      color={tint ? PALETTE.tint[tint] : color}
      transparent={ghost}
      opacity={ghost ? 0.55 : 1}
      emissive={emphasis ? PALETTE.emphasis[emphasis] : "#000000"}
      emissiveIntensity={emphasis ? 0.4 : 0}
    />
  );
}
