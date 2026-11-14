"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Vector3 } from "three";
import { moonRam } from "./effects/moonState";

const ORBIT_RADIUS = 4;
const LAP_SECONDS = 60;
// Starts behind and left of the planet, in view from the first frame.
const START_ANGLE = (5 * Math.PI) / 4;

/** Where the Moon is `t` seconds into the page's clock. */
export function moonPosition(t: number, out: Vector3): Vector3 {
  const a = START_ANGLE + (t / LAP_SECONDS) * Math.PI * 2;
  return out.set(Math.cos(a) * ORBIT_RADIUS, 0.3, Math.sin(a) * ORBIT_RADIUS);
}

/** Closer than this to the lens, the Moon would swamp the screen. */
export const MOON_HIDE_DISTANCE = 1.5;

/** True when the Moon is too close to the camera to be drawn. */
export function moonNearCamera(moon: Vector3, camera: Vector3): boolean {
  return moon.distanceTo(camera) < MOON_HIDE_DISTANCE;
}

export default function Moon() {
  const ref = useRef<Group>(null);
  useFrame(({ clock, camera }) => {
    const g = ref.current;
    if (!g) return;
    moonPosition(clock.elapsedTime, g.position);
    // A ramming moon takes its place while it flies.
    // It also hides while it sweeps past the lens (portrait, pinch-out).
    g.visible =
      moonRam.active === 0 && !moonNearCamera(g.position, camera.position);
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
