"use client";

import { DoubleSide, FrontSide } from "three";
import { useGlow } from "./GlowContext";
import { PALETTE } from "./palette";
import type { PartEmphasis, PartTint } from "./Surface";

interface GlowSurfaceProps {
  /** The colour by day, and the diffuse colour at night. */
  color: string;
  /** Emissive colour while lit. */
  glowColor: string;
  /** Emissive intensity at full glow. */
  strength: number;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Draw both faces. */
  doubleSided?: boolean;
}

/**
 * Like Surface, but it glows at sunset and night. By day (glow 0) it renders
 * exactly like a Surface. Ghost tints and hover/selection emphasis win over
 * the glow so editing feedback stays readable.
 */
export default function GlowSurface({
  color,
  glowColor,
  strength,
  tint,
  emphasis,
  doubleSided = false,
}: GlowSurfaceProps) {
  const glow = useGlow();
  const ghost = tint === "ghost-ok" || tint === "ghost-bad";
  const isGlowing = glow > 0 && !tint && !emphasis;
  return (
    <meshStandardMaterial
      color={tint ? PALETTE.tint[tint] : color}
      transparent={ghost}
      opacity={ghost ? 0.55 : 1}
      side={doubleSided ? DoubleSide : FrontSide}
      emissive={
        emphasis
          ? PALETTE.emphasis[emphasis]
          : isGlowing
            ? glowColor
            : "#000000"
      }
      emissiveIntensity={emphasis ? 0.4 : isGlowing ? strength * glow : 0}
      toneMapped={!isGlowing}
    />
  );
}
