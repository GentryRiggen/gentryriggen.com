import { useMemo } from "react";
import type { FunnelMark } from "@/lib/ship-builder/model/funnelLivery";
import { PALETTE } from "./palette";
import type { PartEmphasis, PartTint } from "./Surface";
import { FUNNEL_RAKE_RADIANS } from "./effectAnchors";
import FunnelMarkDecals from "./FunnelMarkDecals";
import { funnelRadiusAt } from "./funnelGeometry";
import ProceduralFunnel, { type FunnelSlotColors } from "./ProceduralFunnel";

const OPENING_COLOR = "#050505";
const PIPE_COLOR = "#b08d57";

interface FunnelMeshProps {
  /** Body radius at its base and at its top. */
  baseRadius: number;
  topRadius: number;
  bodyHeight: number;
  /** The black cap above the body. */
  capHeight: number;
  /** Paint colour for the body; the pipe keeps its own. */
  bodyColor?: string;
  /** Colours for the two bands and the black cap, when painted. */
  bandColor?: string;
  topColor?: string;
  /** Letters or a logo painted on both sides of the body. */
  mark?: FunnelMark;
  tint: PartTint;
  emphasis: PartEmphasis;
}

/**
 * A liner funnel built in code, raked aft: a body with two bands, a black cap
 * with a rolled rim and dark opening, and a steam pipe and whistle on the aft
 * side. The classic sizes are drawn from a Blender model instead (see the
 * funnel entries in glbRegistry.tsx); this is what shows while it loads, if it
 * fails, and in the studio's old build.
 */
export default function FunnelMesh({
  baseRadius,
  topRadius,
  bodyHeight,
  capHeight,
  bodyColor = PALETTE.funnel,
  bandColor,
  topColor,
  mark,
  tint,
  emphasis,
}: FunnelMeshProps) {
  const dims = { baseRadius, topRadius, bodyHeight, capHeight };
  const markHeight = bodyHeight * 0.55;
  const markRadius = funnelRadiusAt(dims, markHeight);
  const bands = bandColor ?? PALETTE.funnelBand;
  const cap = topColor ?? PALETTE.funnelTop;
  const colors = useMemo<FunnelSlotColors>(
    () => ({
      body: bodyColor,
      bands,
      cap,
      opening: OPENING_COLOR,
      pipe: PIPE_COLOR,
    }),
    [bodyColor, bands, cap]
  );

  return (
    <group rotation={[0, 0, FUNNEL_RAKE_RADIANS]}>
      <ProceduralFunnel
        {...dims}
        colors={colors}
        tint={tint}
        emphasis={emphasis}
      />
      {mark && (
        <FunnelMarkDecals
          mark={mark}
          height={markHeight}
          radius={markRadius}
          size={markRadius * 1.3}
        />
      )}
    </group>
  );
}
