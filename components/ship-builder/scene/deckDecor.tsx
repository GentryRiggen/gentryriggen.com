"use client";

import type { PartType, Rotation } from "@/lib/ship-builder/model/types";
import { DECOR_COLORS } from "./decorColors";
import { LEVEL_HEIGHT } from "./coords";
import GlowSurface from "./GlowSurface";
import { GlowBeam, GlowHalo, GlowPool } from "./GlowShapes";
import { DECK_POOL_Y, LIGHT_COLORS } from "./lightColors";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

interface DecorProps {
  /** Paint colour for the part's main surface, if the player painted it. */
  color?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

interface DecorFacingProps extends DecorProps {
  rotation: Rotation;
}

/**
 * Turns a mesh drawn facing local +X to face the model direction its rotation
 * names. Rotation 0 faces model +x (stern), 90 faces +z (port), 180 faces -x
 * (bow) and 270 faces -z (starboard). World X and Z are the model's x and z
 * reversed (see modelToWorld), hence the half turn.
 */
export function facingYaw(rotation: Rotation): number {
  return Math.PI - (rotation * Math.PI) / 180;
}

interface FacingProps {
  rotation: Rotation;
  children: React.ReactNode;
}

function Facing({ rotation, children }: FacingProps) {
  return <group rotation={[0, facingYaw(rotation), 0]}>{children}</group>;
}

/** A low reclining chair: legs, a cushioned seat and a tilted back at -X. */
export function DeckChair({
  color,
  rotation,
  tint,
  emphasis,
}: DecorFacingProps) {
  const surface = { tint, emphasis };
  const frame = color ?? DECOR_COLORS.chairFrame;
  return (
    <Facing rotation={rotation}>
      <mesh position={[0.02, 0.12, 0]} castShadow>
        <boxGeometry args={[0.46, 0.04, 0.32]} />
        <Surface color={frame} {...surface} />
      </mesh>
      <mesh position={[0.02, 0.15, 0]}>
        <boxGeometry args={[0.42, 0.03, 0.28]} />
        <Surface color={DECOR_COLORS.chairCushion} {...surface} />
      </mesh>
      <mesh position={[-0.28, 0.27, 0]} rotation={[0, 0, -0.9]} castShadow>
        <boxGeometry args={[0.42, 0.04, 0.32]} />
        <Surface color={frame} {...surface} />
      </mesh>
      <mesh position={[-0.28, 0.29, 0]} rotation={[0, 0, -0.9]}>
        <boxGeometry args={[0.38, 0.03, 0.28]} />
        <Surface color={DECOR_COLORS.chairCushion} {...surface} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0.2, 0.05, side * 0.14]}>
          <boxGeometry args={[0.04, 0.1, 0.04]} />
          <Surface color={frame} {...surface} />
        </mesh>
      ))}
    </Facing>
  );
}

/** A slatted wooden bench, its length across the facing, back at -X. */
export function Bench({ color, rotation, tint, emphasis }: DecorFacingProps) {
  const surface = { tint, emphasis };
  const wood = color ?? DECOR_COLORS.benchWood;
  return (
    <Facing rotation={rotation}>
      <mesh position={[0.02, 0.22, 0]} castShadow>
        <boxGeometry args={[0.3, 0.05, 0.8]} />
        <Surface color={wood} {...surface} />
      </mesh>
      <mesh position={[-0.15, 0.42, 0]} rotation={[0, 0, -0.12]} castShadow>
        <boxGeometry args={[0.04, 0.3, 0.8]} />
        <Surface color={wood} {...surface} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0.1, side * 0.34]}>
          <boxGeometry args={[0.28, 0.2, 0.05]} />
          <Surface color={DECOR_COLORS.benchLegs} {...surface} />
        </mesh>
      ))}
    </Facing>
  );
}

/** A lamp post: round base, slim pole and a glowing glass globe. */
export function DeckLamp({ color, tint, emphasis }: DecorProps) {
  const surface = { tint, emphasis };
  const post = color ?? DECOR_COLORS.lampPost;
  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.08, 12]} />
        <Surface color={post} {...surface} />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.035, 0.8, 8]} />
        <Surface color={post} {...surface} />
      </mesh>
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
      <mesh position={[0, 0.99, 0]}>
        <coneGeometry args={[0.11, 0.07, 12]} />
        <Surface color={post} {...surface} />
      </mesh>
    </group>
  );
}

const FLOOD_POLE_HEIGHT = 0.95;
/** How far the lamp head tips down toward +X. */
const FLOOD_TILT = 0.95;
const FLOOD_BEAM_LENGTH = FLOOD_POLE_HEIGHT / Math.sin(FLOOD_TILT);
/** Where the beam meets the deck, ahead of the pole. */
const FLOOD_POOL_X = 0.04 + FLOOD_POLE_HEIGHT / Math.tan(FLOOD_TILT);

