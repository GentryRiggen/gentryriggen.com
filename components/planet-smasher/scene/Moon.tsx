"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const ORBIT_RADIUS = 4;
const LAP_SECONDS = 60;
// Starts behind and left of the planet, in view from the first frame.
const START_ANGLE = (5 * Math.PI) / 4;

export default function Moon() {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const a = START_ANGLE + (clock.elapsedTime / LAP_SECONDS) * Math.PI * 2;
    g.position.set(Math.cos(a) * ORBIT_RADIUS, 0.3, Math.sin(a) * ORBIT_RADIUS);
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.27, 32, 24]} />
        <meshStandardMaterial color="#9a9a9e" roughness={1} />
      </mesh>
    </group>
  );
}
