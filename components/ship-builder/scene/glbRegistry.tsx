import type { ReactNode } from "react";
import type { FunnelMark } from "@/lib/ship-builder/model/funnelLivery";
import type { PartType, Rotation, Side } from "@/lib/ship-builder/model/types";
import { FUNNEL_RAKE_RADIANS } from "./effectAnchors";
import FunnelMarkDecals from "./FunnelMarkDecals";
import { funnelRadiusAt, type FunnelDims } from "./funnelGeometry";
import type { GlbSlotLook } from "./glbSlots";
import { CRUISE_COLORS } from "./cruiseColors";
import { DECK_GLB_PARTS } from "./glbDeckParts";
import { PALETTE } from "./palette";
import type { PartEmphasis, PartTint } from "./Surface";

/** A funnel's body, band and top colours as hex (from the ship's livery). */
export interface FunnelHexColors {
  body?: string;
  bands?: string;
  top?: string;
}

/**
 * What PartMesh knows about a placed part, for a registry entry to use: the
 * same values its procedural fitting receives, so a sub-part can be built
 * from them (a ghost tint must reach every sub-part).
 */
export interface GlbPartContext {
  /** Paint on the part's main surface, as hex. */
  painted?: string;
  funnelPaint?: FunnelHexColors;
  mark?: FunnelMark;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Which side of the ship an attach part sits on. */
  side?: Side;
  /** Offset to the other mast's top, for an aerial or string lights. */
  wireTarget?: [number, number, number];
  /** Half the parent bridge's width, for navigation lights. */
  bridgeHalfSpan?: number;
  /** A grid part's footprint size in cells (after rotation). */
  size?: { x: number; z: number };
  rotation: Rotation;
}

/**
 * One part drawn from a Blender-made glb. Adding a part to the game is its
 * committed glb (`npm run assets:ship -- <id>`) plus one entry below; a part
 * with no entry keeps its procedural mesh.
 */
export interface GlbPartEntry {
  /** The directory under public/ship-builder/models/ (the spec's id). */
  model: string;
  /** The file name there, without `.glb`. For a single-variant part, its id. */
  variant: string;
  /** Tilt about Z, like a funnel's rake. Applies to the model and sub-parts. */
  rakeRadians?: number;
  /**
   * The model faces local +X and turns with the part's rotation, like a
   * procedural deck fitting wrapped in `Facing` (see facingYaw). The model
   * and its sub-parts turn; the fallback already carries its own facing.
   */
  facing?: boolean;
  /** How each slot of the file is drawn, given the part's paint. */
  slots: (context: GlbPartContext) => Record<string, GlbSlotLook>;
  /**
   * Procedural sub-parts to keep: anything the model does not contain because
   * it varies at run time or moves (a spinning propeller, a flag, wires to
   * another mast, glow lights, decals fitted to the surface). They are drawn
   * together with the loaded model, inside its rake, and not at all while the
   * fallback is showing (the fallback is the whole procedural part, sub-parts
   * included). A sub-part should use `Surface` with the same tint and emphasis
   * so ghosts and removal tints still work.
   */
  subParts?: (context: GlbPartContext) => ReactNode;
}

/**
 * How far the marks sit further out on the Blender funnel than on the
 * procedural one: its lapped plate seams stand 0.007 proud of the taper, and
 * the decal is a flat square, so without this it touches or sinks into the
 * seam lines above and below its centre.
 */
export const GLB_MARK_CLEARANCE = 0.008;

export const FUNNEL_DIMS: FunnelDims = {
  baseRadius: 0.42,
  topRadius: 0.38,
  bodyHeight: 2.6,
  capHeight: 0.6,
};

export const FUNNEL_LARGE_DIMS: FunnelDims = {
  baseRadius: 0.71,
  topRadius: 0.65,
  bodyHeight: 3.4,
  capHeight: 0.8,
};

const OPENING_COLOR = "#050505";
const PIPE_COLOR = "#b08d57";

