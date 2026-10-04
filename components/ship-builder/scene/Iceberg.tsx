"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { beamOf } from "@/lib/ship-builder/model/grid";
import type { IcebergInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { hullXOfImpact } from "./icebergAim";
import { icebergOffset } from "./icebergMotion";
import { trialPlayback } from "./trialPlayback";

/** How far the berg's middle sits from the hull's side, so they just touch. */
const BERG_STANDOFF = 2.8;
const ICE_TOP = "#f5fbff";
const ICE_UNDER = "#a9d8ee";

interface IcebergBodyProps {
  iceberg: IcebergInput;
  beam: number;
}

/** The low-poly berg: a pale peak above the water, a bluer bulk below. */
function IcebergBody({ iceberg, beam }: IcebergBodyProps) {
  const group = useRef<Group>(null);
  const reducedMotion = usePrefersReducedMotion();
  const strikeX = hullXOfImpact(iceberg.impactX, iceberg.length);
  const z = beam / 2 + BERG_STANDOFF;

  useFrame(() => {
    const target = group.current;
    if (!target) return;
    // Reduced motion: no slide, just the berg resting where it struck.
    const offset = reducedMotion ? 0 : icebergOffset(trialPlayback.time);
    target.position.x = strikeX + offset;
  });

  return (
    <group
      ref={group}
      position={[strikeX + icebergOffset(0), 0, z]}
      rotation={[0, 0.5, 0]}
      scale={0.8}
    >
      <mesh position={[0, 0.9, 0]} scale={[3.4, 2, 2.8]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={ICE_TOP} flatShading />
      </mesh>
      <mesh position={[-1.4, 1.6, 0.4]} scale={[1.5, 1.7, 1.3]} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={ICE_TOP} flatShading />
      </mesh>
      <mesh position={[0.2, -1.6, 0]} scale={[3.8, 2.4, 3.2]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={ICE_UNDER}
          flatShading
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

/**
 * The iceberg of an iceberg trial. It slides past the struck (starboard) side
 * during the first few seconds, then drifts away. It floats in the water, not
 * in the ship's group, so it does not roll with her. Waves trials have none.
 */
export default function Iceberg() {
  const iceberg = useShipBuilderStore((s) =>
    s.trial.status === "running" || s.trial.status === "result"
      ? s.trial.input.iceberg
      : undefined
  );
  const beam = useShipBuilderStore((s) => beamOf(s.ship));
  if (!iceberg) return null;
  return <IcebergBody iceberg={iceberg} beam={beam} />;
}
