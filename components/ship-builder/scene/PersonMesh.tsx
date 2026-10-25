"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { OUTFIT_COUNT, type PersonPose } from "@/lib/ship-builder/crowd/types";
import Surface from "./Surface";

/** Tops for passengers; outfit 0 is the crew uniform (see `CREW_OUTFIT`). */
const TOPS = ["#e4572e", "#f2c14e", "#3a86ff", "#2ec4b6", "#ff7aa2", "#8ac926"];
const CREW_NAVY = "#1d2d5c";
const CAP_WHITE = "#f5f5f0";
const SKIN = "#e0ac8a";
const TROUSERS = "#3b3f4a";
const CREW_OUTFIT = 0;

/** Index into TOPS for an outfit 1..OUTFIT_COUNT-1. */
function topFor(outfit: number): string {
  return TOPS[(Math.max(1, outfit) - 1) % TOPS.length];
}

/** How far a sitter drops (cells) and leans back (radians). */
export const SIT_DROP = 0.25;
export const SIT_LEAN = 0.25;
const ARM_SWING = 0.6;
const ARM_SPEED = 6;

interface PersonMeshProps {
  outfit: number;
  activity: PersonPose["activity"];
}

/**
 * One low-detail person, about 0.75 of a level tall, standing at the origin
 * and drawn facing local +X. Sitting lowers the body and leans it back.
 */
export default function PersonMesh({ outfit, activity }: PersonMeshProps) {
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const isCrew = outfit === CREW_OUTFIT;
  const top = isCrew ? CREW_NAVY : topFor(outfit % OUTFIT_COUNT);
  const sitting = activity === "sit";

  useFrame(({ clock }) => {
    const swing =
      activity === "walk" ? Math.sin(clock.elapsedTime * ARM_SPEED) : 0;
    if (leftArm.current) leftArm.current.rotation.z = swing * ARM_SWING;
    if (rightArm.current) rightArm.current.rotation.z = -swing * ARM_SWING;
  });

  return (
    <group
      position={[0, sitting ? -SIT_DROP : 0, 0]}
      rotation={[0, 0, sitting ? SIT_LEAN : 0]}
    >
      <mesh position={[0, 0.25, 0]}>
        <capsuleGeometry args={[0.09, 0.32, 3, 8]} />
        <Surface color={top} tint={null} emphasis={null} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.14, 8]} />
        <Surface color={TROUSERS} tint={null} emphasis={null} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.095, 10, 8]} />
        <Surface color={SKIN} tint={null} emphasis={null} />
      </mesh>
      {isCrew && (
        <mesh position={[0, 0.69, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.05, 10]} />
          <Surface color={CAP_WHITE} tint={null} emphasis={null} />
        </mesh>
      )}
      {[
        { ref: leftArm, side: 1 },
        { ref: rightArm, side: -1 },
      ].map(({ ref, side }) => (
        <group key={side} ref={ref} position={[0, 0.42, side * 0.12]}>
          <mesh position={[0, -0.12, 0]}>
            <boxGeometry args={[0.05, 0.26, 0.05]} />
            <Surface color={top} tint={null} emphasis={null} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
