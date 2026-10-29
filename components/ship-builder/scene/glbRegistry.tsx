import type { ReactNode } from "react";
import type { FunnelMark } from "@/lib/ship-builder/model/funnelLivery";
import type { PartType, Rotation, Side } from "@/lib/ship-builder/model/types";
import { FUNNEL_RAKE_RADIANS } from "./effectAnchors";
import FunnelMarkDecals from "./FunnelMarkDecals";
import { funnelRadiusAt, type FunnelDims } from "./funnelGeometry";
import type { GlbSlotLook } from "./glbSlots";
import { CRUISE_COLORS } from "./cruiseColors";
import { DECK_GLB_PARTS } from "./glbDeckParts";
import { PROP_GLB_PARTS } from "./glbPropParts";
import { AerialWires, SternFlagCloth } from "./fittingDecor";
import { LIGHT_COLORS } from "./lightColors";
import { NavLightsLamps } from "./lightParts";
import { RadarScanner } from "./navyParts";
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
  /** The part's id, which picks a container's colour; absent for ghosts. */
  partId?: string;
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
   * The model is built for the starboard side (outboard is +Z). On the port
   * side it is turned half a circle about the vertical so it faces outboard.
   */
  faceOutward?: boolean;
  /**
   * The model faces local +X and turns with the part's rotation, like a
   * procedural deck fitting wrapped in `Facing` (see facingYaw). The model
   * and its sub-parts turn; the fallback already carries its own facing.
   */
  facing?: boolean;
  /**
   * The model turns by the rotation's plain angle about the vertical (0, 90,
   * 180, 270 degrees), like the container mesh, not by `facingYaw`. The
   * fallback carries its own turn, as with `facing`.
   */
  plainYaw?: boolean;
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

const RIB_FLOOR_COLOR = "#4b545b";
const RIB_TUBE_COLOR = "#69727a";

/** An open lifeboat: hull in the paint (or the boat's own colour), cover and gunwale as wood. */
function openBoatSlots(hullSlot: string, hullDefault: string) {
  return ({ painted }: GlbPartContext) => ({
    [hullSlot]: { color: painted ?? hullDefault, castShadow: true },
    boatCover: { color: PALETTE.boatCover, finish: "wood" as const },
    gunwale: { color: PALETTE.gunwale, finish: "wood" as const },
  });
}

function davitSlots({ painted }: GlbPartContext) {
  return {
    davit: { color: painted ?? PALETTE.davit, finish: "metal" as const },
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
  "lifeboat-standard": {
    model: "lifeboat-standard",
    variant: "lifeboat-standard",
    slots: openBoatSlots("lifeboat", PALETTE.lifeboat),
  },
  "lifeboat-large": {
    model: "lifeboat-large",
    variant: "lifeboat-large",
    slots: openBoatSlots("lifeboat", PALETTE.lifeboat),
  },
  "lifeboat-collapsible": {
    model: "lifeboat-collapsible",
    variant: "lifeboat-collapsible",
    slots: openBoatSlots("collapsible", PALETTE.collapsible),
  },
  "lifeboat-enclosed": {
    model: "lifeboat-enclosed",
    variant: "lifeboat-enclosed",
    slots: ({ painted }) => ({
      "paint-f08a24": {
        color: painted ?? CRUISE_COLORS.enclosedBoat,
        castShadow: true,
      },
      lifeboat: { color: CRUISE_COLORS.enclosedCanopy },
      bridgeWindows: {
        color: CRUISE_COLORS.enclosedWindow,
        finish: "glass" as const,
      },
    }),
  },
  "lifeboat-freefall": {
    model: "lifeboat-freefall",
    variant: "lifeboat-freefall",
    slots: ({ painted }) => ({
      freefallRamp: { color: PALETTE.freefallRamp, castShadow: true },
      freefallBoat: {
        color: painted ?? PALETTE.freefallBoat,
        castShadow: true,
      },
      bridgeWindows: { color: PALETTE.bridgeWindows },
      containerSteel: { color: PALETTE.containerSteel },
    }),
  },
  "rib-boat": {
    model: "rib-boat",
    variant: "rib-boat",
    slots: ({ painted }) => ({
      "paint-4b545b": { color: RIB_FLOOR_COLOR },
      "paint-69727a": { color: painted ?? RIB_TUBE_COLOR, castShadow: true },
    }),
  },
  "raft-canister": {
    model: "raft-canister",
    variant: "raft-canister",
    faceOutward: true,
    slots: ({ painted }) => ({
      lifeboat: { color: painted ?? CRUISE_COLORS.raft, castShadow: true },
      "paint-f08a24": { color: CRUISE_COLORS.raftBand },
    }),
  },
  davit: {
    model: "davit",
    variant: "davit",
    faceOutward: true,
    slots: davitSlots,
  },
  "davit-side": {
    model: "davit-side",
    variant: "davit-side",
    faceOutward: true,
    slots: davitSlots,
  },
  ...DECK_GLB_PARTS,
  ...PROP_GLB_PARTS,
  mast: {
    model: "mast",
    variant: "mast",
    slots: ({ painted }) => ({
      mast: {
        color: painted ?? PALETTE.mast,
        finish: "wood",
        castShadow: true,
      },
      rings: { color: "#d9cdb4", finish: "metal" },
    }),
  },
  "crows-nest": {
    model: "crows-nest",
    variant: "crows-nest",
    slots: ({ painted }) => ({
      nestBasket: {
        color: painted ?? PALETTE.nestBasket,
        finish: "wood",
        castShadow: true,
      },
      mast: { color: PALETTE.mast, finish: "wood" },
    }),
  },
  "radar-mast": {
    model: "radar-mast",
    variant: "radar-mast",
    slots: ({ painted }) => ({
      mast: { color: painted ?? "#8a949c", castShadow: true },
      equipment: { color: "#4b545b", castShadow: true },
      dome: { color: "#e4e8ea" },
    }),
    subParts: ({ painted, tint, emphasis }) => (
      <RadarScanner painted={painted} tint={tint} emphasis={emphasis} />
    ),
  },
  "wireless-aerial": {
    model: "wireless-aerial",
    variant: "wireless-aerial",
    slots: () => ({
      spreader: { color: PALETTE.aerialWire, finish: "metal" },
      insulator: { color: "#e6e0d2" },
    }),
    subParts: ({ wireTarget, tint, emphasis }) =>
      wireTarget ? (
        <AerialWires target={wireTarget} tint={tint} emphasis={emphasis} />
      ) : null,
  },
  "stern-flag": {
    model: "stern-flag",
    variant: "stern-flag",
    slots: () => ({
      pole: { color: PALETTE.railing, finish: "wood", castShadow: true },
      fittings: { color: "#d4a94a", finish: "metal" },
    }),
    subParts: ({ painted, tint, emphasis }) => (
      <SternFlagCloth
        painted={painted}
        tint={tint}
        emphasis={emphasis}
        isGhost={tint === "ghost-ok" || tint === "ghost-bad"}
      />
    ),
  },
  "nav-lights": {
    model: "nav-lights",
    variant: "nav-lights",
    slots: ({ painted }) => ({
      housing: { color: painted ?? LIGHT_COLORS.housing, castShadow: true },
      pole: { color: painted ?? PALETTE.mast },
    }),
    subParts: ({ painted, tint, emphasis, bridgeHalfSpan }) => (
      <NavLightsLamps
        halfSpan={bridgeHalfSpan ?? 1}
        painted={painted}
        tint={tint}
        emphasis={emphasis}
        bareMasthead
      />
    ),
  },
};
