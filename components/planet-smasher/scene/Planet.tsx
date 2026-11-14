"use client";

import { forwardRef, type ReactNode, useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  LinearFilter,
  LinearSRGBColorSpace,
  MeshStandardMaterial,
  SRGBColorSpace,
  RepeatWrapping,
  Texture,
  Vector3,
  type Group,
  type Mesh,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { PlanetId } from "@/lib/planet-smasher/planets";
import type { DamagePainter } from "./DamagePainter";
import type { PlanetTextures } from "./planetTextures";
import { planetFx } from "./endings/planetFx";

interface PlanetProps {
  textures: PlanetTextures;
  painter: DamagePainter;
  /** Unit vector toward the sun; the Stage updates it as the camera orbits. */
  sunDir: Vector3;
  onPointerDown(e: ThreeEvent<PointerEvent>): void;
  onPointerUp(e: ThreeEvent<PointerEvent>): void;
  onPointerMove(e: ThreeEvent<PointerEvent>): void;
  /** Renders the endings; gets the planet's material (chunks share it). */
  renderEnding?(material: MeshStandardMaterial): ReactNode;
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
  t.wrapS = RepeatWrapping; // no seam line at u = 0/1
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/**
 * Mipmaps only where the shimmer matters (the big damage and lights maps);
 * the height and glow maps are smooth blobs, so they skip the mip rebuild.
 */
function canvasTexture(
  c: HTMLCanvasElement,
  srgb: boolean,
  mipmaps = true
): CanvasTexture {
  const t = new CanvasTexture(c);
  if (!mipmaps) {
    t.generateMipmaps = false;
    t.minFilter = LinearFilter;
  }
  t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function markDirty(maps: Record<string, Texture>, layers: Set<string>) {
  for (const k of layers) {
    if (maps[k]) maps[k].needsUpdate = true;
  }
}

interface FxUniforms {
  uMolten: { value: number };
  uFrozen: { value: number };
  uPulse: { value: number };
  uTime: { value: number };
}

/** Copies the ending state into the shader uniforms. */
function applyFxUniforms(
  fx: FxUniforms,
  atmosphere: { strength: { value: number }; base: { value: number } },
  time: number
) {
  fx.uMolten.value = planetFx.molten;
  fx.uFrozen.value = planetFx.frozen;
  fx.uPulse.value = planetFx.pulse;
  fx.uTime.value = time;
  atmosphere.strength.value = atmosphere.base.value * planetFx.atmosphere;
}

/** The globe: the day map, painted damage, glow and city lights. */
const Planet = forwardRef<Mesh, PlanetProps>(function Planet(
  {
    textures,
    painter,
    sunDir,
    onPointerDown,
    onPointerUp,
    onPointerMove,
    renderEnding,
  },
  ref
) {
  const day = useMemo(() => toTexture(textures.day), [textures.day]);
  const maps = useMemo(
    () => ({
      damage: canvasTexture(painter.damage, true),
      glow: canvasTexture(painter.glow, true, false),
      lights: canvasTexture(painter.lights, true),
      height: canvasTexture(painter.height, false, false),
    }),
    [painter]
  );
  const sunDirView = useMemo(() => new Vector3(), []);
  const fxUniforms = useMemo(
    () => ({
      uMolten: { value: 0 },
      uFrozen: { value: 0 },
      uPulse: { value: 0 },
      uTime: { value: 0 },
    }),
    []
  );
  const outer = useRef<Group>(null);
  const inner = useRef<Group>(null);
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
      Object.assign(shader.uniforms, fxUniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vObj;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vObj = position;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform sampler2D damageMap;
uniform sampler2D glowMap;
uniform sampler2D lightsMap;
uniform vec3 sunDirView;
uniform float oceanLift;
uniform float uMolten;
uniform float uFrozen;
uniform float uPulse;
uniform float uTime;
varying vec3 vObj;
float psHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float psNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(psHash(i), psHash(i + vec3(1,0,0)), f.x),
        mix(psHash(i + vec3(0,1,0)), psHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(psHash(i + vec3(0,0,1)), psHash(i + vec3(1,0,1)), f.x),
        mix(psHash(i + vec3(0,1,1)), psHash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float psFbm(vec3 p) {
  return 0.5 * psNoise(p) + 0.3 * psNoise(p * 2.1) + 0.2 * psNoise(p * 4.3);
}`
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
diffuseColor.rgb = mix(diffuseColor.rgb, dm.rgb, dm.a);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.9, 1.0), uFrozen * 0.85);
float psHeat = 0.0;
vec3 psLava = vec3(0.0);
if (uMolten + uPulse > 0.0) {
  psHeat = psFbm(vObj * 3.2 + vec3(0.0, uTime * 0.15, 0.0));
  psLava = mix(vec3(0.55, 0.04, 0.0), vec3(1.0, 0.6, 0.12), smoothstep(0.42, 0.8, psHeat));
  diffuseColor.rgb = mix(diffuseColor.rgb, psLava * 0.45, uMolten);
}`
        )
        .replace(
          "#include <emissivemap_fragment>",
          `float nightK = smoothstep(0.1, -0.2, dot(normal, sunDirView));
totalEmissiveRadiance += texture2D(lightsMap, vMapUv).rgb * nightK
  + texture2D(glowMap, vMapUv).rgb * 1.5;
totalEmissiveRadiance += psLava * uMolten * (0.45 + 0.8 * psHeat)
  + vec3(1.0, 0.45, 0.1) * uPulse * (0.35 + 0.9 * psHeat);
if (uFrozen > 0.0) {
  float psSpark = pow(psHash(floor(vObj * 45.0) + floor(uTime * 4.0)), 40.0);
  totalEmissiveRadiance += vec3(0.04, 0.1, 0.18) * uFrozen
    + vec3(0.8, 0.95, 1.0) * psSpark * 3.0 * uFrozen;
}
#include <emissivemap_fragment>`
        );
    };
    return m;
  }, [day, maps, sunDirView, earth, fxUniforms]);

  const atmosphereUniforms = useMemo(() => {
    const [color, strength] = ATMOSPHERE[textures.id];
    return {
      glowColor: { value: new Vector3(...color) },
      strength: { value: strength },
      base: { value: strength },
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
  useFrame(({ camera, clock }) => {
    sunDirView.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    applyFxUniforms(fxUniforms, atmosphereUniforms, clock.elapsedTime);
    const g = outer.current;
    if (g) {
      g.visible = !planetFx.hidden && planetFx.scale > 0.001;
      g.position.copy(planetFx.pos);
      g.quaternion.copy(planetFx.quat);
      g.scale.copy(planetFx.stretch).multiplyScalar(planetFx.scale);
    }
    if (inner.current) inner.current.rotation.y = planetFx.spin;
    const last = seen.current;
    if (last.painter !== painter || last.version !== painter.version) {
      seen.current = { painter, version: painter.version };
      markDirty(maps, painter.takeDirty());
    }
  });

  return (
    <>
      <group ref={outer}>
        <group ref={inner}>
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
      </group>
      {renderEnding?.(material)}
    </>
  );
});

export default Planet;
