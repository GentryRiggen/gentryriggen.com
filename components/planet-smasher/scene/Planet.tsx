"use client";

import { forwardRef, type ReactNode, useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  UnsignedByteType,
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
import { useGameStore } from "@/lib/planet-smasher/store";
import {
  buildFaultMap,
  crackTarget,
  easeCrack,
  FAULT_H,
  FAULT_W,
  faultSeed,
} from "@/lib/planet-smasher/faultMap";

interface PlanetProps {
  textures: PlanetTextures;
  painter: DamagePainter;
  /** Unit vector toward the sun; the Stage updates it as the camera orbits. */
  sunDir: Vector3;
  onPointerDown(e: ThreeEvent<PointerEvent>): void;
  onPointerUp(e: ThreeEvent<PointerEvent>): void;
  onPointerMove?(e: ThreeEvent<PointerEvent>): void;
  /** Renders the endings; gets the planet's material (chunks share it). */
  renderEnding?(material: MeshStandardMaterial): ReactNode;
}

/** The sun's direction as the camera sees it: upper left, in front. */
export const SUN_VIEW_DIR: [number, number, number] = [-0.6, 0.4, 0.7];

/** How far (of the radius) pure white lifts and pure black sinks the ground. */
const DISPLACEMENT_SCALE = 0.16;
const BUMP_SCALE = 3;
/** Chunks of a shattered planet have flat inner faces, so the relief eases. */
const ENDING_RELIEF = 0.03 / DISPLACEMENT_SCALE;
const RELIEF_EASE_SECONDS = 0.2;

/** Atmosphere rim colours: [rgb, strength]. */
const ATMOSPHERE: Record<PlanetId, [[number, number, number], number]> = {
  earth: [[0.25, 0.6, 1.0], 1.15],
  mars: [[1.0, 0.45, 0.15], 1.1],
  ice: [[0.65, 0.95, 1.0], 1.3],
  lava: [[1.0, 0.35, 0.1], 1.1],
  candy: [[1.0, 0.6, 0.85], 1.1],
  ocean: [[0.2, 0.92, 0.88], 1.25],
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

const faultCache = new Map<PlanetId, DataTexture>();

/** The planet's plate borders (built once per planet, then reused). */
function faultTexture(id: PlanetId): DataTexture {
  const cached = faultCache.get(id);
  if (cached) return cached;
  const t = new DataTexture(
    buildFaultMap(faultSeed(id)),
    FAULT_W,
    FAULT_H,
    RGBAFormat,
    UnsignedByteType
  );
  t.colorSpace = LinearSRGBColorSpace;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  t.wrapS = RepeatWrapping;
  t.needsUpdate = true;
  faultCache.set(id, t);
  return t;
}

/** Shared by both shaders: how much of a fault is showing at this texel. */
const FAULT_GLSL = `
uniform sampler2D faultMap;
uniform float uCrack;
uniform float uRelief;
// x: how close to a plate border (1 on it), y: 1 once its border is open.
vec2 psFault(vec2 uv) {
  vec4 f = texture2D(faultMap, uv);
  float open = 1.0 - smoothstep(uCrack - 0.1, uCrack, f.g);
  return vec2(f.r, open);
}`;

interface FxUniforms {
  uMolten: { value: number };
  uVapor: { value: number };
  uConsumed: { value: number };
  uFrozen: { value: number };
  uPulse: { value: number };
  uTime: { value: number };
  uCrack: { value: number };
  /** 1 while playing; eases down in the endings (scales the fault sink). */
  uRelief: { value: number };
}

/** Eases the fault lines toward what the planet's health calls for. */
function applyCrack(fx: FxUniforms, health: number, dt: number) {
  fx.uCrack.value = easeCrack(fx.uCrack.value, crackTarget(health), dt);
}

/**
 * Chunks share the planet material but their cut faces do not displace, so
 * outside "playing" the relief eases down (uniforms only, no recompile).
 * A new material (planet switch) snaps to where it should be.
 */
function easeRelief(
  fx: FxUniforms,
  material: MeshStandardMaterial,
  isPlaying: boolean,
  dt: number,
  seenFor: { current: MeshStandardMaterial | null }
) {
  const target = isPlaying ? 1 : ENDING_RELIEF;
  const snap = seenFor.current !== material;
  seenFor.current = material;
  const step = snap ? 1 : Math.min(1, dt / RELIEF_EASE_SECONDS);
  const k = fx.uRelief.value + (target - fx.uRelief.value) * step;
  fx.uRelief.value = Math.abs(k - target) < 0.001 ? target : k;
  material.displacementScale = DISPLACEMENT_SCALE * fx.uRelief.value;
  material.displacementBias = (-material.displacementScale * 128) / 255;
}

/** Copies the ending state into the shader uniforms. */
function applyFxUniforms(
  fx: FxUniforms,
  atmosphere: { strength: { value: number }; base: { value: number } },
  time: number
) {
  fx.uMolten.value = planetFx.molten;
  fx.uVapor.value = planetFx.vapor;
  fx.uConsumed.value = planetFx.consumed;
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
      uVapor: { value: 0 },
      uConsumed: { value: 0 },
      uFrozen: { value: 0 },
      uPulse: { value: 0 },
      uTime: { value: 0 },
      uCrack: { value: 0 },
      uRelief: { value: 1 },
    }),
    []
  );
  const outer = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const earth = textures.id === "earth";
  const faults = useMemo(() => faultTexture(textures.id), [textures.id]);

  const material = useMemo(() => {
    const m = new MeshStandardMaterial({
      map: day,
      roughness: 0.9,
      metalness: 0,
      bumpMap: maps.height,
      bumpScale: BUMP_SCALE,
      displacementMap: maps.height,
      displacementScale: DISPLACEMENT_SCALE,
      // Grey 128 is the untouched surface: no change in radius.
      displacementBias: (-DISPLACEMENT_SCALE * 128) / 255,
    });
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.damageMap = { value: maps.damage };
      shader.uniforms.glowMap = { value: maps.glow };
      shader.uniforms.lightsMap = { value: maps.lights };
      shader.uniforms.heightMap = { value: maps.height };
      shader.uniforms.faultMap = { value: faults };
      shader.uniforms.sunDirView = { value: sunDirView };
      shader.uniforms.oceanLift = { value: earth ? 1 : 0 };
      Object.assign(shader.uniforms, fxUniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vObj;
${FAULT_GLSL}`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vObj = position;`
        )
        .replace(
          "#include <displacementmap_vertex>",
          `// Relief fades out at the poles, where the sphere's rows pinch to a point.
float psPole = 1.0 - smoothstep(0.97, 0.995, abs(normalize(objectNormal).y));
#ifdef USE_DISPLACEMENTMAP
transformed += normalize(objectNormal) * (texture2D(displacementMap, vDisplacementMapUv).x * displacementScale + displacementBias) * psPole;
#endif
if (uCrack > 0.001) {
  // Open borders sink into real grooves (a wide, soft V so the vertices see it).
  vec2 psF = psFault(vMapUv);
  transformed -= normalize(objectNormal) * 0.02 * uRelief * psPole * psF.y * smoothstep(0.15, 1.0, psF.x);
}`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform sampler2D damageMap;
uniform sampler2D glowMap;
uniform sampler2D lightsMap;
uniform sampler2D heightMap;
uniform vec3 sunDirView;
uniform float oceanLift;
uniform float uMolten;
uniform float uVapor;
uniform float uConsumed;
uniform float uFrozen;
uniform float uPulse;
uniform float uTime;
varying vec3 vObj;
${FAULT_GLSL}
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
}
// Distance to the nearest and second-nearest cell point (Voronoi borders).
vec2 psCells(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 c = i + g;
        vec3 o = vec3(psHash(c), psHash(c + 17.3), psHash(c + 41.9));
        float d = length(g + o - f);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
  }
  return vec2(d1, d2);
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
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.5, 0.12), smoothstep(0.0, 0.6, uVapor));
// Dug down to the core: magma shows where the ground is nearly gone.
float psDepth = texture2D(heightMap, vMapUv).r;
float psCore = 1.0 - smoothstep(0.08, 0.22, psDepth);
float psCorePulse = 0.85 + 0.15 * sin(uTime * 1.6 + psDepth * 40.0);
vec3 psMagma = mix(vec3(0.5, 0.03, 0.0), vec3(1.0, 0.4, 0.06), smoothstep(0.0, 0.2, psDepth) * 0.6 + 0.4 * psCorePulse);
diffuseColor.rgb = mix(diffuseColor.rgb, psMagma * 0.4, psCore);
float psFaultCore = 0.0;
if (uCrack > 0.001) {
  vec2 psF = psFault(vMapUv);
  float psW = mix(0.3, 0.65, uCrack);
  float psRock = psF.y * smoothstep(1.0 - psW * 1.3, 1.0 - psW * 0.7, psF.x);
  psFaultCore = psF.y * smoothstep(1.0 - psW * 0.3, 1.0 - psW * 0.08, psF.x);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.03, 0.025), psRock * 0.9);
}
float psHeat = 0.0;
vec3 psLava = vec3(0.0);
if (uMolten + uPulse > 0.0) {
  psHeat = psFbm(vObj * 3.2 + vec3(0.0, uTime * 0.15, 0.0));
  psLava = mix(vec3(0.55, 0.04, 0.0), vec3(1.0, 0.6, 0.12), smoothstep(0.42, 0.8, psHeat));
  diffuseColor.rgb = mix(diffuseColor.rgb, psLava * 0.45, uMolten);
}
float psSeam = 0.0;
float psBrush = 0.0;
if (uConsumed > 0.0) {
  // Brushed silver: noise stretched into fine streaks around the planet.
  psBrush = psNoise(vec3(vObj.x * 4.0, vObj.y * 90.0, vObj.z * 4.0));
  vec3 psSilver = mix(vec3(0.5, 0.53, 0.58), vec3(0.9, 0.93, 0.97), psBrush);
  diffuseColor.rgb = mix(diffuseColor.rgb, psSilver, uConsumed);
  vec2 psC = psCells(vObj * 3.4);
  psSeam = 1.0 - smoothstep(0.0, 0.07, psC.y - psC.x);
}`
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.35, uConsumed);`
        )
        .replace(
          "#include <metalnessmap_fragment>",
          `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.9, uConsumed);`
        )
        .replace(
          "#include <emissivemap_fragment>",
          `float nightK = smoothstep(0.1, -0.2, dot(normal, sunDirView));
totalEmissiveRadiance += texture2D(lightsMap, vMapUv).rgb * nightK
  + texture2D(glowMap, vMapUv).rgb * 1.5;
totalEmissiveRadiance += vec3(1.0, 0.36, 0.04) * psFaultCore * (0.9 + 0.35 * sin(uTime * 2.0 + vObj.x * 9.0));
totalEmissiveRadiance += psMagma * psCore * psCorePulse * 1.2;
totalEmissiveRadiance += psLava * uMolten * (0.45 + 0.8 * psHeat)
  + vec3(1.0, 0.45, 0.1) * uPulse * (0.35 + 0.9 * psHeat);
if (uConsumed > 0.0) {
  float psBeat = 0.65 + 0.35 * sin(uTime * 3.0 + psHash(floor(vObj * 3.4)) * 6.28);
  totalEmissiveRadiance += vec3(0.1, 0.55, 1.0) * psSeam * psBeat * 1.6 * uConsumed
    + vec3(0.2, 0.22, 0.26) * (0.5 + psBrush * 0.5) * uConsumed;
}
if (uVapor > 0.0) {
  // Orange first, then white-hot as the Sun takes the planet.
  vec3 psPlasma = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.95, 0.8), smoothstep(0.5, 1.0, uVapor));
  totalEmissiveRadiance += psPlasma * uVapor * (0.8 + 1.8 * uVapor);
}
if (uFrozen > 0.0) {
  float psSpark = pow(psHash(floor(vObj * 45.0) + floor(uTime * 4.0)), 40.0);
  totalEmissiveRadiance += vec3(0.04, 0.1, 0.18) * uFrozen
    + vec3(0.8, 0.95, 1.0) * psSpark * 3.0 * uFrozen;
}
#include <emissivemap_fragment>`
        );
    };
    return m;
  }, [day, maps, sunDirView, earth, fxUniforms, faults]);

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
  const reliefFor = useRef<MeshStandardMaterial | null>(null);
  useFrame(({ camera, clock }, delta) => {
    // The faults open as health drops; the endings take over once it is over.
    const { planet, phase } = useGameStore.getState();
    if (phase === "playing") {
      applyCrack(fxUniforms, planet?.health ?? 100, delta);
    }
    easeRelief(fxUniforms, material, phase === "playing", delta, reliefFor);
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
            <sphereGeometry args={[1, 384, 192]} />
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
