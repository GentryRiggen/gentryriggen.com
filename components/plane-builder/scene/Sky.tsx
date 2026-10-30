"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide,
  Color,
  type DirectionalLight,
  type Mesh,
  Object3D,
} from "three";
import type { LevelPalette } from "@/lib/plane-builder/levels/types";
import { qualitySettings } from "@/lib/plane-builder/render/quality";
import { useQualityLevel } from "@/lib/plane-builder/render/qualityStore";

const FOG_NEAR = 150;
const SKY_RADIUS = 1000;
const SUN_OFFSET = { x: 30, y: 80, z: -40 };
const SHADOW_RANGE = 70;

const VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Colour space conversion only: fog is blended after tone mapping, so the sky
// must match the plain horizon colour for the far terrain to melt into it.
const FRAGMENT = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  varying vec3 vDirection;
  void main() {
    float h = clamp(normalize(vDirection).y, 0.0, 1.0);
    gl_FragColor = vec4(mix(uHorizon, uZenith, pow(h, 0.5)), 1.0);
    #include <colorspace_fragment>
  }
`;

interface SkyProps {
  palette: LevelPalette;
}

/**
 * A gradient sky dome, fog, and the lights. The dome and the sun's shadow box
 * follow the camera so they cover the whole corridor.
 */
export default function Sky({ palette }: SkyProps) {
  const dome = useRef<Mesh>(null);
  const sun = useRef<DirectionalLight>(null);
  const sunTarget = useMemo(() => new Object3D(), []);
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new Color(palette.sky) },
      uHorizon: { value: new Color(palette.horizon) },
    }),
    [palette.sky, palette.horizon]
  );

  const { shadowMapSize, fogFar } = qualitySettings(useQualityLevel());
  useLayoutEffect(() => {
    const shadow = sun.current?.shadow;
    if (!shadow || shadow.mapSize.x === shadowMapSize) return;
    // A new size needs a new map: drop the old one and three makes another.
    shadow.mapSize.set(shadowMapSize, shadowMapSize);
    shadow.map?.dispose();
    shadow.map = null;
  }, [shadowMapSize]);

  useFrame(({ camera }) => {
    const { x, y, z } = camera.position;
    dome.current?.position.set(x, y, z);
    const light = sun.current;
    if (!light) return;
    light.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
    sunTarget.position.set(x, 0, z);
    sunTarget.updateMatrixWorld();
  });

  return (
    <>
      <fog attach="fog" args={[palette.horizon, FOG_NEAR, fogFar]} />
      <mesh ref={dome} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[SKY_RADIUS, 24, 16]} />
        <shaderMaterial
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          uniforms={uniforms}
          side={BackSide}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <hemisphereLight args={[palette.sky, palette.ground, 1.1]} />
      <directionalLight
        ref={sun}
        target={sunTarget}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-SHADOW_RANGE}
        shadow-camera-right={SHADOW_RANGE}
        shadow-camera-top={SHADOW_RANGE}
        shadow-camera-bottom={-SHADOW_RANGE}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.0005}
      />
      <primitive object={sunTarget} />
    </>
  );
}
