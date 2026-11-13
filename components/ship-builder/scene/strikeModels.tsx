"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshStandardMaterial } from "three";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { ROCK_COLOR, ROCK_DARK } from "./envModels";
import { sceneTime } from "./testClock";

const MINE_BODY = "#2b2f36";
const MINE_HORN = "#8a8f98";
const MINE_LAMP = "#ff3b30";
const SAND = "#e8d39a";
const SAND_WET = "#c9b27a";
const GRASS = "#5f9e4a";
const GRASS_DARK = "#4a7f3a";
const TRUNK = "#8a6440";
const FROND = "#3f8f3f";

/** The horn directions of a contact mine: round the middle, top and bottom. */
const HORNS: readonly [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [0.7, 0.7, 0],
  [-0.7, 0.7, 0],
  [0, 0.7, 0.7],
  [0, 0.7, -0.7],
  [0, 1, 0],
];

/** Points the cylinder's +Y along `dir` (unit), as Euler XYZ angles. */
function hornRotation([x, y, z]: readonly [number, number, number]): [
  number,
  number,
  number,
] {
  // Tilt off +Y toward the horizontal direction, then turn about Y.
  const tilt = Math.acos(Math.max(-1, Math.min(1, y)));
  const turn = Math.atan2(x, z);
  return [tilt * Math.cos(turn), 0, -tilt * Math.sin(turn)];
}

interface MineShapeProps {
  /** Lit lamp on top; it blinks unless motion is reduced. */
  blink?: boolean;
}

/**
 * A floating contact mine about 1 cell across: a dark ball with grey horns
 * and a red lamp, riding half out of the water. Built to radius 1.
 */
export function MineShape({ blink = true }: MineShapeProps) {
  const lamp = useRef<MeshStandardMaterial>(null);
  const reducedMotion = usePrefersReducedMotion();
  useFrame((state) => {
    const material = lamp.current;
    if (!material) return;
    const on =
      !blink || reducedMotion
        ? 1
        : Math.sin(sceneTime(state.clock.elapsedTime) * 5) > 0
          ? 1.4
          : 0.15;
    material.emissiveIntensity = on;
  });
  return (
    <group position={[0, 0.15, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.62, 14, 10]} />
        <meshStandardMaterial
          color={MINE_BODY}
          roughness={0.55}
          metalness={0.4}
        />
      </mesh>
      {HORNS.map((dir, i) => (
        <mesh
          key={i}
          position={[dir[0] * 0.66, dir[1] * 0.66, dir[2] * 0.66]}
          rotation={hornRotation(dir)}
          castShadow
        >
          <cylinderGeometry args={[0.05, 0.1, 0.32, 6]} />
          <meshStandardMaterial
            color={MINE_HORN}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial
          ref={lamp}
          color={MINE_LAMP}
          emissive={MINE_LAMP}
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** A steady 0..1 number per (seed, slot), so an island keeps its look. */
function noise(seed: number, slot: number): number {
  const x = Math.sin(seed * 12.9898 + slot * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Palm({ height, lean }: { height: number; lean: number }) {
  return (
    <group rotation={[0, 0, lean]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, height, 6]} />
        <meshStandardMaterial color={TRUNK} flatShading />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[0, height, 0]}
          rotation={[0.9, (i / 5) * Math.PI * 2, 0]}
          castShadow
        >
          <coneGeometry args={[0.35, 1.8, 4]} />
          <meshStandardMaterial color={FROND} flatShading />
        </mesh>
      ))}
    </group>
  );
}

interface IslandShapeProps {
  /** Collision radius in cells: the beach's edge. */
  radius: number;
  /** Any number; the same seed always gives the same island. */
  seed: number;
}

/**
 * A small tropical island: a sandy beach out to `radius`, a grassy hill, a few
 * dark rocks at the waterline and some palm trees. Drawn on the waterline.
 */
export function IslandShape({ radius, seed }: IslandShapeProps) {
  const layout = useMemo(() => {
    const rocks = Array.from({ length: 7 }, (_, i) => {
      const angle = (i / 7) * Math.PI * 2 + noise(seed, i) * 0.6;
      const r = radius * (0.88 + noise(seed, i + 20) * 0.12);
      return {
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        size: 0.6 + noise(seed, i + 40) * 0.9,
        turn: noise(seed, i + 60) * Math.PI,
      };
    });
    const palms = Array.from(
      { length: 3 + Math.floor(noise(seed, 80) * 3) },
      (_, i) => {
        const angle = noise(seed, i + 90) * Math.PI * 2;
        const r = radius * (0.2 + noise(seed, i + 100) * 0.4);
        return {
          x: Math.cos(angle) * r,
          z: Math.sin(angle) * r,
          height: 2.6 + noise(seed, i + 110) * 1.6,
          lean: (noise(seed, i + 120) - 0.5) * 0.5,
          turn: angle,
        };
      }
    );
    return { rocks, palms, hillTurn: noise(seed, 130) * Math.PI };
  }, [radius, seed]);

  const hill = radius * 0.62;
  return (
    <group>
      {/* Beach: a low, wide dome that meets the sea at `radius`. */}
      <mesh position={[0, -0.6, 0]} scale={[radius, 1, radius]} receiveShadow>
        <sphereGeometry args={[1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={SAND} flatShading />
      </mesh>
      <mesh
        position={[0, -0.75, 0]}
        scale={[radius * 1.03, 0.4, radius * 1.03]}
      >
        <cylinderGeometry args={[1, 1, 1, 24]} />
        <meshStandardMaterial color={SAND_WET} flatShading />
      </mesh>
      {/* Grassy hill in the middle. */}
      <mesh
        position={[0, 0.1, 0]}
        rotation={[0, layout.hillTurn, 0]}
        scale={[hill, hill * 0.45, hill * 0.85]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={GRASS} flatShading />
      </mesh>
      <mesh
        position={[hill * 0.3, 0.3, -hill * 0.2]}
        scale={[hill * 0.5, hill * 0.4, hill * 0.5]}
        castShadow
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={GRASS_DARK} flatShading />
      </mesh>
      {layout.rocks.map((rock, i) => (
        <mesh
          key={i}
          position={[rock.x, 0, rock.z]}
          rotation={[0, rock.turn, 0]}
          scale={[rock.size, rock.size * 0.7, rock.size]}
          castShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={i % 2 ? ROCK_DARK : ROCK_COLOR}
            flatShading
          />
        </mesh>
      ))}
      {layout.palms.map((palm, i) => (
        <group
          key={i}
          position={[palm.x, hill * 0.3, palm.z]}
          rotation={[0, palm.turn, 0]}
        >
          <Palm height={palm.height} lean={palm.lean} />
        </group>
      ))}
    </group>
  );
}

/** A mine that bobs on the swell, for the drive's open sea. */
export function BobbingMine({
  radius,
  phase,
}: {
  radius: number;
  phase: number;
}) {
  const group = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();
  useFrame((state) => {
    const target = group.current;
    if (!target || reducedMotion) return;
    const t = sceneTime(state.clock.elapsedTime) * 1.3 + phase;
    target.position.y = Math.sin(t) * 0.1;
    target.rotation.z = Math.sin(t * 0.7) * 0.15;
  });
  return (
    <group ref={group} scale={radius}>
      <MineShape />
    </group>
  );
}
