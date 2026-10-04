"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  PlaneGeometry,
  Quaternion,
  Vector3,
  type BufferAttribute,
  type Mesh,
} from "three";
import GlowSurface from "./GlowSurface";
import { GlowBeam } from "./GlowShapes";
import { LIGHT_COLORS } from "./lightColors";
import { PALETTE } from "./palette";
import { useShipAnimation } from "./ShipAnimationContext";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

export interface FittingMeshProps {
  /** Paint colour for the part's main surface; absent means the default. */
  painted?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

const DOME_RADIUS = 0.4;
const DOME_MERIDIANS = 4;

/** The Grand Staircase dome: a white drum, glass panes and a frame. */
export function DomeMesh({ painted, tint, emphasis }: FittingMeshProps) {
  const surface = { tint, emphasis };
  const frame = painted ?? PALETTE.windowFrame;
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry
          args={[DOME_RADIUS + 0.04, DOME_RADIUS + 0.04, 0.1, 20]}
        />
        <Surface color={frame} {...surface} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry
          args={[DOME_RADIUS, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <Surface
          color={PALETTE.domeGlass}
          opacity={0.55}
          doubleSided
          {...surface}
        />
      </mesh>
      {Array.from({ length: DOME_MERIDIANS }, (_, i) => (
        <mesh
          key={i}
          position={[0, 0.1, 0]}
          rotation={[0, (i * Math.PI) / DOME_MERIDIANS, 0]}
        >
          <torusGeometry args={[DOME_RADIUS, 0.012, 6, 24, Math.PI]} />
          <Surface color={frame} {...surface} />
        </mesh>
      ))}
      <mesh position={[0, 0.1 + DOME_RADIUS, 0]} castShadow>
        <sphereGeometry args={[0.04, 8, 6]} />
        <Surface color={frame} {...surface} />
      </mesh>
    </group>
  );
}

/** A small lamp on a stand, pointing toward the bow (+X). */
export function SearchlightMesh({ painted, tint, emphasis }: FittingMeshProps) {
  const surface = { tint, emphasis };
  const body = painted ?? PALETTE.lampBody;
  return (
    <group>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.04, 0.12, 8]} />
        <Surface color={body} {...surface} />
      </mesh>
      <mesh
        position={[0.04, 0.18, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.07, 0.09, 0.2, 12]} />
        <Surface color={body} {...surface} />
      </mesh>
      <mesh position={[0.145, 0.18, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.01, 12]} />
        <GlowSurface
          color={PALETTE.lampLens}
          glowColor={LIGHT_COLORS.searchBeam}
          strength={2.4}
          {...surface}
        />
      </mesh>
      {/* Tipped a little down so the beam reaches over the bow. */}
      <GlowBeam
        length={3}
        startRadius={0.07}
        endRadius={0.7}
        color={LIGHT_COLORS.searchBeam}
        strength={0.3}
        position={[0.15, 0.18, 0]}
        rotation={[0, 0, -0.1]}
      />
    </group>
  );
}

/** A round lookout basket, centred on the mast it rings. */
export function CrowsNestMesh({ painted, tint, emphasis }: FittingMeshProps) {
  const surface = { tint, emphasis };
  const basket = painted ?? PALETTE.nestBasket;
  return (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.04, 14]} />
        <Surface color={basket} {...surface} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.22, 0.24, 14, 1, true]} />
        <Surface color={basket} doubleSided {...surface} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.015, 6, 20]} />
        <Surface color={PALETTE.mast} {...surface} />
      </mesh>
    </group>
  );
}

const POLE_HEIGHT = 1.5;
const FLAG_LENGTH = 0.7;
const FLAG_HEIGHT = 0.4;
const FLAG_SEGMENTS = 8;
/** How far the free end of the flag swings, and how fast the ripple runs. */
const WAVE_AMPLITUDE = 0.12;
const WAVE_SPEED = 4;
const WAVE_NUMBER = 6;

interface SternFlagProps extends FittingMeshProps {
  /** Ghost previews stay still. */
  isGhost: boolean;
}

/** A pole and a cloth flag that streams toward the stern (-X in world). */
export function SternFlagMesh({
  painted,
  tint,
  emphasis,
  isGhost,
}: SternFlagProps) {
  const surface = { tint, emphasis };
  const { reducedMotion } = useShipAnimation();
  const cloth = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(FLAG_LENGTH, FLAG_HEIGHT, FLAG_SEGMENTS, 2);
    // Hinge on the pole: the cloth spans from x = 0 to x = -FLAG_LENGTH.
    plane.translate(-FLAG_LENGTH / 2, 0, 0);
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (isGhost || reducedMotion || !cloth.current) return;
    const position = cloth.current.geometry.attributes
      .position as BufferAttribute;
    const t = clock.elapsedTime * WAVE_SPEED;
    for (let i = 0; i < position.count; i++) {
      const u = -position.getX(i) / FLAG_LENGTH;
      position.setZ(i, Math.sin(t - u * WAVE_NUMBER) * WAVE_AMPLITUDE * u);
    }
    position.needsUpdate = true;
  });

  return (
    <group>
      <mesh position={[0, POLE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.03, POLE_HEIGHT, 8]} />
        <Surface color={PALETTE.railing} {...surface} />
      </mesh>
      <mesh
        ref={cloth}
        position={[0, POLE_HEIGHT - FLAG_HEIGHT / 2 - 0.04, 0]}
        geometry={geometry}
        castShadow
      >
        <Surface color={painted ?? PALETTE.flag} doubleSided {...surface} />
      </mesh>
    </group>
  );
}

const WIRE_RADIUS = 0.008;
/** The two wires leave the mast top this far apart (across the ship). */
const WIRE_SPREAD = 0.1;
const Y_AXIS = new Vector3(0, 1, 0);

interface WireProps {
  from: Vector3;
  to: Vector3;
  tint: PartTint;
  emphasis: PartEmphasis;
}

function Wire({ from, to, tint, emphasis }: WireProps) {
  const { middle, length, orientation } = useMemo(() => {
    const direction = to.clone().sub(from);
    return {
      middle: from.clone().add(to).multiplyScalar(0.5),
      length: direction.length(),
      orientation: new Quaternion().setFromUnitVectors(
        Y_AXIS,
        direction.normalize()
      ),
    };
  }, [from, to]);
  return (
    <mesh position={middle} quaternion={orientation}>
      <cylinderGeometry args={[WIRE_RADIUS, WIRE_RADIUS, length, 4]} />
      <Surface color={PALETTE.aerialWire} tint={tint} emphasis={emphasis} />
    </mesh>
  );
}

interface WirelessAerialProps {
  /** Offset to the other mast's top, in this part's local (world) axes. */
  target: [number, number, number];
  tint: PartTint;
  emphasis: PartEmphasis;
}

/** Two thin wires from this mast top to the top of the nearest other mast. */
export function WirelessAerialMesh({
  target,
  tint,
  emphasis,
}: WirelessAerialProps) {
  const [dx, dy, dz] = target;
  const wires = useMemo(
    () =>
      [-WIRE_SPREAD, WIRE_SPREAD].map((spread) => ({
        key: spread,
        from: new Vector3(0, 0, spread),
        to: new Vector3(dx, dy, dz + spread),
      })),
    [dx, dy, dz]
  );
  return (
    <group>
      {wires.map(({ key, from, to }) => (
        <Wire key={key} from={from} to={to} tint={tint} emphasis={emphasis} />
      ))}
      <mesh position={[0, 0.03, 0]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <Surface color={PALETTE.aerialWire} tint={tint} emphasis={emphasis} />
      </mesh>
    </group>
  );
}
