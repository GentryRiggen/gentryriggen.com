"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import usePrefersReducedMotion from "@/components/ship-builder/hooks/usePrefersReducedMotion";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import HangarCamera from "./HangarCamera";
import PropGlb from "./GlbProp";
import PlaneModel from "./PlaneModel";
import Sky from "./Sky";

const TURN_RATE = 0.3;
const POP_SECONDS = 0.3;
const POP_SIZE = 0.2;

interface HangarSceneProps {
  level: LevelDef;
  tiers: Tiers;
}

/** The plane on a slow turntable, with a quick pop whenever a tier changes. */
export default function HangarScene({ level, tiers }: HangarSceneProps) {
  const plane = useRef<Group>(null);
  const popStart = useRef<number | null>(null);
  const previousTiers = useRef(tiers);
  const isReduced = usePrefersReducedMotion();

  useEffect(() => {
    if (previousTiers.current === tiers) return;
    previousTiers.current = tiers;
    popStart.current = performance.now();
  }, [tiers]);

  useFrame((_, delta) => {
    const group = plane.current;
    if (!group) return;
    if (!isReduced) group.rotation.y += Math.min(delta, 0.1) * TURN_RATE;
    let scale = 1;
    if (popStart.current !== null) {
      const t = (performance.now() - popStart.current) / 1000 / POP_SECONDS;
      if (t >= 1) popStart.current = null;
      else scale = 1 + POP_SIZE * Math.sin(Math.PI * t);
    }
    group.scale.setScalar(scale);
  });

  return (
    <>
      <HangarCamera />
      <Sky palette={level.palette} />
      <PropGlb
        name="hangar"
        palette={level.palette}
        fallback={
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -1.4, 0]}
            receiveShadow
          >
            <circleGeometry args={[14, 48]} />
            <meshStandardMaterial color={level.palette.ground} roughness={1} />
          </mesh>
        }
      >
        {(geometry) => (
          <mesh geometry={geometry} position={[0, -1.4, 0]} receiveShadow>
            <meshStandardMaterial vertexColors roughness={1} />
          </mesh>
        )}
      </PropGlb>
      <PlaneModel
        ref={plane}
        levelId={level.id}
        tiers={tiers}
        palette={level.palette}
      />
    </>
  );
}
