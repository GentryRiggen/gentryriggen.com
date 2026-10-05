"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  DoubleSide,
  Float32BufferAttribute,
  type MeshStandardMaterial,
  PlaneGeometry,
  type WebGLProgramParametersWithUniforms,
} from "three";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import useSeaState from "../hooks/useSeaState";
import { MAX_FRAME_DELTA } from "./animationMath";
import { frozenTime } from "./testClock";
import {
  OCEAN_SEGMENTS,
  OCEAN_SIZE,
  oceanAxisCoordinate,
  oceanDepthMix,
} from "./oceanGradient";
import type { RuntimeEnvironment } from "./environmentRuntime";
import { PALETTE } from "./palette";
import {
  SEA_FAR_END,
  SEA_FAR_START,
  SEA_NEAR_FACTOR,
  SEA_NEAR_FULL_RADIUS,
  SEA_NEAR_RADIUS,
  seaParams,
  WAVES,
} from "./seaState";

/** A segmented plane with a per-vertex radial gradient around the origin. */
function createOceanGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(
    OCEAN_SIZE,
    OCEAN_SIZE,
    OCEAN_SEGMENTS,
    OCEAN_SEGMENTS
  );
  const near = new Color(PALETTE.sea.near);
  const far = new Color(PALETTE.sea.far);
  const shade = new Color();
  const positions = geometry.getAttribute("position");
  // Pack the vertices toward the ship, where the waves are visible.
  for (let i = 0; i < positions.count; i++) {
    const half = OCEAN_SIZE / 2;
    positions.setX(i, oceanAxisCoordinate(positions.getX(i) / half));
    positions.setY(i, oceanAxisCoordinate(positions.getY(i) / half));
  }
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    // The plane is still in its local XY here; it's laid flat by the mesh.
    const distance = Math.hypot(positions.getX(i), positions.getY(i));
    shade.lerpColors(near, far, oceanDepthMix(distance));
    shade.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

interface OceanProps {
  /** Fades the surface so the hull shows through it (the below view). */
  seeThrough: boolean;
  /** The live look; the water takes its tint and sheen from it. */
  environment: RuntimeEnvironment;
}

/** Rate at which the wave height eases toward a newly chosen sea state. */
const AMPLITUDE_EASE = 3;

const glsl = (n: number) => n.toFixed(4);

/** The same wave sum as `seaHeight`, with its slope for the lighting. */
const WAVE_SUM = WAVES.map((w) => {
  const k = (Math.PI * 2) / w.wavelength;
  return `{
    vec2 dir = vec2(${glsl(w.dirX)}, ${glsl(w.dirY)});
    float phase = dot(dir, seaP) * ${glsl(k)} + uTime * ${glsl(w.omega)};
    seaH += ${glsl(w.weight)} * sin(phase);
    seaSlope += ${glsl(w.weight * k)} * cos(phase) * dir;
  }`;
}).join("\n");

const SEA_VERTEX = /* glsl */ `
  vec2 seaP = position.xy;
  float seaR = length(seaP);
  float seaNear = ${glsl(SEA_NEAR_FACTOR)} + ${glsl(1 - SEA_NEAR_FACTOR)} *
    smoothstep(${glsl(SEA_NEAR_RADIUS)}, ${glsl(SEA_NEAR_FULL_RADIUS)}, seaR);
  float seaFade = seaNear *
    (1.0 - smoothstep(${glsl(SEA_FAR_START)}, ${glsl(SEA_FAR_END)}, seaR));
  float seaH = 0.0;
  vec2 seaSlope = vec2(0.0);
  ${WAVE_SUM}
  float seaScale = uAmplitude * seaFade;
  seaH *= seaScale;
  seaSlope *= seaScale;
  // The plane is laid flat by the mesh, so its local Z is up.
  vec3 objectNormal = normalize(vec3(-seaSlope, 1.0));
`;

interface SeaUniforms {
  uTime: { value: number };
  uAmplitude: { value: number };
}

/**
 * Nearly opaque: post-processing blends in linear light, where the ten
 * per cent of bright sky showing through a 0.9 sea washes the water out
 * (it blended in sRGB before). This keeps the deep blue either way.
 */
const OPACITY = 0.98;
const SEE_THROUGH_OPACITY = 0.35;

export default function Ocean({ seeThrough, environment }: OceanProps) {
  const material = useRef<MeshStandardMaterial>(null);
  const geometry = useMemo(() => createOceanGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const { seaState } = useSeaState();
  const reducedMotion = usePrefersReducedMotion();
  const uniforms = useMemo<SeaUniforms>(
    () => ({
      uTime: { value: 0 },
      uAmplitude: { value: seaParams(seaState).amplitude },
    }),
    // Built once: later sea states ease in from useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const target = useRef(seaParams(seaState));
  target.current = seaParams(seaState);

  const handleBeforeCompile = useMemo(
    () => (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uAmplitude = uniforms.uAmplitude;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uTime;\nuniform float uAmplitude;"
        )
        .replace("#include <beginnormal_vertex>", SEA_VERTEX)
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed.z += seaH;"
        );
      // The scene's reflection map is for metal and glass; the sea has its own
      // colour and would only wash out, so it skips the image-based light.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_maps>",
        ""
      );
    },
    [uniforms]
  );

  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_FRAME_DELTA);
    const { amplitude, speed } = target.current;
    // Reduced motion freezes the sea where it is: nothing moves on screen.
    const frozen = frozenTime();
    if (frozen !== null) uniforms.uTime.value = frozen * speed;
    else if (!reducedMotion) uniforms.uTime.value += step * speed;
    const ease = frozen !== null ? 1 : Math.min(1, step * AMPLITUDE_EASE);
    uniforms.uAmplitude.value += (amplitude - uniforms.uAmplitude.value) * ease;
    if (material.current) {
      material.current.color.copy(environment.colors.seaTint);
      material.current.roughness = environment.numbers.seaRoughness;
    }
  });

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        ref={material}
        vertexColors
        metalness={0.1}
        transparent
        opacity={seeThrough ? SEE_THROUGH_OPACITY : OPACITY}
        depthWrite={!seeThrough}
        side={DoubleSide}
        onBeforeCompile={handleBeforeCompile}
        customProgramCacheKey={() => "ship-builder-ocean"}
      />
    </mesh>
  );
}
