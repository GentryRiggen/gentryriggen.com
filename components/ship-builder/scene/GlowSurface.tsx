"use client";

import { useRef } from "react";
import { DoubleSide, FrontSide, type MeshStandardMaterial } from "three";
import { useGlowEffect } from "./GlowContext";
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
 * the glow so editing feedback stays readable. The glow follows the eased sky
 * by writing the material directly, so a fade re-renders nothing.
 */
export default function GlowSurface({
  color,
  glowColor,
  strength,
  tint,
  emphasis,
  doubleSided = false,
}: GlowSurfaceProps) {
  const material = useRef<MeshStandardMaterial>(null);
  const ghost = tint === "ghost-ok" || tint === "ghost-bad";
  const isOverridden = Boolean(tint || emphasis);

  useGlowEffect((glow) => {
    const target = material.current;
    if (!target) return;
    // Lit surfaces skip tone mapping so they stay bright; switching it
    // recompiles the shader, so only do it when crossing zero.
    const isLit = glow > 0 && !isOverridden;
    target.emissiveIntensity = emphasis ? 0.4 : isLit ? strength * glow : 0;
    if (target.toneMapped === isLit) {
      target.toneMapped = !isLit;
      target.needsUpdate = true;
    }
  });

  return (
    <meshStandardMaterial
      ref={material}
      color={tint ? PALETTE.tint[tint] : color}
      transparent={ghost}
      opacity={ghost ? 0.55 : 1}
      side={doubleSided ? DoubleSide : FrontSide}
      emissive={emphasis ? PALETTE.emphasis[emphasis] : glowColor}
      emissiveIntensity={emphasis ? 0.4 : 0}
    />
  );
}
