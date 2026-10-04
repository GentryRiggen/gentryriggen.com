"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CatmullRomCurve3,
  Color,
  Object3D,
  TubeGeometry,
  Vector3,
  AdditiveBlending,
  type InstancedMesh,
} from "three";
import { UNDERWATER_MOUNT_Y } from "@/lib/ship-builder/model/attach";
import { DECK_Y } from "./coords";
import { useGlow } from "./GlowContext";
import GlowSurface from "./GlowSurface";
import { GlowHalo, GlowPool } from "./GlowShapes";
import { LIGHT_COLORS } from "./lightColors";
import { noRaycast } from "./noRaycast";
import { PALETTE } from "./palette";
import {
  bulbCountFor,
  festoonPoint,
  stringLength,
  type Vec3Tuple,
} from "./stringLightsMath";
import Surface, { type PartEmphasis, type PartTint } from "./Surface";

interface LightPartProps {
  /** Paint colour for the part's body, if the player painted it. */
  painted?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

const WIRE_RADIUS = 0.012;
const WIRE_SEGMENTS = 24;
const BULB_RADIUS = 0.07;
const BULB_HALO_SCALE = 2.6;
const BULB_DROP = 0.06;

interface StringLightsProps extends LightPartProps {
  /** Offset to the far end, in this part's local (world) axes. */
  target: Vec3Tuple;
}

const offColor = new Color(LIGHT_COLORS.bulbOff);
const brightColors = LIGHT_COLORS.stringBulbs.map((hex) => new Color(hex));
const scratch = new Color();

/** The colour of bulb `index` at glow level `glow` (0 unlit grey, 1 bright). */
function bulbColor(index: number, glow: number, tint: PartTint): Color {
  if (tint) return scratch.set(PALETTE.tint[tint]);
  const bright = brightColors[index % brightColors.length];
  return scratch.copy(offColor).lerp(bright, glow);
}

/**
 * A festoon of small bulbs on a drooping wire, from this mast or funnel to
 * the nearest other one. Dark grey by day; multicolour and glowing at night.
 * The bulbs are one instanced mesh, so a long string is two draw calls.
 */
export function StringLightsMesh({
  target,
  painted,
  tint,
  emphasis,
}: StringLightsProps) {
  const glow = useGlow();
  const [dx, dy, dz] = target;
  const length = stringLength(target);
  const count = bulbCountFor(length);
  const bulbs = useRef<InstancedMesh>(null);
  const halos = useRef<InstancedMesh>(null);

  const wire = useMemo(() => {
    const points = Array.from({ length: WIRE_SEGMENTS + 1 }, (_, i) => {
      const [x, y, z] = festoonPoint([dx, dy, dz], i / WIRE_SEGMENTS);
      return new Vector3(x, y, z);
    });
    return new TubeGeometry(
      new CatmullRomCurve3(points),
      WIRE_SEGMENTS,
      WIRE_RADIUS,
      4,
      false
    );
  }, [dx, dy, dz]);
  useEffect(() => () => wire.dispose(), [wire]);

  // Bulbs hang evenly along the wire; positions only change with the ship.
  useLayoutEffect(() => {
    const dummy = new Object3D();
    for (const mesh of [bulbs.current, halos.current]) {
      if (!mesh) continue;
      const scale = mesh === halos.current ? BULB_HALO_SCALE : 1;
      for (let i = 0; i < count; i++) {
        const [x, y, z] = festoonPoint([dx, dy, dz], (i + 1) / (count + 1));
        dummy.position.set(x, y - BULB_DROP, z);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [dx, dy, dz, count, glow, tint]);

  useLayoutEffect(() => {
    for (const mesh of [bulbs.current, halos.current]) {
      if (!mesh) continue;
      for (let i = 0; i < count; i++) {
        mesh.setColorAt(i, bulbColor(i, glow, tint));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [count, glow, tint]);

  const isGhost = tint === "ghost-ok" || tint === "ghost-bad";
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh geometry={wire}>
        <Surface color={painted ?? PALETTE.aerialWire} {...surface} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <Surface color={painted ?? PALETTE.aerialWire} {...surface} />
      </mesh>
      <instancedMesh
        key={`bulbs:${count}`}
        ref={bulbs}
        args={[undefined, undefined, count]}
        frustumCulled={false}
      >
        <sphereGeometry args={[BULB_RADIUS, 8, 6]} />
        <meshBasicMaterial
          transparent={isGhost}
          opacity={isGhost ? 0.55 : 1}
          toneMapped={glow === 0}
        />
      </instancedMesh>
      {glow > 0 && !tint && (
        <instancedMesh
          key={`halos:${count}`}
          ref={halos}
          args={[undefined, undefined, count]}
          frustumCulled={false}
          renderOrder={4}
          raycast={noRaycast}
        >
          <sphereGeometry args={[BULB_RADIUS, 8, 6]} />
          <meshBasicMaterial
            transparent
            opacity={0.22 * glow}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
      )}
    </group>
  );
}

interface NavLightsProps extends LightPartProps {
  /** Half the bridge's width across the ship. */
  halfSpan: number;
}

/** The inset from the bridge edge to a sidelight, and the body's own scale. */
const SIDELIGHT_INSET = 0.1;
const MASTHEAD_HEIGHT = 0.5;
const MASTHEAD_SETBACK = 0.3;

interface LampProps extends LightPartProps {
  position: Vec3Tuple;
  offColor: string;
  onColor: string;
}

/** A small lamp: a housing with a coloured lens that glows and has a halo. */
function Lamp({
  position,
  offColor: day,
  onColor: night,
  painted,
  tint,
  emphasis,
}: LampProps) {
  const surface = { tint, emphasis };
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.13, 0.08, 0.13]} />
        <Surface color={painted ?? LIGHT_COLORS.housing} {...surface} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.075, 12, 8]} />
        <GlowSurface
          color={day}
          glowColor={night}
          strength={2.6}
          {...surface}
        />
      </mesh>
      <GlowHalo
        radius={0.2}
        color={night}
        strength={0.4}
        position={[0, 0.13, 0]}
      />
    </group>
  );
}

/**
 * Navigation lights on a bridge roof: a red sidelight on the port (left) wing,
 * a green one on the starboard (right) wing, and a white masthead light on a
 * short pole. Starboard is world +Z, so port is -Z.
 */
export function NavLightsMesh({
  halfSpan,
  painted,
  tint,
  emphasis,
}: NavLightsProps) {
  const wing = Math.max(0.2, halfSpan * 0.96 - SIDELIGHT_INSET);
  const shared = { painted, tint, emphasis };
  return (
    <group>
      <Lamp
        position={[0, 0, -wing]}
        offColor={LIGHT_COLORS.navPortOff}
        onColor={LIGHT_COLORS.navPort}
        {...shared}
      />
      <Lamp
        position={[0, 0, wing]}
        offColor={LIGHT_COLORS.navStarboardOff}
        onColor={LIGHT_COLORS.navStarboard}
        {...shared}
      />
      <mesh position={[-MASTHEAD_SETBACK, MASTHEAD_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.025, MASTHEAD_HEIGHT, 8]} />
        <Surface
          color={painted ?? PALETTE.mast}
          tint={tint}
          emphasis={emphasis}
        />
      </mesh>
      <group position={[-MASTHEAD_SETBACK, MASTHEAD_HEIGHT - 0.1, 0]}>
        <Lamp
          position={[0, 0, 0]}
          offColor={LIGHT_COLORS.navMastheadOff}
          onColor={LIGHT_COLORS.navMasthead}
          {...shared}
        />
      </group>
    </group>
  );
}

interface UnderwaterLightProps {
  /** Which hull side it sits on; starboard is world +Z. */
  side: "starboard" | "port";
  tint: PartTint;
  emphasis: PartEmphasis;
}

/** Local height of the sea surface for a part at the underwater mount. */
const SURFACE_Y = -(DECK_Y + UNDERWATER_MOUNT_Y) + 0.08;

/**
 * A lamp on the hull below the waterline. At night it glows teal, with a soft
 * halo in the water beside the hull (seen from below) and a faint shimmer on
 * the surface (seen from above). By day it is just a dark lamp.
 */
export function UnderwaterLightMesh({
  side,
  tint,
  emphasis,
}: UnderwaterLightProps) {
  const surface = { tint, emphasis };
  const outward = side === "starboard" ? 1 : -1;
  return (
    <group>
      <mesh
        position={[0, 0, outward * 0.03]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
        <Surface color={LIGHT_COLORS.housing} {...surface} />
      </mesh>
      <mesh position={[0, 0, outward * 0.065]} scale={[1, 1, 0.5]}>
        <sphereGeometry args={[0.075, 12, 8]} />
        <GlowSurface
          color={LIGHT_COLORS.underwaterOff}
          glowColor={LIGHT_COLORS.underwater}
          strength={2.4}
          {...surface}
        />
      </mesh>
      <GlowPool
        radius={1.1}
        color={LIGHT_COLORS.underwater}
        strength={0.6}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, outward * 0.05]}
      />
      <GlowPool
        radius={1.0}
        color={LIGHT_COLORS.underwater}
        strength={0.5}
        rotation={[0, 0, Math.PI / 2]}
        position={[0, 0, outward * 0.05]}
      />
      <GlowPool
        radius={1.2}
        color={LIGHT_COLORS.underwater}
        strength={0.5}
        position={[0, SURFACE_Y, outward * 0.8]}
      />
    </group>
  );
}
