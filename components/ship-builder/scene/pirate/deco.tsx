"use client";

import type { ReactNode } from "react";
import Surface, { type PartEmphasis, type PartTint } from "../Surface";
import { facingYaw } from "../deckDecor";
import { LEVEL_HEIGHT } from "../coords";
import {
  WOOD,
  type PirateDecor,
  type PirateDecorProps,
  type PirateMesh,
  type PirateMeshProps,
} from "./shared";

const GOLD = "#e8b923";
const GLASS = "#1d2a33";

interface FacingProps {
  rotation: PirateDecorProps["rotation"];
  children: ReactNode;
}

/** Meshes face local +X (the bow); this turns them to the chosen rotation. */
function Facing({ rotation, children }: FacingProps) {
  return <group rotation={[0, facingYaw(rotation), 0]}>{children}</group>;
}

function withFacing(Body: PirateDecor): PirateDecor {
  return function FacingDecor(props: PirateDecorProps) {
    return (
      <Facing rotation={props.rotation}>
        <Body {...props} />
      </Facing>
    );
  };
}

interface BarrelProps {
  position: [number, number, number];
  color: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

function Barrel({ position, color, tint, emphasis }: BarrelProps) {
  const surface = { tint, emphasis };
  return (
    <group position={position}>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.14, 0.34, 14]} />
        <Surface color={color} finish="wood" {...surface} />
      </mesh>
      {[0.07, 0.27].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.165, 0.165, 0.025, 14]} />
          <Surface color={WOOD.iron} finish="metal" {...surface} />
        </mesh>
      ))}
    </group>
  );
}

const BARREL_SPOTS: [number, number, number][] = [
  [-0.12, 0, -0.17],
  [-0.12, 0, 0.17],
  [0.17, 0, 0],
];

function BarrelStack({ color, tint, emphasis }: PirateDecorProps) {
  return (
    <group>
      {BARREL_SPOTS.map((position) => (
        <Barrel
          key={position.join(",")}
          position={position}
          color={color ?? WOOD.oak}
          tint={tint}
          emphasis={emphasis}
        />
      ))}
    </group>
  );
}

const CRATE_SPOTS: { position: [number, number, number]; yaw: number }[] = [
  { position: [-0.1, 0.17, -0.2], yaw: 0.21 },
  { position: [-0.1, 0.17, 0.2], yaw: -0.15 },
  { position: [-0.1, 0.51, 0], yaw: 0.1 },
];

function CrateStack({ color, tint, emphasis }: PirateDecorProps) {
  const surface = { tint, emphasis };
  return (
    <group>
      {CRATE_SPOTS.map(({ position, yaw }) => (
        <group
          key={position.join(",")}
          position={position}
          rotation={[0, yaw, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.34, 0.34]} />
            <Surface color={color ?? WOOD.oak} finish="wood" {...surface} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.352, 0.05, 0.352]} />
            <Surface color={WOOD.dark} finish="wood" {...surface} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.05, 0.352, 0.352]} />
            <Surface color={WOOD.dark} finish="wood" {...surface} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TreasureChest({ color, tint, emphasis }: PirateDecorProps) {
  const surface = { tint, emphasis };
  const wood = color ?? WOOD.dark;
  return (
    <group>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.5, 0.24, 0.32]} />
        <Surface color={wood} finish="wood" {...surface} />
      </mesh>
      {/* The arched lid is a half cylinder lying along X. */}
      <mesh
        position={[0, 0.24, 0]}
        rotation={[0, 0, Math.PI / 2]}
        scale={[1, 1, 1]}
        castShadow
      >
        <cylinderGeometry args={[0.16, 0.16, 0.5, 14, 1, false, 0, Math.PI]} />
        <Surface color={wood} finish="wood" doubleSided {...surface} />
      </mesh>
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.12, 0]}>
          <boxGeometry args={[0.04, 0.245, 0.335]} />
          <Surface color={GOLD} finish="metal" {...surface} />
        </mesh>
      ))}
      <mesh position={[0, 0.24, 0.165]}>
        <boxGeometry args={[0.07, 0.09, 0.03]} />
        <Surface color={GOLD} finish="metal" {...surface} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.2]} />
        <Surface color={GOLD} finish="metal" {...surface} />
      </mesh>
    </group>
  );
}

