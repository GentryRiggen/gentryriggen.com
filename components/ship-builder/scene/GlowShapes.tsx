"use client";

import { AdditiveBlending, DoubleSide, type BufferGeometry } from "three";
import { useGlow } from "./GlowContext";
import {
  createBeamGeometry,
  createHaloGeometry,
  createPoolGeometry,
} from "./glowGeometry";
import { noRaycast } from "./noRaycast";

/** Geometries are tiny and shared by every light of the same size. */
const cache = new Map<string, BufferGeometry>();

function cached(key: string, build: () => BufferGeometry): BufferGeometry {
  const found = cache.get(key);
  if (found) return found;
  const made = build();
  cache.set(key, made);
  return made;
}

type Vec3Tuple = [number, number, number];

interface AdditiveGlowProps {
  geometry: BufferGeometry;
  color: string;
  /** Peak opacity at full glow. */
  strength: number;
  position?: Vec3Tuple;
  rotation?: Vec3Tuple;
  vertexColors?: boolean;
}

/**
 * One additive, unlit, non-blocking shape. It draws after the sea
 * (renderOrder) so the water doesn't paint over it, never writes depth, and
 * never takes a click. Renders nothing by day.
 */
function AdditiveGlow({
  geometry,
  color,
  strength,
  position,
  rotation,
  vertexColors = true,
}: AdditiveGlowProps) {
  const glow = useGlow();
  if (glow <= 0) return null;
  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      renderOrder={4}
      raycast={noRaycast}
      frustumCulled={false}
    >
      <meshBasicMaterial
        color={color}
        vertexColors={vertexColors}
        transparent
        opacity={strength * glow}
        blending={AdditiveBlending}
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

interface PoolProps {
  radius: number;
  color: string;
  strength: number;
  position?: Vec3Tuple;
  rotation?: Vec3Tuple;
}

/** A soft flat pool of light, in the XZ plane unless rotated. */
export function GlowPool({ radius, ...rest }: PoolProps) {
  const geometry = cached(`pool:${radius}`, () => createPoolGeometry(radius));
  return <AdditiveGlow geometry={geometry} {...rest} />;
}

interface BeamProps {
  length: number;
  startRadius: number;
  endRadius: number;
  color: string;
  strength: number;
  position?: Vec3Tuple;
  rotation?: Vec3Tuple;
}

/** A faded cone of light pointing along local +X. */
export function GlowBeam({
  length,
  startRadius,
  endRadius,
  ...rest
}: BeamProps) {
  const geometry = cached(`beam:${length}:${startRadius}:${endRadius}`, () =>
    createBeamGeometry(length, startRadius, endRadius)
  );
  return <AdditiveGlow geometry={geometry} {...rest} />;
}

interface HaloProps {
  radius: number;
  color: string;
  strength: number;
  position?: Vec3Tuple;
}

/** A faint round glow around a bulb. */
export function GlowHalo({ radius, ...rest }: HaloProps) {
  const geometry = cached(`halo:${radius}`, () => createHaloGeometry(radius));
  return <AdditiveGlow geometry={geometry} vertexColors={false} {...rest} />;
}
