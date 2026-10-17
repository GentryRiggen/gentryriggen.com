"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CylinderGeometry,
  type InstancedMesh,
  Object3D,
  TorusGeometry,
} from "three";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import { COIN_RADIUS } from "@/lib/plane-builder/sim/constants";
import { flightLive } from "@/lib/plane-builder/state/flightLive";
import { heldFlightSeconds } from "@/lib/plane-builder/testHooks";

const COIN_SPIN = 2.5;
const COIN_COLOR = "#fbbf24";
const RING_COLOR = "#38bdf8";
const CAN_COLOR = "#ef4444";
const CAN_BOB = 0.6;
const dummy = new Object3D();

interface PickupsProps {
  level: LevelDef;
  /** Fuel cans are only drawn for planes with an engine to burn them. */
  hasEngine: boolean;
}

/** Coins, rings and fuel cans. Ones the live flight has collected shrink to nothing. */
export default function Pickups({ level, hasEngine }: PickupsProps) {
  const isHeld = heldFlightSeconds() !== undefined;
  const coins = useRef<InstancedMesh>(null);
  const rings = useRef<InstancedMesh>(null);
  const cans = useRef<InstancedMesh>(null);
  const coinGeometry = useMemo(
    () =>
      new CylinderGeometry(COIN_RADIUS * 0.5, COIN_RADIUS * 0.5, 0.25, 16)
        // A standing disc: its face looks along x, toward the flight path.
        .rotateX(Math.PI / 2)
        .rotateY(Math.PI / 2),
    []
  );
  const ringGeometry = useMemo(() => new TorusGeometry(1, 0.06, 8, 32), []);
  const canGeometry = useMemo(() => new CylinderGeometry(1, 1, 2, 16), []);

  useLayoutEffect(
    () => () => {
      coinGeometry.dispose();
      ringGeometry.dispose();
      canGeometry.dispose();
    },
    [coinGeometry, ringGeometry, canGeometry]
  );

  useLayoutEffect(() => {
    const mesh = rings.current;
    if (!mesh) return;
    level.rings.forEach((r, i) => {
      dummy.position.set(r.center.x, r.center.y, r.center.z);
      // Torus faces +z by default; the plane flies through along x.
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.scale.setScalar(r.radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [level]);

  useFrame(({ clock }) => {
    const flight = flightLive.get();
    const coinMesh = coins.current;
    if (coinMesh) {
      const spin = (isHeld ? 0 : clock.elapsedTime) * COIN_SPIN;
      for (let i = 0; i < level.coins.length; i += 1) {
        const c = level.coins[i];
        dummy.position.set(c.x, c.y, c.z);
        dummy.rotation.set(0, spin + i, 0);
        dummy.scale.setScalar(flight?.coinTaken[i] ? 0 : 1);
        dummy.updateMatrix();
        coinMesh.setMatrixAt(i, dummy.matrix);
      }
      coinMesh.instanceMatrix.needsUpdate = true;
    }
    const ringMesh = rings.current;
    if (ringMesh) {
      for (let i = 0; i < level.rings.length; i += 1) {
        const r = level.rings[i];
        dummy.position.set(r.center.x, r.center.y, r.center.z);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.scale.setScalar(flight?.ringTaken[i] ? 0 : r.radius);
        dummy.updateMatrix();
        ringMesh.setMatrixAt(i, dummy.matrix);
      }
      ringMesh.instanceMatrix.needsUpdate = true;
    }
    const canMesh = cans.current;
    if (canMesh) {
      const time = isHeld ? 0 : clock.elapsedTime;
      for (let i = 0; i < level.fuelCans.length; i += 1) {
        const c = level.fuelCans[i];
        dummy.position.set(c.x, c.y + Math.sin(time * 2 + i) * CAN_BOB, c.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(flight?.canTaken[i] ? 0 : 1);
        dummy.updateMatrix();
        canMesh.setMatrixAt(i, dummy.matrix);
      }
      canMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh
        key={`${level.id}-coins`}
        ref={coins}
        args={[coinGeometry, undefined, level.coins.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color={COIN_COLOR}
          emissive={COIN_COLOR}
          emissiveIntensity={0.35}
          metalness={0.3}
          roughness={0.3}
        />
      </instancedMesh>
      <instancedMesh
        key={`${level.id}-rings`}
        ref={rings}
        args={[ringGeometry, undefined, level.rings.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color={RING_COLOR}
          emissive={RING_COLOR}
          emissiveIntensity={0.5}
        />
      </instancedMesh>
      {hasEngine ? (
        <instancedMesh
          key={`${level.id}-cans`}
          ref={cans}
          args={[canGeometry, undefined, level.fuelCans.length]}
          frustumCulled={false}
        >
          <meshStandardMaterial
            color={CAN_COLOR}
            emissive={CAN_COLOR}
            emissiveIntensity={0.3}
          />
        </instancedMesh>
      ) : null}
    </>
  );
}