function ShipAnchor({ color, tint, emphasis }: PirateDecorProps) {
  const surface = { tint, emphasis };
  const iron = color ?? WOOD.iron;
  return (
    <group>
      {/* Lies flat on the deck: shank along X, stock across it. */}
      <mesh position={[0, 0.04, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
        <Surface color={iron} finish="metal" {...surface} />
      </mesh>
      <mesh position={[-0.27, 0.04, 0]}>
        <boxGeometry args={[0.05, 0.05, 0.4]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      <mesh position={[0.3, 0.04, 0]}>
        <torusGeometry args={[0.05, 0.015, 8, 14]} />
        <Surface color={iron} finish="metal" {...surface} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[0.17, 0.04, side * 0.13]}
            rotation={[0, side * 0.6, 0]}
            castShadow
          >
            <boxGeometry args={[0.04, 0.04, 0.3]} />
            <Surface color={iron} finish="metal" {...surface} />
          </mesh>
          <mesh
            position={[0.1, 0.05, side * 0.24]}
            rotation={[0, side * 0.6, 0]}
          >
            <coneGeometry args={[0.05, 0.1, 4]} />
            <Surface color={iron} finish="metal" {...surface} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A carved mermaid at the bow tip, leaning forward (+X) over the water. */
function Figurehead({ painted, tint, emphasis }: PirateMeshProps) {
  const surface = { tint, emphasis };
  const wood = painted ?? WOOD.pale;
  return (
    <group rotation={[0, 0, -0.44]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 0.4, 10]} />
        <Surface color={wood} finish="wood" {...surface} />
      </mesh>
      <mesh position={[0, -0.04, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.1, 0.22, 10]} />
        <Surface color={WOOD.oak} finish="wood" {...surface} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <sphereGeometry args={[0.085, 14, 12]} />
        <Surface color={wood} finish="wood" {...surface} />
      </mesh>
      <mesh position={[-0.03, 0.5, 0]}>
        <sphereGeometry
          args={[0.09, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]}
        />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[-0.07, 0.3, side * 0.1]}
          rotation={[side * 0.5, 0, 0.9]}
        >
          <boxGeometry args={[0.2, 0.04, 0.04]} />
          <Surface color={wood} finish="wood" {...surface} />
        </mesh>
      ))}
    </group>
  );
}

const BOAT_LENGTH = 0.9;
const BOAT_WIDTH = 0.38;
const BOAT_DEPTH = 0.2;
/** A boat hangs with its rim this far below its attach point. */
const BOAT_HANG = 0.1;

/** A planked rowboat on its davit: bow at +X, two benches and two oars. */
function Rowboat({ painted, tint, emphasis }: PirateMeshProps) {
  const surface = { tint, emphasis };
  return (
    <group position={[0, -BOAT_HANG, 0]}>
      <mesh scale={[BOAT_LENGTH / 2, BOAT_DEPTH, BOAT_WIDTH / 2]} castShadow>
        <sphereGeometry
          args={[1, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]}
        />
        <Surface
          color={painted ?? WOOD.oak}
          finish="wood"
          doubleSided
          {...surface}
        />
      </mesh>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        scale={[BOAT_LENGTH / 2, BOAT_WIDTH / 2, 1]}
      >
        <torusGeometry args={[1, 0.05, 6, 24]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      {[-0.18, 0.12].map((x) => (
        <mesh key={x} position={[x, -0.06, 0]}>
          <boxGeometry args={[0.08, 0.025, BOAT_WIDTH * 0.85]} />
          <Surface color={WOOD.pale} finish="wood" {...surface} />
        </mesh>
      ))}
      {[-0.1, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.04, 0]} rotation={[0.35, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, BOAT_WIDTH * 1.5, 6]} />
          <Surface color={WOOD.pale} finish="wood" {...surface} />
        </mesh>
      ))}
    </group>
  );
}

export const DECO_MESHES = {
  figurehead: Figurehead,
  rowboat: Rowboat,
} satisfies Record<string, PirateMesh>;

