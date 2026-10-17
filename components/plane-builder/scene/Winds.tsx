"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, type InstancedMesh, Object3D } from "three";
import { terrainHeight } from "@/lib/plane-builder/levels/terrain";
import type { LevelDef, WindZone } from "@/lib/plane-builder/levels/types";
import { heldFlightSeconds } from "@/lib/plane-builder/testHooks";

const STREAK_SPACING = 4;
/** Streak speed is the wind strength times this (a little over 1 so it reads). */
const SPEED_PER_STRENGTH = 1.5;
const LIFT_BAND = 60;
const PUSH_MIN_HEIGHT = 2;
const PUSH_BAND = 40;
// Irrational steps give an even, repeatable scatter without Math.random.
const GOLDEN = 0.6180339887;
const PLASTIC = 0.7548776662;
const PLASTIC_SQUARED = 0.569840291;
const dummy = new Object3D();

type WindKind = "lift" | "push";

function fract(value: number): number {
  return value - Math.floor(value);
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

interface WindStreaksProps {
  level: LevelDef;
  zone: WindZone;
  kind: WindKind;
  isHeld: boolean;
}

/** One zone's streaks: upward ones for lift, sideways ones for push. */
function WindStreaks({ level, zone, kind, isHeld }: WindStreaksProps) {
  const mesh = useRef<InstancedMesh>(null);
  const halfWidth = level.corridorHalfWidth;
  const strength = kind === "lift" ? zone.lift : zone.push;
  const count = Math.max(
    1,
    Math.ceil((zone.toX - zone.fromX) / STREAK_SPACING)
  );
  const geometry = useMemo(() => new BoxGeometry(0.3, 3, 0.3), []);
  // Fixed scatter for every streak: position across the zone and corridor.
  const streaks = useMemo(() => {
    const length = zone.toX - zone.fromX;
    return Array.from({ length: count }, (_, i) => {
      const x = zone.fromX + fract(i * GOLDEN) * length;
      const z = (fract(i * PLASTIC) * 2 - 1) * halfWidth;
      return {
        x,
        z,
        phase: fract(i * PLASTIC_SQUARED),
        groundY: terrainHeight(level.terrain, x, z),
      };
    });
  }, [level.terrain, zone.fromX, zone.toX, halfWidth, count]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const instances = mesh.current;
    if (!instances) return;
    const time = isHeld ? 0 : clock.elapsedTime;
    const speed = strength * SPEED_PER_STRENGTH;
    for (let i = 0; i < streaks.length; i += 1) {
      const s = streaks[i];
      if (kind === "lift") {
        const rise = wrap(s.phase * LIFT_BAND + time * speed, LIFT_BAND);
        dummy.position.set(s.x, s.groundY + rise, s.z);
        dummy.rotation.set(0, 0, 0);
      } else {
        const width = halfWidth * 2;
        const across = wrap(s.z + halfWidth + time * speed, width) - halfWidth;
        dummy.position.set(
          s.x,
          s.groundY + PUSH_MIN_HEIGHT + s.phase * PUSH_BAND,
          across
        );
        // Lying flat, long side along z.
        dummy.rotation.set(Math.PI / 2, 0, 0);
      }
      dummy.updateMatrix();
      instances.setMatrixAt(i, dummy.matrix);
    }
    instances.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, count]}
      frustumCulled={false}
    >
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

interface WindsProps {
  level: LevelDef;
}

/** Faint moving streaks that show where the updrafts and side winds blow. */
export default function Winds({ level }: WindsProps) {
  const isHeld = heldFlightSeconds() !== undefined;
  return (
    <group>
      {level.winds.flatMap((zone) => {
        const kinds: WindKind[] = [];
        if (zone.lift !== 0) kinds.push("lift");
        if (zone.push !== 0) kinds.push("push");
        return kinds.map((kind) => (
          <WindStreaks
            key={`${level.id}-${zone.fromX}-${zone.toX}-${kind}`}
            level={level}
            zone={zone}
            kind={kind}
            isHeld={isHeld}
          />
        ));
      })}
    </group>
  );
}
