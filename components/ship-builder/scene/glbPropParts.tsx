import { containerColor, paintHex } from "@/lib/ship-builder/model/paint";
import type { PartType } from "@/lib/ship-builder/model/types";
import { CRUISE_COLORS } from "./cruiseColors";
import type { GlbPartEntry } from "./glbRegistry";
import { PALETTE } from "./palette";
import { WOOD } from "./pirate/shared";

/**
 * Cargo, naval, pirate and cruise props drawn from Blender models. Spinning
 * and swinging parts keep their motion in the glb's slots (`turn`, `swing`),
 * so no procedural sub-parts are needed.
 */

const NAVAL_GREY = "#8a949c";
const NAVAL_DARK = "#4b545b";
const NAVAL_DECK = "#5d666d";
const NAVAL_MARKING = "#f3efe4";
const NAVAL_ROTOR = "#2b3036";
const NAVAL_HELI = "#6f7b66";
const HELI_GLASS = "#1d2a33";
const GOLD = "#e8b923";

/** Rad/s of a turret's slow sweep and of the helicopter's main rotor. */
const TURRET_SPEED = 0.35;
const ROTOR_SPEED = 14;

function turretSlots(painted: string | undefined) {
  return {
    base: { color: NAVAL_DARK, castShadow: true, aoOccluder: true },
    turret: {
      color: painted ?? NAVAL_GREY,
      castShadow: true,
      aoOccluder: true,
      turn: TURRET_SPEED,
    },
    gun: {
      color: NAVAL_DARK,
      finish: "metal" as const,
      castShadow: true,
      turn: TURRET_SPEED,
    },
  };
}

export const PROP_GLB_PARTS: Partial<Record<PartType, GlbPartEntry>> = {
  container: {
    model: "container",
    variant: "container",
    plainYaw: true,
    slots: ({ partId, painted }) => ({
      body: {
        color: painted ?? paintHex(containerColor(partId ?? "")),
        castShadow: true,
        aoOccluder: true,
        receiveShadow: true,
      },
      steel: { color: PALETTE.containerSteel, finish: "metal" },
    }),
  },
  "crate-stack": {
    model: "crate-stack",
    variant: "crate-stack",
    facing: true,
    slots: ({ painted }) => ({
      wood: {
        color: painted ?? WOOD.oak,
        finish: "wood",
        castShadow: true,
      },
      frame: { color: WOOD.dark, finish: "wood", castShadow: true },
    }),
  },
  "barrel-stack": {
    model: "barrel-stack",
    variant: "barrel-stack",
    facing: true,
    slots: ({ painted }) => ({
      wood: {
        color: painted ?? WOOD.oak,
        finish: "wood",
        castShadow: true,
      },
      iron: { color: WOOD.iron, finish: "metal" },
    }),
  },
  "treasure-chest": {
    model: "treasure-chest",
    variant: "treasure-chest",
    facing: true,
    slots: ({ painted }) => ({
      wood: {
        color: painted ?? WOOD.dark,
        finish: "wood",
        castShadow: true,
      },
      gold: { color: GOLD, finish: "metal" },
      keyhole: { color: WOOD.black },
    }),
  },
  parrot: {
    model: "parrot",
    variant: "parrot",
    facing: true,
    slots: () => ({
      perch: { color: WOOD.dark, finish: "wood", castShadow: true },
      red: { color: "#c8312b", castShadow: true },
      yellow: { color: "#f2c230" },
      blue: { color: "#2f7fc1" },
      white: { color: WOOD.bone },
      eye: { color: WOOD.black },
    }),
  },
  "turret-small": {
    model: "turret-small",
    variant: "turret-small",
    slots: ({ painted }) => turretSlots(painted),
  },
  "turret-large": {
    model: "turret-large",
    variant: "turret-large",
    slots: ({ painted }) => turretSlots(painted),
  },
  helicopter: {
    model: "helicopter",
    variant: "helicopter",
    slots: ({ painted }) => ({
      body: {
        color: painted ?? NAVAL_HELI,
        castShadow: true,
        aoOccluder: true,
      },
      glass: { color: HELI_GLASS, finish: "glass" },
      dark: { color: NAVAL_DARK },
      rotor: { color: NAVAL_ROTOR, turn: ROTOR_SPEED },
    }),
  },
  helipad: {
    model: "helipad",
    variant: "helipad",
    slots: ({ painted }) => ({
      pad: {
        color: painted ?? NAVAL_DECK,
        castShadow: true,
        aoOccluder: true,
        receiveShadow: true,
      },
      marking: { color: NAVAL_MARKING },
    }),
  },
  "cargo-crane": {
    model: "cargo-crane",
    variant: "cargo-crane",
    slots: ({ painted }) => {
      const body = painted ?? PALETTE.crane;
      return {
        base: {
          color: PALETTE.hatchCover,
          castShadow: true,
          aoOccluder: true,
        },
        pedestal: { color: body, castShadow: true, aoOccluder: true },
        slew: { color: body, castShadow: true, swing: true },
        slewSteel: {
          color: PALETTE.containerSteel,
          finish: "metal",
          castShadow: true,
          swing: true,
        },
        slewWindow: { color: PALETTE.bridgeWindows, swing: true },
      };
    },
  },
  "climbing-wall": {
    model: "climbing-wall",
    variant: "climbing-wall",
    slots: ({ painted }) => ({
      wall: {
        color: painted ?? CRUISE_COLORS.wall,
        castShadow: true,
        aoOccluder: true,
      },
      holdRed: { color: CRUISE_COLORS.holds[0] },
      holdYellow: { color: CRUISE_COLORS.holds[1] },
      holdBlue: { color: CRUISE_COLORS.holds[2] },
      holdGreen: { color: CRUISE_COLORS.holds[3] },
    }),
  },
  waterslide: {
    model: "waterslide",
    variant: "waterslide",
    slots: ({ painted }) => ({
      tower: {
        color: CRUISE_COLORS.slideTower,
        castShadow: true,
        aoOccluder: true,
      },
      tube: { color: painted ?? CRUISE_COLORS.slideTube, castShadow: true },
    }),
  },
};
