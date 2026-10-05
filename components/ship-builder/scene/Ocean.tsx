"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  DoubleSide,
  Float32BufferAttribute,
  type MeshStandardMaterial,
  PlaneGeometry,
  Vector4,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { getSailState } from "@/lib/ship-builder/state/sailLive";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import useSeaState from "../hooks/useSeaState";
import { AO_OCCLUDER_MASK } from "./aoLayer";
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
  // While sailing, the sea is fixed in the world and she moves over it: the
  // ship-frame point is turned by her heading and shifted by where she is.
  // At rest (uWorld = 0) this is just position.xy.
  vec2 seaLocal = position.xy;
  vec2 seaP = vec2(
    uWorld.x + seaLocal.x * uWorld.w + seaLocal.y * uWorld.z,
    -uWorld.y - seaLocal.x * uWorld.z + seaLocal.y * uWorld.w
  );
  float seaR = length(seaLocal);
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
  // The slope is in world axes; the normal wants the ship's.
  seaSlope = vec2(
    seaSlope.x * uWorld.w - seaSlope.y * uWorld.z,
    seaSlope.x * uWorld.z + seaSlope.y * uWorld.w
  );
  // The plane is laid flat by the mesh, so its local Z is up.
  vec3 objectNormal = normalize(vec3(-seaSlope, 1.0));
`;

interface SeaUniforms {
  uTime: { value: number };
  uAmplitude: { value: number };
  /** Ship x, ship z, sin(heading), cos(heading) while sailing. */
  uWorld: { value: Vector4 };
}

/**
 * Nearly opaque: post-processing blends in linear light, where the ten
 * per cent of bright sky showing through a 0.9 sea washes the water out
 * (it blended in sRGB before). This keeps the deep blue either way.
 */
const OPACITY = 0.98;
/** Layer 0 only: drawn by the main render, absent from the AO depth pass. */
const DEFAULT_LAYER_MASK = 0b1;
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
      uWorld: { value: new Vector4(0, 0, 0, 1) },
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
      shader.uniforms.uWorld = uniforms.uWorld;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uTime;\nuniform float uAmplitude;\nuniform vec4 uWorld;"
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
    // The sea scrolls past a sailing ship; otherwise it is centred on her.
    const sail = getSailState();
    if (sail) {
      uniforms.uWorld.value.set(
        sail.x,
        sail.z,
        Math.sin(sail.heading),
        Math.cos(sail.heading)
      );
    } else {
      uniforms.uWorld.value.set(0, 0, 0, 1);
    }
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
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      // The sea meets the hull, so the waterline darkens. Seen from below the
      // surface must not hide the underwater ship from the depth pass.
      layers-mask={seeThrough ? DEFAULT_LAYER_MASK : AO_OCCLUDER_MASK}
    >
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