export const DECO_DECOR = {
  "ship-anchor": withFacing(ShipAnchor),
  "barrel-stack": withFacing(BarrelStack),
  "crate-stack": withFacing(CrateStack),
  "treasure-chest": withFacing(TreasureChest),
} satisfies Record<string, PirateDecor>;

const WHEEL_RADIUS = 0.28;
const WHEEL_SPOKES = Array.from({ length: 8 }, (_, i) => i);
const WHEEL_CENTRE_Y = 0.62;

interface HelmWheelMeshProps {
  tint: PartTint;
  emphasis: PartEmphasis;
}

/**
 * A ship's wheel on a binnacle, standing on the helm block's roof (origin is
 * the roof centre). The wheel faces the helmsman at the stern, so its plane is
 * crossed by the X axis.
 */
export function HelmWheelMesh({ tint, emphasis }: HelmWheelMeshProps) {
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh position={[0.14, 0.25, 0]} castShadow>
        <boxGeometry args={[0.26, 0.5, 0.3]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      <mesh position={[0.14, 0.52, 0]}>
        <boxGeometry args={[0.3, 0.04, 0.34]} />
        <Surface color={WOOD.pale} finish="wood" {...surface} />
      </mesh>
      <mesh position={[0.05, WHEEL_CENTRE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 6]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      <group
        position={[-0.04, WHEEL_CENTRE_Y, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <mesh castShadow>
          <torusGeometry args={[WHEEL_RADIUS, 0.025, 8, 24]} />
          <Surface color={WOOD.oak} finish="wood" {...surface} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.06, 10]} />
          <Surface color={GOLD} finish="metal" {...surface} />
        </mesh>
        {WHEEL_SPOKES.map((i) => (
          <group
            key={i}
            rotation={[0, 0, (i * Math.PI * 2) / WHEEL_SPOKES.length]}
          >
            <mesh position={[0, (WHEEL_RADIUS + 0.08) / 2, 0]}>
              <boxGeometry args={[0.025, WHEEL_RADIUS + 0.08, 0.025]} />
              <Surface color={WOOD.pale} finish="wood" {...surface} />
            </mesh>
            <mesh position={[0, WHEEL_RADIUS + 0.08, 0]}>
              <sphereGeometry args={[0.025, 8, 6]} />
              <Surface color={WOOD.pale} finish="wood" {...surface} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

interface CaptainCabinTrimProps {
  size: { x: number; z: number };
  tint: PartTint;
  emphasis: PartEmphasis;
}

const WINDOW_WIDTH = 0.22;
const WINDOW_HEIGHT = 0.3;
const WINDOW_CENTRE_Y = 0.58;
/** Blocks inset their exposed walls to 96% of the footprint. */
const WALL_INSET = 0.48;

/**
 * Stern windows on the captain's cabin: pale frames around dark glass on the
 * -X face (the stern; the bow is +X in a part's frame), spread across its width.
 */
export function CaptainCabinTrim({
  size,
  tint,
  emphasis,
}: CaptainCabinTrimProps) {
  const surface = { tint, emphasis };
  const count = Math.max(1, Math.round(size.z * 2));
  const spacing = (size.z * 0.9) / count;
  const faceX = -size.x * WALL_INSET - 0.005;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group
          key={i}
          position={[faceX, WINDOW_CENTRE_Y, (i - (count - 1) / 2) * spacing]}
        >
          <mesh>
            <boxGeometry
              args={[0.02, WINDOW_HEIGHT + 0.06, WINDOW_WIDTH + 0.06]}
            />
            <Surface color={WOOD.pale} finish="wood" {...surface} />
          </mesh>
          <mesh position={[-0.008, 0, 0]}>
            <boxGeometry args={[0.02, WINDOW_HEIGHT, WINDOW_WIDTH]} />
            <Surface color={GLASS} finish="glass" {...surface} />
          </mesh>
          <mesh position={[-0.012, 0, 0]}>
            <boxGeometry args={[0.02, 0.02, WINDOW_WIDTH]} />
            <Surface color={WOOD.pale} finish="wood" {...surface} />
          </mesh>
        </group>
      ))}
      <mesh position={[faceX - 0.01, LEVEL_HEIGHT * 0.98, 0]}>
        <boxGeometry args={[0.04, 0.05, size.z * 0.96]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
    </group>
  );
}
