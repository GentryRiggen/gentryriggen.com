"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Obstacle } from "@/lib/ship-builder/sail";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { IcebergShape } from "./Iceberg";
import { sceneTime } from "./testClock";

/** Half the width of the iceberg model's peak, so scale = radius / this. */
const ICEBERG_MODEL_RADIUS = 3.4;
const ROCK_COLOR = "#7b7f86";
const ROCK_DARK = "#5d6168";
const BUOY_RED = "#d9342b";
const BUOY_WHITE = "#f4f1ea";
const BUOY_LAMP = "#ffd84a";
const SHIP_HULL = "#35506a";
const SHIP_BOOT = "#8e2a22";
const SHIP_CABIN = "#f1eee4";
const SHIP_WINDOWS = "#2c3e50";

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

function Rock({ radius, id }: ShapeProps) {
  const turn = idNoise(id) * Math.PI * 2;
  return (
    <group scale={radius} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.15, 0]} scale={[1, 0.7, 0.85]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={ROCK_COLOR} flatShading />
      </mesh>
      <mesh position={[0.55, 0.05, 0.5]} scale={[0.5, 0.4, 0.45]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={ROCK_DARK} flatShading />
      </mesh>
    </group>
  );
}

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
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshStandardMaterial
          color={BUOY_LAMP}
          emissive={BUOY_LAMP}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}

/** Another ship, bow toward +X like ours: a low-poly hull and one cabin. */
function OtherShip({ radius }: ShapeProps) {
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
    case "iceberg":
      return (
        <group
          scale={radius / ICEBERG_MODEL_RADIUS}
          rotation={[0, idNoise(id) * Math.PI * 2, 0]}
        >
          <IcebergShape />
        </group>
      );
    case "rock":
      return <Rock radius={radius} id={id} />;
    case "buoy":
      return <Buoy radius={radius} id={id} />;
    case "ship":
      return <OtherShip radius={radius} id={id} />;
  }
}
