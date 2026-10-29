"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Obstacle } from "@/lib/ship-builder/sail";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import EnvGlb from "./EnvGlb";
import {
  BUOY_LAMP,
  BUOY_LAMP_Y,
  BUOY_RED,
  BUOY_SLOTS,
  BUOY_WHITE,
  ENV_MODELS,
  ROCK_COLOR,
  ROCK_DARK,
  ROCK_SLOTS,
  SHIP_BOOT,
  SHIP_CABIN,
  SHIP_HULL,
  SHIP_SLOTS,
  SHIP_WINDOWS,
} from "./envModels";
import { IcebergShape } from "./Iceberg";
import { sceneTime } from "./testClock";

/** Half the width of the iceberg model's peak, so scale = radius / this. */
const ICEBERG_MODEL_RADIUS = 3.4;
/** Stretches `idNoise` so ids a digit apart pick different shapes. */
const SHAPE_SPREAD = 977;
/** The passing ship's collision radius; its model is built at this size. */
const SHIP_MODEL_RADIUS = 4;

/** A steady 0..1 number from an obstacle id, so a rock keeps its look. */
export function idNoise(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

interface ShapeProps {
  radius: number;
  id: string;
}

/**
 * Picks the one of `count` shapes an obstacle id keeps, and a turn in 0..1
 * left over from the same number, so shape and turn do not go together.
 * Ids that differ only in a last digit hash to nearby numbers, so the number
 * is stretched first: neighbouring obstacles still get different shapes.
 */
export function shapeAndTurn(
  id: string,
  count: number
): { shape: number; turn: number } {
  const spread = (idNoise(id) * SHAPE_SPREAD) % 1;
  const scaled = spread * count;
  const shape = Math.min(count - 1, Math.floor(scaled));
  return { shape, turn: scaled - shape };
}

function ProceduralRock() {
  return (
    <>
      <mesh position={[0, 0.15, 0]} scale={[1, 0.7, 0.85]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={ROCK_COLOR} flatShading />
      </mesh>
      <mesh position={[0.55, 0.05, 0.5]} scale={[0.5, 0.4, 0.45]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={ROCK_DARK} flatShading />
      </mesh>
    </>
  );
}

/** A sea stack or skerry: one of three Blender shapes, kept by its id. */
function Rock({ radius, id }: ShapeProps) {
  const { shape, turn } = shapeAndTurn(id, ENV_MODELS.rock.variants.length);
  return (
    <group scale={radius} rotation={[0, turn * Math.PI * 2, 0]}>
      <EnvGlb
        model={ENV_MODELS.rock.model}
        variant={ENV_MODELS.rock.variants[shape]}
        slots={ROCK_SLOTS}
        fallback={<ProceduralRock />}
      />
    </group>
  );
}

/** The lamp's glow: always procedural, so it stays lit however the model loads. */
function BuoyLamp({ y }: { y: number }) {
  return (
    <mesh position={[0, y, 0]}>
      <sphereGeometry args={[0.16, 8, 6]} />
      <meshStandardMaterial
        color={BUOY_LAMP}
        emissive={BUOY_LAMP}
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}

/** The old low-poly buoy, drawn while the Blender one loads. */
function ProceduralBuoy({ lampY }: { lampY: number }) {
  return (
    <>
      <mesh position={[0, 0.1, 0]} scale={[0.8, 0.5, 0.8]} castShadow>
        <sphereGeometry args={[1, 10, 6]} />
        <meshStandardMaterial color={BUOY_RED} flatShading />
      </mesh>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.55, 0.6, 10]} />
        <meshStandardMaterial color={BUOY_WHITE} flatShading />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.4, 0.4, 10]} />
        <meshStandardMaterial color={BUOY_RED} flatShading />
      </mesh>
      <BuoyLamp y={lampY} />
    </>
  );
}

/** A lateral buoy that bobs and rolls; its lamp glows. */
function Buoy({ radius, id }: ShapeProps) {
  const group = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();
  const phase = idNoise(id) * Math.PI * 2;

  useFrame((state) => {
    const target = group.current;
    if (!target || reducedMotion) return;
    const t = sceneTime(state.clock.elapsedTime) * 1.6 + phase;
    target.position.y = Math.sin(t) * 0.12;
    target.rotation.z = Math.sin(t * 0.8) * 0.12;
  });

  return (
    <group ref={group} scale={radius / 0.8}>
      <EnvGlb
        model={ENV_MODELS.buoy.model}
        variant="buoy"
        slots={BUOY_SLOTS}
        fallback={<ProceduralBuoy lampY={1.55} />}
      >
        <BuoyLamp y={BUOY_LAMP_Y} />
      </EnvGlb>
    </group>
  );
}

/** The old low-poly ship, drawn while the Blender coaster loads. */
function ProceduralShip({ radius }: ShapeProps) {
  const length = radius * 1.8;
  const beam = radius * 0.6;
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[length, 1.4, beam]} />
        <meshStandardMaterial color={SHIP_HULL} flatShading />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[length * 1.001, 0.3, beam * 1.001]} />
        <meshStandardMaterial color={SHIP_BOOT} flatShading />
      </mesh>
      <group
        position={[length / 2 + beam * 0.4, 0.2, 0]}
        scale={[beam * 0.8, 0.7, beam / 2]}
      >
        <mesh rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color={SHIP_HULL} flatShading />
        </mesh>
      </group>
      <mesh position={[-length * 0.15, 1.4, 0]} castShadow>
        <boxGeometry args={[length * 0.3, 1.2, beam * 0.7]} />
        <meshStandardMaterial color={SHIP_CABIN} flatShading />
      </mesh>
      <mesh position={[-length * 0.15 + length * 0.1, 1.55, 0]}>
        <boxGeometry args={[length * 0.1, 0.3, beam * 0.74]} />
        <meshStandardMaterial color={SHIP_WINDOWS} flatShading />
      </mesh>
    </group>
  );
}

/** Another ship, bow toward +X like ours: a small Blender coaster. */
function OtherShip({ radius, id }: ShapeProps) {
  return (
    <group scale={radius / SHIP_MODEL_RADIUS}>
      <EnvGlb
        model={ENV_MODELS.ship.model}
        variant="ship"
        slots={SHIP_SLOTS}
        fallback={<ProceduralShip radius={SHIP_MODEL_RADIUS} id={id} />}
      />
    </group>
  );
}

interface ObstacleMeshProps {
  obstacle: Pick<Obstacle, "id" | "kind" | "radius">;
}

/**
 * The look of one obstacle, centred on its own origin on the waterline. The
 * collision radius is the visual size, so what you see is what you hit.
 */
export default function ObstacleMesh({ obstacle }: ObstacleMeshProps) {
  const { id, kind, radius } = obstacle;
  switch (kind) {
    case "iceberg": {
      const { shape, turn } = shapeAndTurn(
        id,
        ENV_MODELS.iceberg.variants.length
      );
      return (
        <group
          scale={radius / ICEBERG_MODEL_RADIUS}
          rotation={[0, turn * Math.PI * 2, 0]}
        >
          <IcebergShape variant={ENV_MODELS.iceberg.variants[shape]} />
        </group>
      );
    }
    case "rock":
      return <Rock radius={radius} id={id} />;
    case "buoy":
      return <Buoy radius={radius} id={id} />;
    case "ship":
      return <OtherShip radius={radius} id={id} />;
  }
}
