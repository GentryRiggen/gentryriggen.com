"use client";

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CylinderGeometry,
  type Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { LAUNCH_HEIGHT } from "@/lib/plane-builder/sim/constants";
import { launchAim } from "@/lib/plane-builder/state/launchAim";

const POST_SPREAD = 1.4;
const POST_HEIGHT = LAUNCH_HEIGHT;
const BAND_THICKNESS = 0.07;
/** How far the band stretches back at full power, m. */
export const PULL_DISTANCE = 3;
const WOOD = "#8b5a2b";
const METAL = "#9aa4b2";
const GLOW = "#22d3ee";
const BAND = "#dc2626";

const POST_GEOMETRY = new CylinderGeometry(0.12, 0.16, 1, 8);
const BASE_GEOMETRY = new BoxGeometry(1, 1, 1);
const X_AXIS = new Vector3(1, 0, 0);
const HOME = new Vector3();

/** Where the plane's tail sits for a pull, written into `out`. */
export function pullPosition(
  pull: { pitch: number; yaw: number; power: number },
  out: Vector3
): Vector3 {
  const flat = Math.cos(pull.pitch);
  return out
    .set(
      -flat * Math.cos(pull.yaw),
      -Math.sin(pull.pitch),
      -flat * Math.sin(pull.yaw)
    )
    .multiplyScalar(pull.power * PULL_DISTANCE)
    .add(HOME.set(0, LAUNCH_HEIGHT, 0));
}

interface SlingshotProps {
  tier: number;
}

const direction = new Vector3();
const pouch = new Vector3();
const tip = new Vector3();

/** Two posts and a band; the band stretches with the shared `launchAim`. */
export default function Slingshot({ tier }: SlingshotProps) {
  const bands = useRef<(Mesh | null)[]>([null, null]);
  const style = tier >= 6 ? "powered" : tier >= 3 ? "metal" : "wood";
  const materials = useMemo(() => {
    const isWood = style === "wood";
    return {
      frame: new MeshStandardMaterial({
        color: isWood ? WOOD : METAL,
        metalness: isWood ? 0 : 0.3,
        roughness: isWood ? 0.9 : 0.35,
      }),
      band: new MeshStandardMaterial({ color: BAND, roughness: 0.6 }),
      glow: new MeshStandardMaterial({
        color: GLOW,
        emissive: GLOW,
        emissiveIntensity: 2,
      }),
    };
  }, [style]);
  const bandGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);

  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose());
    },
    [materials]
  );
  useEffect(() => () => bandGeometry.dispose(), [bandGeometry]);

  useFrame(() => {
    // The pull point is where the plane's tail rests; the band hooks there.
    pullPosition(launchAim, pouch);
    for (let i = 0; i < 2; i += 1) {
      const side = i === 0 ? -1 : 1;
      const band = bands.current[i];
      if (!band) continue;
      tip.set(0, POST_HEIGHT, side * POST_SPREAD);
      direction.subVectors(pouch, tip);
      const length = direction.length();
      band.position.copy(tip).addScaledVector(direction, 0.5);
      band.scale.set(length, BAND_THICKNESS, BAND_THICKNESS);
      band.quaternion.setFromUnitVectors(
        X_AXIS,
        direction.divideScalar(length)
      );
    }
  });

  return (
    <group>
      <mesh
        geometry={BASE_GEOMETRY}
        material={materials.frame}
        position={[0, 0.15, 0]}
        scale={[1.2, 0.3, POST_SPREAD * 2 + 0.6]}
        castShadow
        receiveShadow
      />
      {[-1, 1].map((side, i) => (
        <group key={side}>
          <mesh
            geometry={POST_GEOMETRY}
            material={materials.frame}
            position={[0, POST_HEIGHT / 2, side * POST_SPREAD]}
            scale={[1, POST_HEIGHT, 1]}
            castShadow
          />
          {style === "powered" ? (
            <mesh
              geometry={BASE_GEOMETRY}
              material={materials.glow}
              position={[0, POST_HEIGHT + 0.12, side * POST_SPREAD]}
              scale={[0.28, 0.2, 0.28]}
            />
          ) : null}
          <mesh
            ref={(m) => {
              bands.current[i] = m;
            }}
            geometry={bandGeometry}
            material={materials.band}
          />
        </group>
      ))}
    </group>
  );
}
