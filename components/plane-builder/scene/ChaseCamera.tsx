"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type Camera, PerspectiveCamera, Vector3 } from "three";
import usePrefersReducedMotion from "@/components/ship-builder/hooks/usePrefersReducedMotion";
import { terrainHeight } from "@/lib/plane-builder/levels/terrain";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import { cameraShake } from "@/lib/plane-builder/state/cameraShake";
import {
  KICK_SECONDS,
  nearMissKick,
} from "@/lib/plane-builder/state/nearMissPop";
import { flightLive } from "@/lib/plane-builder/state/flightLive";
import type { Screen } from "@/lib/plane-builder/state/store";

const LAUNCH_CAMERA = new Vector3(-14, 6, 0);
const LAUNCH_TARGET = new Vector3(8, 3, 0);
const BEHIND = 14;
const ABOVE = 5;
const AHEAD = 10;
const FOLLOW_RATE = 4;
const SHAKE_SIZE = 0.35;
const GROUND_CLEARANCE = 1.5;
/** Degrees the lens widens at the peak of a near-miss kick. */
const KICK_FOV = 4;

/** Sets a perspective camera's field of view, only when it has changed. */
function setFov(camera: Camera, fov: number) {
  if (!(camera instanceof PerspectiveCamera) || camera.fov === fov) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

interface ChaseCameraProps {
  level: LevelDef;
  screen: Screen;
}

/**
 * The only thing that moves the camera in the world scene. It holds the
 * slingshot view while launching and eases behind the plane during flight.
 */
export default function ChaseCamera({ level, screen }: ChaseCameraProps) {
  const camera = useThree((s) => s.camera);
  const isReducedMotion = usePrefersReducedMotion();
  const target = useRef(LAUNCH_TARGET.clone());
  const shake = useRef(new Vector3());
  const baseFov = useRef(camera instanceof PerspectiveCamera ? camera.fov : 55);
  const wanted = useRef(new Vector3());
  const wantedTarget = useRef(new Vector3());

  useFrame((_, delta) => {
    if (screen === "launch") {
      camera.position.copy(LAUNCH_CAMERA);
      target.current.copy(LAUNCH_TARGET);
      camera.lookAt(target.current);
      setFov(camera, baseFov.current);
      return;
    }
    if (screen !== "flight") return;
    const s = flightLive.get();
    if (!s) return;

    const cos = Math.cos(s.heading);
    const sin = Math.sin(s.heading);
    wanted.current.set(s.x - cos * BEHIND, s.y + ABOVE, s.z - sin * BEHIND);
    const floor =
      terrainHeight(level.terrain, wanted.current.x, wanted.current.z) +
      GROUND_CLEARANCE;
    wanted.current.y = Math.max(wanted.current.y, floor);
    wantedTarget.current.set(s.x + cos * AHEAD, s.y, s.z + sin * AHEAD);

    const k = 1 - Math.exp(-FOLLOW_RATE * Math.min(delta, 0.1));
    camera.position.lerp(wanted.current, k);
    target.current.lerp(wantedTarget.current, k);

    if (cameraShake.remaining > 0) {
      cameraShake.remaining = Math.max(0, cameraShake.remaining - delta);
      if (!isReducedMotion) {
        const size = SHAKE_SIZE * cameraShake.remaining;
        camera.position.add(
          shake.current.set(
            (Math.random() - 0.5) * size,
            (Math.random() - 0.5) * size,
            0
          )
        );
      }
    }
    camera.lookAt(target.current);

    // Near miss: a quick widening of the lens, skipped for reduced motion.
    const left = isReducedMotion ? 0 : nearMissKick.remaining;
    nearMissKick.remaining = Math.max(0, nearMissKick.remaining - delta);
    const kick = Math.sin(
      (Math.min(left, KICK_SECONDS) / KICK_SECONDS) * Math.PI
    );
    setFov(camera, baseFov.current + KICK_FOV * kick);
  });

  return null;
}
