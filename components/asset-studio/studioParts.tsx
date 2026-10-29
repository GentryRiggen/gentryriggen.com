import type { ReactElement } from "react";
import { FUNNEL_RAKE_RADIANS } from "@/components/ship-builder/scene/effectAnchors";
import { PALETTE } from "@/components/ship-builder/scene/palette";
import ProceduralFunnel from "@/components/ship-builder/scene/ProceduralFunnel";
import GlbPart, { type SlotColor } from "./GlbPart";
import { PART_SPECS, type PartSpec } from "./partSpecs";

export interface StudioPart {
  spec: PartSpec;
  /** The game's procedural part (its stand-in while the model loads). */
  Old: (props: { variant: string }) => ReactElement;
  /** The Blender-made part, in the same colours. */
  New: (props: { variant: string }) => ReactElement;
  glbPath: (variant: string) => string;
}

// Slot colours match FunnelMesh's defaults.
const FUNNEL_SLOT_COLORS: Record<string, SlotColor> = {
  body: { color: PALETTE.funnel },
  bands: { color: PALETTE.funnelBand },
  cap: { color: PALETTE.funnelTop },
  opening: { color: "#050505" },
  pipe: { color: "#b08d57", finish: "metal" },
};

const FUNNEL_COLORS = {
  body: FUNNEL_SLOT_COLORS.body.color,
  bands: FUNNEL_SLOT_COLORS.bands.color,
  cap: FUNNEL_SLOT_COLORS.cap.color,
  opening: FUNNEL_SLOT_COLORS.opening.color,
  pipe: FUNNEL_SLOT_COLORS.pipe.color,
};

function funnelGlbPath(variant: string): string {
  return `/asset-studio/funnel/${variant}.glb`;
}

function variantDims(part: string, variant: string): Record<string, number> {
  const found = PART_SPECS[part].variants.find((v) => v.name === variant);
  if (!found) throw new Error(`Unknown variant "${variant}" for ${part}`);
  return found.dims;
}

export const STUDIO_PARTS: Record<string, StudioPart> = {
  funnel: {
    spec: PART_SPECS.funnel,
    Old: function FunnelOld({ variant }) {
      const dims = variantDims("funnel", variant);
      return (
        <group rotation={[0, 0, FUNNEL_RAKE_RADIANS]}>
          <ProceduralFunnel
            baseRadius={dims.baseRadius}
            topRadius={dims.topRadius}
            bodyHeight={dims.bodyHeight}
            capHeight={dims.capHeight}
            colors={FUNNEL_COLORS}
            tint={null}
            emphasis={null}
          />
        </group>
      );
    },
    New: function FunnelNew({ variant }) {
      return (
        <GlbPart
          url={funnelGlbPath(variant)}
          slotColors={FUNNEL_SLOT_COLORS}
          rakeRadians={FUNNEL_RAKE_RADIANS}
        />
      );
    },
    glbPath: funnelGlbPath,
  },
};
