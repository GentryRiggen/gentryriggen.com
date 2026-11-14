"use client";

import { forwardRef, useMemo } from "react";
import {
  AdditiveBlending,
  SRGBColorSpace,
  Texture,
  Vector3,
  type Mesh,
} from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { PlanetTextures } from "./planetTextures";

interface PlanetProps {
  textures: PlanetTextures;
  /** Unit vector toward the sun; the Stage updates it as the camera orbits. */
  sunDir: Vector3;
  onPointerDown(e: ThreeEvent<PointerEvent>): void;
  onPointerUp(e: ThreeEvent<PointerEvent>): void;
  onPointerMove(e: ThreeEvent<PointerEvent>): void;
}

/** Where the sun is, shared with the Stage's light. */
export const SUN_POSITION: [number, number, number] = [-5, 1.5, 2];

const NIGHT_VERTEX = `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Lights show only where the surface faces away from the sun.
const NIGHT_FRAGMENT = `
uniform sampler2D nightMap;
uniform vec3 sunDir;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  float k = smoothstep(0.12, -0.18, dot(normalize(vNormal), sunDir));
  gl_FragColor = vec4(texture2D(nightMap, vUv).rgb * k * 1.4, 1.0);
}`;

function toTexture(source: HTMLImageElement | HTMLCanvasElement): Texture {
  const t = new Texture(source);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** The globe: plain textured for now. */
const Planet = forwardRef<Mesh, PlanetProps>(function Planet(
  { textures, sunDir, onPointerDown, onPointerUp, onPointerMove },
  ref
) {
  const day = useMemo(() => toTexture(textures.day), [textures.day]);
  const night = useMemo(
    () => (textures.night ? toTexture(textures.night) : null),
    [textures.night]
  );
  const nightUniforms = useMemo(
    () =>
      night
        ? {
            nightMap: { value: night },
            sunDir: { value: sunDir },
          }
        : null,
    [night, sunDir]
  );
  return (
    <group>
      <mesh
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
      >
        <sphereGeometry args={[1, 96, 64]} />
        <meshStandardMaterial map={day} roughness={0.9} metalness={0} />
      </mesh>
      {nightUniforms && (
        <mesh raycast={() => null}>
          <sphereGeometry args={[1.002, 96, 64]} />
          <shaderMaterial
            uniforms={nightUniforms}
            vertexShader={NIGHT_VERTEX}
            fragmentShader={NIGHT_FRAGMENT}
            blending={AdditiveBlending}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
});

export default Planet;
