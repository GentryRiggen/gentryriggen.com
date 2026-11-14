"use client";

import { forwardRef, useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  LinearSRGBColorSpace,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
  Vector3,
  type Mesh,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { PlanetId } from "@/lib/planet-smasher/planets";
import type { DamagePainter } from "./DamagePainter";
import type { PlanetTextures } from "./planetTextures";

interface PlanetProps {
  textures: PlanetTextures;
  painter: DamagePainter;
  /** Unit vector toward the sun; the Stage updates it as the camera orbits. */
  sunDir: Vector3;
  onPointerDown(e: ThreeEvent<PointerEvent>): void;
  onPointerUp(e: ThreeEvent<PointerEvent>): void;
  onPointerMove(e: ThreeEvent<PointerEvent>): void;
}

/** The sun's direction as the camera sees it: upper left, in front. */
export const SUN_VIEW_DIR: [number, number, number] = [-0.6, 0.4, 0.7];

/** Atmosphere rim colours: [rgb, strength]. */
const ATMOSPHERE: Record<PlanetId, [[number, number, number], number]> = {
  earth: [[0.25, 0.6, 1.0], 1.15],
  mars: [[1.0, 0.45, 0.15], 1.1],
  ice: [[0.65, 0.95, 1.0], 1.3],
};

const ATMOSPHERE_VERTEX = `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Seen from outside, only the far half of the shell shows, so the glow is
// strongest at the silhouette and fades toward the planet.
const ATMOSPHERE_FRAGMENT = `
uniform vec3 glowColor;
uniform float strength;
uniform vec3 sunDirView;
varying vec3 vNormal;
void main() {
  float edge = abs(vNormal.z);
  float k = pow(clamp(1.0 - edge / 0.3, 0.0, 1.0), 1.6);
  float lit = 0.4 + 0.6 * smoothstep(-0.4, 0.6, dot(vNormal, sunDirView));
  gl_FragColor = vec4(glowColor * k * lit * strength, 1.0);
}`;

function toTexture(source: HTMLImageElement | HTMLCanvasElement): Texture {
  const t = new Texture(source);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function canvasTexture(c: HTMLCanvasElement, srgb: boolean): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function markDirty(maps: Record<string, Texture>) {
  for (const t of Object.values(maps)) t.needsUpdate = true;
}

/** The globe: the day map, painted damage, glow and city lights. */
const Planet = forwardRef<Mesh, PlanetProps>(function Planet(
  { textures, painter, sunDir, onPointerDown, onPointerUp, onPointerMove },
  ref
) {
  const day = useMemo(() => toTexture(textures.day), [textures.day]);
  const maps = useMemo(
    () => ({
      damage: canvasTexture(painter.damage, true),
      glow: canvasTexture(painter.glow, true),
      lights: canvasTexture(painter.lights, true),
      height: canvasTexture(painter.height, false),
    }),
    [painter]
  );
  const sunDirView = useMemo(() => new Vector3(), []);
  const earth = textures.id === "earth";

  const material = useMemo(() => {
    const m = new MeshStandardMaterial({
      map: day,
      roughness: 0.9,
      metalness: 0,
      bumpMap: maps.height,
      bumpScale: 4,
      displacementMap: maps.height,
      displacementScale: 0.03,
      displacementBias: -0.015,
    });
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.damageMap = { value: maps.damage };
      shader.uniforms.glowMap = { value: maps.glow };
      shader.uniforms.lightsMap = { value: maps.lights };
      shader.uniforms.sunDirView = { value: sunDirView };
      shader.uniforms.oceanLift = { value: earth ? 1 : 0 };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform sampler2D damageMap;
uniform sampler2D glowMap;
uniform sampler2D lightsMap;
uniform vec3 sunDirView;
uniform float oceanLift;`
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
{
  // Dark blue-dominant texels are ocean: lift them to a richer blue.
  float oceanLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  float blueDom = smoothstep(0.0, 0.015, diffuseColor.b - max(diffuseColor.r, diffuseColor.g));
  float oceanK = oceanLift * blueDom * (1.0 - smoothstep(0.03, 0.2, oceanLum));
  vec3 oceanBlue = vec3(0.06, 0.22, 0.45) * (0.75 + oceanLum * 3.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, oceanBlue, oceanK);
}
vec4 dm = texture2D(damageMap, vMapUv);
diffuseColor.rgb = mix(diffuseColor.rgb, dm.rgb, dm.a);`
        )
        .replace(
          "#include <emissivemap_fragment>",
          `float nightK = smoothstep(0.1, -0.2, dot(normal, sunDirView));
totalEmissiveRadiance += texture2D(lightsMap, vMapUv).rgb * nightK
  + texture2D(glowMap, vMapUv).rgb * 1.5;
#include <emissivemap_fragment>`
        );
    };
    return m;
  }, [day, maps, sunDirView, earth]);

  const atmosphereUniforms = useMemo(() => {
    const [color, strength] = ATMOSPHERE[textures.id];
    return {
      glowColor: { value: new Vector3(...color) },
      strength: { value: strength },
      sunDirView: { value: sunDirView },
    };
  }, [textures.id, sunDirView]);

  useEffect(
    () => () => {
      day.dispose();
      Object.values(maps).forEach((t) => t.dispose());
      material.dispose();
    },
    [day, maps, material]
  );

  // One texture upload per frame at most, and only after a stamp.
  const seen = useRef({ painter, version: -1 });
  useFrame(({ camera }) => {
    sunDirView.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    const last = seen.current;
    if (last.painter !== painter || last.version !== painter.version) {
      seen.current = { painter, version: painter.version };
      markDirty(maps);
    }
  });

  return (
    <group>
      <mesh
        ref={ref}
        material={material}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
      >
        <sphereGeometry args={[1, 192, 96]} />
      </mesh>
      <mesh raycast={() => null}>
        <sphereGeometry args={[1.04, 64, 48]} />
        <shaderMaterial
          uniforms={atmosphereUniforms}
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          side={BackSide}
          blending={AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

export default Planet;
