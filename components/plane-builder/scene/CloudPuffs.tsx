"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  type Fog,
  type ShaderMaterial,
} from "three";
import type { Obstacle } from "@/lib/plane-builder/levels/types";
import {
  buildCloudPuffs,
  type CloudStyle,
} from "@/lib/plane-builder/render/cloudPuffs";

/** Many GPUs cap point sprites; this keeps near puffs from being clipped. */
const MAX_POINT_SIZE = 640;
/** The tan of half the chase camera's 55 degree field of view. */
const HALF_FOV_TAN = Math.tan((55 / 2) * (Math.PI / 180));

/** Crown and belly colours (sRGB) by weather: a storm's belly is near slate. */
const LOOKS: Readonly<
  Record<CloudStyle, { top: string; belly: string; alpha: number }>
> = {
  puff: { top: "#ffffff", belly: "#b4c1d6", alpha: 0.92 },
  storm: { top: "#d3d8e3", belly: "#4a5262", alpha: 0.95 },
};

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aShade;
  uniform float uPixelsPerUnit;
  varying float vShade;
  varying float vDepth;
  varying float vNear;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float depth = -viewPosition.z;
    gl_PointSize = min(aSize * uPixelsPerUnit / max(depth, 0.001), ${MAX_POINT_SIZE.toFixed(1)});
    vShade = aShade;
    vDepth = depth;
    // Fade out as the camera enters a puff, so flying in never fills the screen.
    vNear = smoothstep(aSize * 0.15, aSize * 0.6, depth);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBelly;
  uniform float uAlpha;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying float vShade;
  varying float vDepth;
  varying float vNear;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float falloff = 1.0 - smoothstep(0.08, 0.5, length(p));
    // gl_PointCoord's y runs down the screen: the lower half is the belly.
    float lit = clamp(vShade * 1.1 + 0.15 - p.y * 0.9, 0.0, 1.0);
    vec3 color = mix(uBelly, uTop, lit);
    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    color = mix(color, uFogColor, fog);
    gl_FragColor = vec4(color, falloff * falloff * uAlpha * vNear);
    #include <colorspace_fragment>
  }
`;

interface CloudPuffsProps {
  items: Obstacle[];
  style: CloudStyle;
}

/**
 * A level's cloud obstacles as soft, camera-facing puffs on point sprites:
 * one draw call for all of them, no textures. Each cloud is a fixed layout of
 * puffs filling its box (a heap for fair weather, a tower with an anvil for a
 * storm), bright on top and shaded below. Collision is still the box.
 */
export default function CloudPuffs({ items, style }: CloudPuffsProps) {
  const material = useRef<ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const puffs = buildCloudPuffs(items, style);
    const result = new BufferGeometry();
    result.setAttribute(
      "position",
      new Float32BufferAttribute(puffs.positions, 3)
    );
    result.setAttribute("aSize", new Float32BufferAttribute(puffs.sizes, 1));
    result.setAttribute("aShade", new Float32BufferAttribute(puffs.shades, 1));
    return result;
  }, [items, style]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const parameters = useMemo(() => {
    const look = LOOKS[style];
    return {
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uPixelsPerUnit: { value: 1 },
        uTop: { value: new Color(look.top) },
        uBelly: { value: new Color(look.belly) },
        uAlpha: { value: look.alpha },
        uFogColor: { value: new Color() },
        uFogNear: { value: 150 },
        uFogFar: { value: 1000 },
      },
    };
  }, [style]);

  useFrame((state) => {
    const uniforms = material.current?.uniforms;
    if (!uniforms) return;
    uniforms.uPixelsPerUnit.value =
      (state.size.height * state.viewport.dpr) / (2 * HALF_FOV_TAN);
    const fog = state.scene.fog as Fog | null;
    if (fog) {
      uniforms.uFogColor.value.copy(fog.color);
      uniforms.uFogNear.value = fog.near;
      uniforms.uFogFar.value = fog.far;
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={material} args={[parameters]} />
    </points>
  );
}
