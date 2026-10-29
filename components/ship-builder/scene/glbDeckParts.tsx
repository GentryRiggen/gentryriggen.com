import type { PartType } from "@/lib/ship-builder/model/types";
import { DECOR_COLORS } from "./decorColors";
import type { GlbPartContext, GlbPartEntry } from "./glbRegistry";
import GlowSurface from "./GlowSurface";
import { GlowBeam, GlowHalo, GlowPool } from "./GlowShapes";
import { DECK_POOL_Y, LIGHT_COLORS } from "./lightColors";
import { PALETTE } from "./palette";
import { WOOD } from "./pirate/shared";

/**
 * The deck fittings drawn from Blender models. Bodies are in the glb; lenses,
 * globes and light beams stay procedural (sub-parts) because the game lights
 * them at sunset and night. Decor parts turn with the player's rotation
 * (`facing`), like the procedural meshes they replace.
 */

/** Same numbers as the procedural floodlight in deckDecor.tsx. */
const FLOOD_POLE_HEIGHT = 0.95;
const FLOOD_TILT = 0.95;
const FLOOD_BEAM_LENGTH = FLOOD_POLE_HEIGHT / Math.sin(FLOOD_TILT);
const FLOOD_POOL_X = 0.04 + FLOOD_POLE_HEIGHT / Math.tan(FLOOD_TILT);

function deckLampLights({ tint, emphasis }: GlbPartContext) {
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh position={[0, 0.88, 0]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <GlowSurface
          color={DECOR_COLORS.lampGlass}
          glowColor={LIGHT_COLORS.deckLamp}
          strength={1.6}
          {...surface}
        />
      </mesh>
      <GlowHalo
        radius={0.24}
        color={LIGHT_COLORS.deckLamp}
        strength={0.22}
        position={[0, 0.88, 0]}
      />
      <GlowPool
        radius={0.7}
        color={LIGHT_COLORS.deckLamp}
        strength={0.35}
        position={[0, DECK_POOL_Y, 0]}
      />
    </group>
  );
}

function floodlightLights({ tint, emphasis }: GlbPartContext) {
  const surface = { tint, emphasis };
  return (
    <group>
      <group
        position={[0.04, 0.04 + FLOOD_POLE_HEIGHT, 0]}
        rotation={[0, 0, -FLOOD_TILT]}
      >
        <mesh position={[0.115, 0, 0]}>
          <boxGeometry args={[0.02, 0.13, 0.27]} />
          <GlowSurface
            color={LIGHT_COLORS.floodLens}
            glowColor={LIGHT_COLORS.floodLens}
            strength={2.2}
            {...surface}
          />
        </mesh>
        <GlowBeam
          length={FLOOD_BEAM_LENGTH}
          startRadius={0.14}
          endRadius={0.6}
          color={LIGHT_COLORS.floodBeam}
          strength={0.28}
          position={[0.12, 0, 0]}
        />
      </group>
      <GlowPool
        radius={0.95}
        color={LIGHT_COLORS.floodBeam}
        strength={0.6}
        position={[FLOOD_POOL_X, DECK_POOL_Y, 0]}
      />
    </group>
  );
}

function searchlightLights({ tint, emphasis }: GlbPartContext) {
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh position={[0.145, 0.18, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.01, 12]} />
        <GlowSurface
          color={PALETTE.lampLens}
          glowColor={LIGHT_COLORS.searchBeam}
          strength={2.4}
          {...surface}
        />
      </mesh>
      {/* Tipped a little down so the beam reaches over the bow. */}
      <GlowBeam
        length={3}
        startRadius={0.07}
        endRadius={0.7}
        color={LIGHT_COLORS.searchBeam}
        strength={0.3}
        position={[0.15, 0.18, 0]}
        rotation={[0, 0, -0.1]}
      />
    </group>
  );
}

export const DECK_GLB_PARTS: Partial<Record<PartType, GlbPartEntry>> = {
  ventilator: {
    model: "ventilator",
    variant: "ventilator",
    facing: true,
    slots: ({ painted }) => ({
      cowl: {
        color: painted ?? DECOR_COLORS.ventCowl,
        finish: "metal",
        castShadow: true,
      },
      inside: { color: DECOR_COLORS.ventInside },
    }),
  },
  deckchair: {
    model: "deckchair",
    variant: "deckchair",
    facing: true,
    slots: ({ painted }) => {
      const frame = painted ?? DECOR_COLORS.chairFrame;
      return {
        frame: { color: frame, finish: "wood", castShadow: true },
        legs: { color: frame },
        cushion: { color: DECOR_COLORS.chairCushion },
      };
    },
  },
  bench: {
    model: "bench",
    variant: "bench",
    facing: true,
    slots: ({ painted }) => ({
      wood: {
        color: painted ?? DECOR_COLORS.benchWood,
        finish: "wood",
        castShadow: true,
      },
      iron: { color: DECOR_COLORS.benchLegs, finish: "metal" },
    }),
  },
  "deck-lamp": {
    model: "deck-lamp",
    variant: "deck-lamp",
    slots: ({ painted }) => ({
      post: {
        color: painted ?? DECOR_COLORS.lampPost,
        finish: "metal",
        castShadow: true,
      },
    }),
    subParts: deckLampLights,
  },
  floodlight: {
    model: "floodlight",
    variant: "floodlight",
    facing: true,
    slots: ({ painted }) => ({
      body: {
        color: painted ?? DECOR_COLORS.lampPost,
        finish: "metal",
        castShadow: true,
      },
    }),
    subParts: floodlightLights,
  },
  stairs: {
    model: "stairs",
    variant: "stairs",
    facing: true,
    slots: ({ painted }) => ({
      steps: {
        color: painted ?? DECOR_COLORS.stairStep,
        castShadow: true,
      },
      railing: { color: DECOR_COLORS.stairRail, finish: "metal" },
    }),
  },
  searchlight: {
    model: "searchlight",
    variant: "searchlight",
    slots: ({ painted }) => ({
      lampBody: {
        color: painted ?? PALETTE.lampBody,
        finish: "metal",
        castShadow: true,
      },
    }),
    subParts: searchlightLights,
  },
  "ship-anchor": {
    model: "ship-anchor",
    variant: "ship-anchor",
    facing: true,
    slots: ({ painted }) => ({
      iron: {
        color: painted ?? WOOD.iron,
        finish: "metal",
        castShadow: true,
      },
      stock: { color: WOOD.dark, finish: "wood" },
    }),
  },
};
