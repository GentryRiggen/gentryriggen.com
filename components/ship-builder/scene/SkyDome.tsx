"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, type ShaderMaterial, Vector3 } from "three";
import type { RuntimeEnvironment } from "./environmentRuntime";
import { SKY_RADIUS } from "./skyLayout";

const VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// No tone mapping: three.js blends the fog after tone mapping, so the fogged
// far sea is the plain horizon colour and the sky must be too, or the ocean's
// edge shows against it. Only the colour space is converted.
const FRAGMENT = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform float uSunGlow;
  uniform float uMoon;
  varying vec3 vDirection;
  void main() {
    vec3 d = normalize(vDirection);
    vec3 color = mix(uHorizon, uZenith, pow(clamp(d.y, 0.0, 1.0), 0.45));
    float sun = max(dot(d, uSunDirection), 0.0);
    color += uSunColor * uSunGlow * (pow(sun, 5.0) * 0.3 + pow(sun, 60.0) * 0.5);
    color = mix(color, uSunColor * 2.0, smoothstep(0.9994, 0.9998, sun) * min(uSunGlow * 2.0, 1.0));
    float moon = max(dot(d, uMoonDirection), 0.0);
    color += vec3(0.25, 0.32, 0.5) * uMoon * pow(moon, 120.0);
    color = mix(color, vec3(0.9, 0.93, 1.0), smoothstep(0.9993, 0.9996, moon) * uMoon);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

interface SkyDomeProps {
  environment: RuntimeEnvironment;
}

/** A gradient sky with the sun's glow and the moon's disc, driven by uniforms. */
export default function SkyDome({ environment }: SkyDomeProps) {
  const material = useRef<ShaderMaterial>(null);
  const parameters = useMemo(
    () => ({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uZenith: { value: new Color() },
        uHorizon: { value: new Color() },
        uSunColor: { value: new Color() },
        uSunDirection: { value: new Vector3() },
        uMoonDirection: { value: new Vector3() },
        uSunGlow: { value: 0 },
        uMoon: { value: 0 },
      },
    }),
    []
  );

  useFrame(() => {
    if (!material.current) return;
    const { uniforms } = material.current;
    const { colors, numbers, vectors } = environment;
    uniforms.uZenith.value.copy(colors.skyZenith);
    uniforms.uHorizon.value.copy(colors.skyHorizon);
    uniforms.uSunColor.value.copy(colors.sunColor);
    uniforms.uSunDirection.value.copy(vectors.sunDirection).normalize();
    uniforms.uMoonDirection.value.copy(vectors.moonDirection).normalize();
    uniforms.uSunGlow.value = numbers.sunGlow;
    uniforms.uMoon.value = numbers.moonAmount;
  });

  return (
    <mesh renderOrder={-2} frustumCulled={false}>
      <sphereGeometry args={[SKY_RADIUS, 24, 16]} />
      <shaderMaterial ref={material} args={[parameters]} />
    </mesh>
  );
}
