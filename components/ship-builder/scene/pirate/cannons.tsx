"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { MAX_FRAME_DELTA } from "../animationMath";
import { useShipAnimation } from "../ShipAnimationContext";
import Surface from "../Surface";
import { WOOD, type PirateMesh, type PirateMeshProps } from "./shared";

/** Seconds a shot lasts: a fast kick back, then a slow slide home. */
export const SHOT_SECONDS = 0.9;
const KICK = 0.22;
const KICK_SECONDS = 0.12;

/** How far back the barrel sits `elapsed` seconds into a shot (0 at rest). */
export function recoilOffset(elapsed: number): number {
  if (elapsed < 0 || elapsed >= SHOT_SECONDS) return 0;
  if (elapsed < KICK_SECONDS) return KICK * (elapsed / KICK_SECONDS);
  return KICK * (1 - (elapsed - KICK_SECONDS) / (SHOT_SECONDS - KICK_SECONDS));
}

/** Smoke scale 0..1.6 over the shot, then hidden. */
export function puffScale(elapsed: number): number {
  if (elapsed < 0 || elapsed >= SHOT_SECONDS) return 0;
  return 1.6 * Math.sin((elapsed / SHOT_SECONDS) * Math.PI);
}

/**
 * Moves a shot on by one frame. `elapsed` is null at rest, and a finished shot
 * returns null again. Long frames are capped so a stall cannot skip the kick.
 */
export function advanceShot(
  elapsed: number | null,
  delta: number
): number | null {
  if (elapsed === null) return null;
  const next = elapsed + Math.min(delta, MAX_FRAME_DELTA);
  return next >= SHOT_SECONDS ? null : next;
}

/** Everything is built along local +X; this turns +X to where the gun aims. */
const AIM_YAW = { starboard: -Math.PI / 2, port: Math.PI / 2, forward: 0 };

type GunStyle = "wheeled" | "post" | "chaser";

interface GunProps extends PirateMeshProps {
  style: GunStyle;
  length: number;
  radius: number;
}

/** The barrel's breech sits this far behind the part's point. */
const BARREL_BACK = 0.2;

function Gun({ style, length, radius, side, tint, emphasis }: GunProps) {
  const { reducedMotion } = useShipAnimation();
  const isGhost = tint === "ghost-ok" || tint === "ghost-bad";
  const canFire = !isGhost && !reducedMotion;
  const shot = useRef<number | null>(null);
  const barrel = useRef<Group>(null);
  const puff = useRef<Mesh>(null);
  const surface = { tint, emphasis };

  useFrame((_, delta) => {
    // At rest there is nothing to move: the barrel is home and the puff hidden.
    if (shot.current === null || !barrel.current || !puff.current) return;
    shot.current = advanceShot(shot.current, delta);
    const elapsed = shot.current ?? -1;
    const scale = puffScale(elapsed);
    barrel.current.position.x = -recoilOffset(elapsed);
    puff.current.visible = scale > 0;
    if (scale > 0) puff.current.scale.setScalar(scale);
  });

  // Deliberately no stopPropagation: the tap must still select the part.
  const handleClick = canFire
    ? () => {
        shot.current = 0;
      }
    : undefined;

  const yaw =
    style === "chaser"
      ? AIM_YAW.forward
      : side === "port"
        ? AIM_YAW.port
        : AIM_YAW.starboard;
  const barrelY = style === "post" ? 0.42 : style === "chaser" ? 0.2 : 0.26;
  const muzzleX = length - BARREL_BACK;

  return (
    <group rotation={[0, yaw, 0]} onClick={handleClick}>
      {style === "wheeled" && (
        <>
          <mesh position={[0, 0.14, 0]} castShadow>
            <boxGeometry args={[0.55, 0.1, 0.22]} />
            <Surface color={WOOD.dark} finish="wood" {...surface} />
          </mesh>
          {[-0.2, 0.2].map((z) => (
            <mesh
              key={z}
              position={[0, 0.1, z]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.1, 0.1, 0.06, 14]} />
              <Surface color={WOOD.oak} finish="wood" {...surface} />
            </mesh>
          ))}
        </>
      )}
      {style === "post" && (
        <>
          <mesh position={[0, 0.17, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 0.34, 10]} />
            <Surface color={WOOD.dark} finish="wood" {...surface} />
          </mesh>
          <mesh position={[0, 0.34, 0]} castShadow>
            <sphereGeometry args={[0.07, 10, 8]} />
            <Surface color={WOOD.iron} finish="metal" {...surface} />
          </mesh>
          {[-0.06, 0.06].map((z) => (
            <mesh key={z} position={[0, 0.4, z]} castShadow>
              <boxGeometry args={[0.06, 0.1, 0.025]} />
              <Surface color={WOOD.iron} finish="metal" {...surface} />
            </mesh>
          ))}
        </>
      )}
      {style === "chaser" && (
        <>
          <mesh position={[0.1, 0.08, 0]} castShadow>
            <boxGeometry args={[0.9, 0.16, 0.26]} />
            <Surface color={WOOD.dark} finish="wood" {...surface} />
          </mesh>
          <mesh position={[-0.28, 0.17, 0]} rotation={[0, 0, 0.5]} castShadow>
            <boxGeometry args={[0.2, 0.06, 0.18]} />
            <Surface color={WOOD.oak} finish="wood" {...surface} />
          </mesh>
        </>
      )}
      <group ref={barrel} position={[0, barrelY, 0]}>
        <mesh
          position={[length / 2 - BARREL_BACK, 0, 0]}
          rotation={[0, 0, -Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[radius * 0.8, radius, length, 14]} />
          <Surface color={WOOD.iron} finish="metal" {...surface} />
        </mesh>
        <mesh
          position={[muzzleX, 0, 0]}
          rotation={[0, 0, -Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[radius * 1.05, radius * 1.05, 0.05, 14]} />
          <Surface color={WOOD.black} finish="metal" {...surface} />
        </mesh>
        <mesh position={[-BARREL_BACK, 0, 0]} castShadow>
          <sphereGeometry args={[radius * 0.8, 10, 8]} />
          <Surface color={WOOD.iron} finish="metal" {...surface} />
        </mesh>
        {canFire && (
          <mesh ref={puff} position={[muzzleX + 0.15, 0.03, 0]} visible={false}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <Surface color={WOOD.bone} {...surface} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export const CANNON_MESHES = {
  "cannon-deck": ({ side, tint, emphasis }) => (
    <Gun
      style="wheeled"
      length={0.7}
      radius={0.07}
      side={side}
      tint={tint}
      emphasis={emphasis}
    />
  ),
  "cannon-swivel": ({ side, tint, emphasis }) => (
    <Gun
      style="post"
      length={0.4}
      radius={0.045}
      side={side}
      tint={tint}
      emphasis={emphasis}
    />
  ),
  "cannon-chaser": ({ tint, emphasis }) => (
    <Gun
      style="chaser"
      length={1.0}
      radius={0.08}
      tint={tint}
      emphasis={emphasis}
    />
  ),
} satisfies Record<string, PirateMesh>;