/**
 * A floodlight: a pole with a tipped lamp head that shines toward local +X.
 * At night its lens glows and a soft pool of light falls on the deck ahead.
 */
export function Floodlight({
  color,
  rotation,
  tint,
  emphasis,
}: DecorFacingProps) {
  const surface = { tint, emphasis };
  const post = color ?? DECOR_COLORS.lampPost;
  return (
    <Facing rotation={rotation}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.08, 12]} />
        <Surface color={post} {...surface} />
      </mesh>
      <mesh position={[0, 0.04 + FLOOD_POLE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.035, FLOOD_POLE_HEIGHT, 8]} />
        <Surface color={post} {...surface} />
      </mesh>
      <group
        position={[0.04, 0.04 + FLOOD_POLE_HEIGHT, 0]}
        rotation={[0, 0, -FLOOD_TILT]}
      >
        <mesh castShadow>
          <boxGeometry args={[0.22, 0.17, 0.32]} />
          <Surface color={post} {...surface} />
        </mesh>
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
    </Facing>
  );
}

/**
 * A ship's cowl ventilator: a short trunk with a bent scoop whose mouth opens
 * toward local +X, and a dark opening inside it.
 */
export function Ventilator({
  color,
  rotation,
  tint,
  emphasis,
}: DecorFacingProps) {
  const surface = { tint, emphasis };
  const cowl = color ?? DECOR_COLORS.ventCowl;
  return (
    <Facing rotation={rotation}>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.34, 14]} />
        <Surface color={cowl} {...surface} />
      </mesh>
      <mesh position={[0.02, 0.5, 0]} rotation={[0, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.2, 0.13, 0.4, 14]} />
        <Surface color={cowl} {...surface} />
      </mesh>
      <mesh position={[0.17, 0.64, 0]} rotation={[0, 0, -0.5 - Math.PI / 2]}>
        <circleGeometry args={[0.17, 14]} />
        <Surface color={DECOR_COLORS.ventInside} {...surface} />
      </mesh>
    </Facing>
  );
}

interface DeckDecorMeshProps extends DecorFacingProps {
  type: PartType;
}

/** The mesh for a decor-role part, by type. */
export function DeckDecorMesh({ type, ...props }: DeckDecorMeshProps) {
  switch (type) {
    case "deckchair":
      return <DeckChair {...props} />;
    case "bench":
      return <Bench {...props} />;
    case "deck-lamp":
      return <DeckLamp {...props} />;
    case "floodlight":
      return <Floodlight {...props} />;
    case "ventilator":
      return <Ventilator {...props} />;
    case "stairs":
      return <Stairs {...props} />;
    default:
      return null;
  }
}

const STEP_COUNT = 5;
const STAIRS_DEPTH = 0.9;
const STAIRS_WIDTH = 0.8;
const RAIL_HEIGHT = 0.32;

/**
 * A flight of steps climbing toward local +X: the top step is flush with the
 * top of the level (where the block it faces ends), with a handrail down each
 * side.
 */
export function Stairs({ color, rotation, tint, emphasis }: DecorFacingProps) {
  const surface = { tint, emphasis };
  const step = color ?? DECOR_COLORS.stairStep;
  const run = STAIRS_DEPTH / STEP_COUNT;
  const slope = Math.atan2(LEVEL_HEIGHT, STAIRS_DEPTH);
  const railLength = Math.hypot(STAIRS_DEPTH, LEVEL_HEIGHT);
  return (
    <Facing rotation={rotation}>
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const height = (LEVEL_HEIGHT * (i + 1)) / STEP_COUNT;
        return (
          <mesh
            key={i}
            position={[-STAIRS_DEPTH / 2 + run * (i + 0.5), height / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[run, height, STAIRS_WIDTH]} />
            <Surface color={step} {...surface} />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, (side * (STAIRS_WIDTH - 0.06)) / 2]}>
          <mesh
            position={[0, LEVEL_HEIGHT / 2 + RAIL_HEIGHT, 0]}
            rotation={[0, 0, slope]}
          >
            <boxGeometry args={[railLength, 0.035, 0.035]} />
            <Surface color={DECOR_COLORS.stairRail} {...surface} />
          </mesh>
          {[-0.4, 0.4].map((end) => (
            <mesh
              key={end}
              position={[
                end,
                ((end + STAIRS_DEPTH / 2) * LEVEL_HEIGHT) / STAIRS_DEPTH +
                  RAIL_HEIGHT / 2,
                0,
              ]}
            >
              <boxGeometry args={[0.03, RAIL_HEIGHT, 0.03]} />
              <Surface color={DECOR_COLORS.stairRail} {...surface} />
            </mesh>
          ))}
        </group>
      ))}
    </Facing>
  );
}
