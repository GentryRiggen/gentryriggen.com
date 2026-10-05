"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { FLOOR_DEPTH } from "@/lib/ship-builder/sim/descent";
import { isFloorNeeded } from "./descentEffects";
import { createSeaFloorGeometry } from "./seaFloorGeometry";
import { trialPlayback } from "./trialPlayback";

const noRaycast = () => {};

/**
 * The sand the wreck comes to rest on. It is always mounted but hidden until
 * a ship has sunk well down, so building and ordinary trials never draw it.
 * Visibility is set straight on the mesh each frame, not through React state.
 */
export default function SeaFloor() {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => createSeaFloorGeometry(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    if (mesh.current) mesh.current.visible = isFloorNeeded(trialPlayback);
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      position={[0, -FLOOR_DEPTH, 0]}
      visible={false}
      receiveShadow
      raycast={noRaycast}
    >
      <meshStandardMaterial vertexColors roughness={1} flatShading />
    </mesh>
  );
}