/** The funnel slots: body and cap occlude and cast shadows. */
function funnelSlots({ funnelPaint }: GlbPartContext) {
  return {
    body: {
      color: funnelPaint?.body ?? PALETTE.funnel,
      castShadow: true,
      aoOccluder: true,
    },
    bands: { color: funnelPaint?.bands ?? PALETTE.funnelBand },
    cap: {
      color: funnelPaint?.top ?? PALETTE.funnelTop,
      castShadow: true,
      aoOccluder: true,
    },
    opening: { color: OPENING_COLOR },
    pipe: { color: PIPE_COLOR, finish: "metal" as const },
  };
}

/** The letters or logo painted on both sides, fitted to the glb body. */
function funnelMarks(dims: FunnelDims, { mark }: GlbPartContext): ReactNode {
  if (!mark) return null;
  const height = dims.bodyHeight * 0.55;
  const radius = funnelRadiusAt(dims, height);
  return (
    <FunnelMarkDecals
      mark={mark}
      height={height}
      radius={radius + GLB_MARK_CLEARANCE}
      size={radius * 1.3}
    />
  );
}

const MODERN_FUNNEL_DEFAULT_BODY = "#3b7cc4";
const MODERN_FUNNEL_DEFAULT_TOP = "#2e3338";
/** The glb shell's half-width across the ship at the mark's height (1.44). */
const MODERN_FUNNEL_MARK_RADIUS = 0.2705;

/** The modern funnel: the livery body colour and a dark metal grille. */
function modernFunnelSlots({ funnelPaint }: GlbPartContext) {
  return {
    body: {
      color: funnelPaint?.body ?? MODERN_FUNNEL_DEFAULT_BODY,
      castShadow: true,
      aoOccluder: true,
    },
    grille: {
      color: funnelPaint?.top ?? MODERN_FUNNEL_DEFAULT_TOP,
      finish: "metal" as const,
    },
  };
}

/** Every part drawn from a glb. Procedural-only parts are not listed. */
export const GLB_PARTS: Partial<Record<PartType, GlbPartEntry>> = {
  funnel: {
    model: "funnel",
    variant: "funnel",
    rakeRadians: FUNNEL_RAKE_RADIANS,
    slots: funnelSlots,
    subParts: (context) => funnelMarks(FUNNEL_DIMS, context),
  },
  "funnel-large": {
    model: "funnel",
    variant: "funnel-large",
    rakeRadians: FUNNEL_RAKE_RADIANS,
    slots: funnelSlots,
    subParts: (context) => funnelMarks(FUNNEL_LARGE_DIMS, context),
  },
  propeller: {
    model: "propeller",
    variant: "propeller",
    slots: ({ painted }) => ({
      propeller: {
        color: painted ?? PALETTE.propeller,
        castShadow: true,
        spin: true,
      },
    }),
  },
  rudder: {
    model: "rudder",
    variant: "rudder",
    slots: ({ painted }) => ({
      rudder: { color: painted ?? PALETTE.propeller, castShadow: true },
    }),
  },
  azipod: {
    model: "azipod",
    variant: "azipod",
    slots: ({ painted }) => ({
      pod: {
        color: painted ?? CRUISE_COLORS.azipod,
        castShadow: true,
        aoOccluder: true,
      },
      propeller: {
        color: CRUISE_COLORS.azipodBlade,
        castShadow: true,
        spin: true,
      },
    }),
  },
  "funnel-modern": {
    model: "funnel-modern",
    variant: "funnel-modern",
    rakeRadians: FUNNEL_RAKE_RADIANS,
    slots: modernFunnelSlots,
    subParts: ({ mark }) =>
      mark ? (
        <FunnelMarkDecals
          mark={mark}
          height={1.44}
          radius={MODERN_FUNNEL_MARK_RADIUS + GLB_MARK_CLEARANCE}
          size={0.36}
        />
      ) : null,
  },
  ...DECK_GLB_PARTS,
};
