"use client";

import { PALETTE } from "./palette";
import Rotator from "./Rotator";
import { roundedBox } from "./roundedBox";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

const NAVAL = {
  grey: "#8a949c",
  dark: "#4b545b",
  deck: "#5d666d",
  marking: "#f3efe4",
  tube: "#69727a",
  rotor: "#2b3036",
  heli: "#6f7b66",
} as const;

/** Slow sweep for turrets, brisk turn for a radar dish, blur for a rotor. */
const TURRET_SPEED = 0.35;
const RADAR_SPEED = 2.2;
const ROTOR_SPEED = 14;

export interface NavyMeshProps {
  /** Paint colour for the part's main surface; absent means the default. */
  painted?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

function isGhost(tint: PartTint): boolean {
  return tint === "ghost-ok" || tint === "ghost-bad";
}

interface TurretProps extends NavyMeshProps {
  /** Scale relative to the small turret. */
  large: boolean;
}

/** A gun turret; barrels point toward the bow (+X) at rest. */
export function TurretMesh({ painted, tint, emphasis, large }: TurretProps) {
  const surface = { tint, emphasis };
  const base = painted ?? NAVAL.grey;
  const radius = large ? 0.62 : 0.32;
  const housing = large
    ? { x: 1.0, y: 0.42, z: 0.95 }
    : { x: 0.52, y: 0.26, z: 0.5 };
  const barrel = large
    ? { length: 1.3, radius: 0.07, offsets: [-0.2, 0.2] }
    : { length: 0.7, radius: 0.05, offsets: [0] };
  return (
    <group>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.12, 28]} />
        <Surface color={NAVAL.dark} {...surface} />
      </mesh>
      <Rotator speed={TURRET_SPEED} enabled={!isGhost(tint)}>
        <mesh position={[0, 0.12 + housing.y / 2, 0]} castShadow>
          <primitive
            object={roundedBox(
              housing.x,
              housing.y,
              housing.z,
              large ? 0.12 : 0.07
            )}
            attach="geometry"
          />
          <Surface color={base} {...surface} />
        </mesh>
        {barrel.offsets.map((z) => (
          <mesh
            key={z}
            position={[
              housing.x / 2 + barrel.length / 2 - 0.05,
              0.12 + housing.y * 0.55,
              z,
            ]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry
              args={[barrel.radius, barrel.radius, barrel.length, 14]}
            />
            <Surface color={NAVAL.dark} finish="metal" {...surface} />
          </mesh>
        ))}
      </Rotator>
    </group>
  );
}

/** A lattice mast topped by a spinning radar bar. */
export function RadarMastMesh({ painted, tint, emphasis }: NavyMeshProps) {
  const surface = { tint, emphasis };
  const mast = painted ?? NAVAL.grey;
  return (
    <group>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.08, 5, 8]} />
        <Surface color={mast} {...surface} />
      </mesh>
      {[1.4, 2.7].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[0.1, 0.05, 0.8 - y * 0.12]} />
          <Surface color={mast} {...surface} />
        </mesh>
      ))}
      <mesh position={[0, 4.4, 0]} castShadow>
        <boxGeometry args={[0.7, 0.06, 0.06]} />
        <Surface color={mast} {...surface} />
      </mesh>
      <mesh position={[0, 5.05, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 10]} />
        <Surface color={NAVAL.dark} {...surface} />
      </mesh>
      <group position={[0, 5.25, 0]}>
        <Rotator speed={RADAR_SPEED} enabled={!isGhost(tint)}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.2, 1.3]} />
            <Surface color={PALETTE.gunwale} {...surface} />
          </mesh>
          <mesh position={[0, 0.17, 0]} castShadow>
            <boxGeometry args={[0.1, 0.14, 0.14]} />
            <Surface color={NAVAL.dark} {...surface} />
          </mesh>
        </Rotator>
      </group>
    </group>
  );
}

/** A flat pad over a 2×2 of deck blocks, marked with an H. */
export function HelipadMesh({ painted, tint, emphasis }: NavyMeshProps) {
  const surface = { tint, emphasis };
  const markY = 0.155;
  return (
    <group>
      <mesh position={[0, 0.075, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.15, 1.9]} />
        <Surface color={painted ?? NAVAL.deck} {...surface} />
      </mesh>
      {[-0.32, 0.32].map((z) => (
        <mesh key={z} position={[0, markY, z]}>
          <boxGeometry args={[0.9, 0.012, 0.12]} />
          <Surface color={NAVAL.marking} {...surface} />
        </mesh>
      ))}
      <mesh position={[0, markY, 0]}>
        <boxGeometry args={[0.12, 0.012, 0.76]} />
        <Surface color={NAVAL.marking} {...surface} />
      </mesh>
    </group>
  );
}

/** A small helicopter nose to +X, with a spinning main rotor. */
export function HelicopterMesh({ painted, tint, emphasis }: NavyMeshProps) {
  const surface = { tint, emphasis };
  const body = painted ?? NAVAL.heli;
  return (
    <group>
      <mesh position={[0, 0.42, 0]} scale={[0.62, 0.3, 0.3]} castShadow>
        <sphereGeometry args={[1, 14, 10]} />
        <Surface color={body} {...surface} />
      </mesh>
      <mesh position={[-0.85, 0.5, 0]} castShadow>
        <boxGeometry args={[1.0, 0.09, 0.09]} />
        <Surface color={body} {...surface} />
      </mesh>
      <mesh position={[-1.32, 0.62, 0]} castShadow>
        <boxGeometry args={[0.1, 0.28, 0.04]} />
        <Surface color={body} {...surface} />
      </mesh>
      {[-0.22, 0.22].map((z) => (
        <group key={z}>
          <mesh position={[0, 0.04, z]}>
            <boxGeometry args={[0.8, 0.04, 0.04]} />
            <Surface color={NAVAL.dark} {...surface} />
          </mesh>
          {[-0.25, 0.25].map((x) => (
            <mesh key={x} position={[x, 0.16, z]}>
              <boxGeometry args={[0.03, 0.26, 0.03]} />
              <Surface color={NAVAL.dark} {...surface} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.1, 8]} />
        <Surface color={NAVAL.dark} {...surface} />
      </mesh>
      <group position={[0, 0.85, 0]}>
        <Rotator speed={ROTOR_SPEED} enabled={!isGhost(tint)}>
          <mesh>
            <boxGeometry args={[1.9, 0.025, 0.1]} />
            <Surface color={NAVAL.rotor} {...surface} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.1, 0.025, 1.9]} />
            <Surface color={NAVAL.rotor} {...surface} />
          </mesh>
        </Rotator>
      </group>
    </group>
  );
}

/** A grey rigid inflatable: a flat floor inside a fat tube. */
export function RibBoatMesh({ painted, tint, emphasis }: NavyMeshProps) {
  const surface = { tint, emphasis };
  return (
    <group position={[0, -0.1, 0]}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.9, 0.05, 0.3]} />
        <Surface color={NAVAL.dark} {...surface} />
      </mesh>
      <mesh
        position={[0, 0.02, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.95, 0.45, 1]}
        castShadow
      >
        <torusGeometry args={[0.5, 0.09, 8, 24]} />
        <Surface color={painted ?? NAVAL.tube} {...surface} />
      </mesh>
    </group>
  );
}
