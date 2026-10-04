"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  type Group,
  type ShaderMaterial,
} from "three";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { MAX_FRAME_DELTA } from "./animationMath";
import { frozenTime } from "./testClock";
import type { RuntimeEnvironment } from "./environmentRuntime";
import { cloudPuffs } from "./skyLayout";

/** Radians per second the cloud ring turns: a slow drift. */
const DRIFT_SPEED = 0.004;
/** Many GPUs cap point sprites; this keeps near puffs from being clipped. */
const MAX_POINT_SIZE = 480;
/** The tan of half the camera's 45 degree field of view. */
const HALF_FOV_TAN = Math.tan((45 / 2) * (Math.PI / 180));
/** Undersides are the same cloud, shadowed. */
const BELLY_SHADE = 0.62;

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aRank;
  attribute float aShade;
  uniform float uCover;
  uniform float uPixelsPerUnit;
  varying float vVisible;
  varying float vShade;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = min(aSize * uPixelsPerUnit / -viewPosition.z, ${MAX_POINT_SIZE.toFixed(1)});
    vVisible = smoothstep(aRank - 0.1, aRank, uCover);
    vShade = aShade;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uBelly;
  varying float vVisible;
  varying float vShade;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float falloff = 1.0 - smoothstep(0.1, 0.5, length(p));
    // gl_PointCoord's y runs down the screen: the lower half is the belly.
    vec3 color = mix(uColor, uBelly, clamp(p.y * 1.6 + 0.4 + vShade * 0.3, 0.0, 1.0));
    gl_FragColor = vec4(color, falloff * falloff * vVisible * 0.8);
    #include <colorspace_fragment>
  }
`;

interface CloudsProps {
  environment: RuntimeEnvironment;
}

/**
 * Soft cloud puffs on point sprites: one draw call, no textures. How many
 * show follows the cloud cover; they take the sky's colour and drift slowly.
 */
export default function Clouds({ environment }: CloudsProps) {
  const group = useRef<Group>(null);
  const material = useRef<ShaderMaterial>(null);
  const reducedMotion = usePrefersReducedMotion();

  const geometry = useMemo(() => {
    const puffs = cloudPuffs();
    const result = new BufferGeometry();
    result.setAttribute(
      "position",
      new Float32BufferAttribute(puffs.positions, 3)
    );
    result.setAttribute("aSize", new Float32BufferAttribute(puffs.sizes, 1));
    result.setAttribute("aRank", new Float32BufferAttribute(puffs.ranks, 1));
    result.setAttribute("aShade", new Float32BufferAttribute(puffs.shades, 1));
    return result;
  }, []);
  const parameters = useMemo(
    () => ({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uCover: { value: 0 },
        uPixelsPerUnit: { value: 1 },
        uColor: { value: new Color() },
        uBelly: { value: new Color() },
      },
    }),
    []
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const { colors, numbers } = environment;
    const uniforms = material.current?.uniforms;
    if (!uniforms) return;
    uniforms.uCover.value = numbers.cloudCover;
    uniforms.uColor.value.copy(colors.cloud);
    uniforms.uBelly.value.copy(colors.cloud).multiplyScalar(BELLY_SHADE);
    uniforms.uPixelsPerUnit.value =
      (state.size.height * state.viewport.dpr) / (2 * HALF_FOV_TAN);
    if (group.current && !reducedMotion) {
      const frozen = frozenTime();
      if (frozen !== null) group.current.rotation.y = frozen * DRIFT_SPEED;
      else
        group.current.rotation.y +=
          Math.min(delta, MAX_FRAME_DELTA) * DRIFT_SPEED;
    }
  });

  return (
    <group ref={group}>
      <points geometry={geometry} renderOrder={-1} frustumCulled={false}>
        <shaderMaterial ref={material} args={[parameters]} />
      </points>
    </group>
  );
}
