import { useMemo } from "react";
import type { FunnelMark } from "@/lib/ship-builder/model/funnelLivery";
import { PALETTE } from "./palette";
import type { PartEmphasis, PartTint } from "./Surface";
import { FUNNEL_RAKE_RADIANS } from "./effectAnchors";
import FunnelMarkDecals from "./FunnelMarkDecals";
import { funnelRadiusAt } from "./funnelGeometry";
import GlbSlotPart from "./GlbSlotPart";
import type { GlbSlotLook } from "./glbSlots";
import ProceduralFunnel, { type FunnelSlotColors } from "./ProceduralFunnel";
import { funnelModelUrl } from "./shipModels";

const OPENING_COLOR = "#050505";
const PIPE_COLOR = "#b08d57";

/**
 * How far the marks sit further out on the Blender funnel than on the
 * procedural one: its lapped plate seams stand 0.007 proud of the taper, and
 * the decal is a flat square, so without this it touches or sinks into the
 * seam lines above and below its centre.
 */
export const GLB_MARK_CLEARANCE = 0.008;

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

/** The glb slots: body and cap occlude and cast shadows, like before. */
function slotLooks(colors: FunnelSlotColors): Record<string, GlbSlotLook> {
  return {
    body: { color: colors.body, castShadow: true, aoOccluder: true },
    bands: { color: colors.bands },
    cap: { color: colors.cap, castShadow: true, aoOccluder: true },
    opening: { color: colors.opening },
    pipe: { color: colors.pipe, finish: "metal" },
  };
}

/**
 * A liner funnel, raked aft: a body with two bands, a black cap with a rolled
 * rim and dark opening, and a steam pipe and whistle on the aft side. The two
 * classic sizes draw the Blender model (riveted plates, a hollow rim, a guy
 * ring, a proper whistle); any other size, or the model while it loads or if
 * it fails, draws the procedural funnel.
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
  const url = funnelModelUrl(dims);
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
  const slots = useMemo(() => slotLooks(colors), [colors]);

  const marks = (radius: number) =>
    mark && (
      <FunnelMarkDecals
        mark={mark}
        height={markHeight}
        radius={radius}
        size={markRadius * 1.3}
      />
    );
  const procedural = (
    <>
      <ProceduralFunnel
        {...dims}
        colors={colors}
        tint={tint}
        emphasis={emphasis}
      />
      {marks(markRadius)}
    </>
  );

  return (
    <group rotation={[0, 0, FUNNEL_RAKE_RADIANS]}>
      {url ? (
        <GlbSlotPart
          url={url}
          slots={slots}
          tint={tint}
          emphasis={emphasis}
          fallback={procedural}
        >
          {marks(markRadius + GLB_MARK_CLEARANCE)}
        </GlbSlotPart>
      ) : (
        procedural
      )}
    </group>
  );
}
