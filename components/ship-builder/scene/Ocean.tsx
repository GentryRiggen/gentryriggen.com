"use client";

import { PALETTE } from "./palette";

export default function Ocean() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[600, 600]} />
      <meshStandardMaterial
        color={PALETTE.sea}
        roughness={0.35}
        metalness={0.1}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}
