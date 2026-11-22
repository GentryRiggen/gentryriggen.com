"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  LinearSRGBColorSpace,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import type { QualityTier } from "@/lib/shipwreck/playback";
import { MAX_LAMPS, type SceneRuntime } from "./runtime";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { WaveFieldArrays } from "@/lib/shipwreck/sim/waves";
import type { SceneSettings } from "./settings";
import { STORM_NIGHT_WHITE, stormDaylight } from "./storm";
import {
  SEA_WAVES_GLSL,
  createSeaWaves,
  packSeaWaves,
  windOf,
} from "./seaWaves";

/**
 * The Fitzgerald's sea: the storm's own waves (`seaWaves.ts`: the track's
 * storm, the sim's `boardingElevation`), drawn on a disc of rings round
 * the camera, fine near it (1.5–3.5 m) and coarser outward, flattening to
 * the still sea past WAVE_R (the snow and the dusk hide it long before).
 * Grey-green fresh water, the light through the crests, foam on the
 * crests and streaks of it down the wind, and her deck lamps' light on the
 * water near her. No mirror (a second scene pass, and wrong on 7 m waves).
 * One draw. From below it is the surface seen from under the water.
 */

/** The rings per tier: segments round, the finest spacing (m). */
const RINGS: Record<QualityTier, { seg: number; min: number }> = {
  high: { seg: 256, min: 1.5 },
  medium: { seg: 160, min: 2.5 },
  low: { seg: 112, min: 3.5 },
};
/** The waves reach this far from the camera (m); a flat skirt beyond. */
const WAVE_R = 6000;
const SKIRT_R = 30000;

/** The ring radii for a tier: even near the centre, then geometric. */
export function seaRingRadii(seg: number, min: number): number[] {
  const beta = (2 * Math.PI) / seg;
  const r = [0];
  let x = 0;
  while (x < WAVE_R) {
    x += Math.max(min, beta * x);
    r.push(x);
  }
  r.push(SKIRT_R);
  return r;
}

function buildRings(tier: QualityTier): BufferGeometry {
  const { seg, min } = RINGS[tier];
  const radii = seaRingRadii(seg, min);
  const rings = radii.length - 1;
  const n = 1 + rings * seg;
  const pos = new Float32Array(n * 3);
  const spacing = new Float32Array(n);
  spacing[0] = min;
  for (let j = 1; j <= rings; j += 1) {
    const r = radii[j];
    const sp = Math.max(min, r - radii[j - 1]);
    for (let i = 0; i < seg; i += 1) {
      const a = (i / seg) * Math.PI * 2;
      const v = 1 + (j - 1) * seg + i;
      pos[v * 3] = Math.cos(a) * r;
      pos[v * 3 + 2] = Math.sin(a) * r;
      spacing[v] = sp;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < seg; i += 1) idx.push(0, 1 + ((i + 1) % seg), 1 + i);
  for (let j = 1; j < rings; j += 1) {
    const a0 = 1 + (j - 1) * seg;
    const b0 = 1 + j * seg;
    for (let i = 0; i < seg; i += 1) {
      const i1 = (i + 1) % seg;
      idx.push(a0 + i, a0 + i1, b0 + i, a0 + i1, b0 + i1, b0 + i);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aSpacing", new BufferAttribute(spacing, 1));
  g.setIndex(idx);
  return g;
}

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aSpacing;
  ${SEA_WAVES_GLSL}
  uniform float uWaveR;
  varying vec3 vWorld;
  varying vec2 vLocal;
  varying vec3 vNormal;
  varying float vE;
  void main() {
    // Earth (x, y) offset from the centre: three x, -three z.
    vec2 d = vec2(position.x, -position.z);
    float r = length(d);
    float calm = 1.0 - smoothstep(uWaveR * 0.55, uWaveR, r);
    vec3 w = seaWave(d, aSpacing) * calm;
    vec3 p = vec3(position.x, w.x, position.z);
    vNormal = normalize(vec3(-w.y, 1.0, w.z));
    vE = w.x;
    vLocal = position.xz;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

/** Her deck lamps the sea catches (`runtime.lamps`). */
export const SEA_LAMPS = 8;

const fragment = /* glsl */ `
  #include <fog_pars_fragment>
  varying vec3 vWorld;
  varying vec2 vLocal;
  varying vec3 vNormal;
  varying float vE;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uHs;
  uniform float uLight;
  uniform float uWhite;
  uniform vec2 uNoise;
  uniform vec2 uWind;
  uniform vec3 uDeep;
  uniform vec3 uScatter;
  uniform vec3 uSkyLow;
  uniform vec3 uSkyHigh;
  uniform vec3 uFoam;
  uniform vec3 uUnder;
  uniform vec3 uLamps[${SEA_LAMPS}];
  uniform int uLampCount;
  uniform float uLampPower;
  // Her hull on the sea: centre (from the mesh's centre, three x, z), her
  // heading's cos and sin; half-length, half-beam, 1 while she floats.
  uniform vec4 uHull;
  uniform vec3 uHullSize;
  // Her deck edge's height at her middle and its slope along her (her
  // trim): where the sea stands over it she is awash.
  uniform vec2 uDeck;

  // The lattice cell is taken mod 289 first (exact for whole floats), so
  // the hash keeps its precision however far the noise's argument runs
  // (the sea's time drifts it to about 12,000 by 7 PM): the pattern
  // repeats every 289 cells, and nothing ever wraps or jumps.
  float hash(vec2 p) {
    p = mod(p, 289.0);
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // Smooth noise: rotated octaves (no value-noise squares).
  float fbm(vec2 p) {
    float f = 0.0;
    float a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      f += a * noise(p);
      p = r * p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return f;
  }
  // Wind-driven chop on the big waves.
  float chop(vec2 p) {
    float t = uTime;
    float h = noise(p * 0.21 + uWind * t * 0.25) * 0.55;
    h += noise(p * 0.63 - uWind.yx * t * 0.31) * 0.3;
    h += noise(p * 1.9 + uWind * t * 0.9) * 0.15;
    return h;
  }
  // Her lamps' light on the water (and their glint), falling off with distance.
  vec3 lamps(vec3 n, vec3 v) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < ${SEA_LAMPS}; i++) {
      if (i >= uLampCount) break;
      vec3 l = uLamps[i] - vWorld;
      float d = length(l);
      l /= d;
      float fall = 1.0 / (1.0 + d * d / 160.0);
      float diff = max(dot(n, l), 0.0);
      float spec = pow(max(dot(reflect(-l, n), v), 0.0), 40.0);
      sum += (diff * 0.12 + spec * 1.0) * fall;
    }
    return vec3(1.0, 0.86, 0.62) * sum * uLampPower;
  }

  void main() {
    vec3 toEye = cameraPosition - vWorld;
    float dist = length(toEye);
    vec3 v = toEye / dist;
    vec2 p = vLocal + uNoise;
    float fine = clamp(1.0 - dist / 900.0, 0.0, 1.0);
    // Foam detail thins out far off (it would shimmer).
    float fine2 = clamp(1.0 - dist / 4000.0, 0.3, 1.0);
    float e = 0.7;
    float h0 = chop(p);
    vec2 grad = vec2(chop(p + vec2(e, 0.0)) - h0, chop(p + vec2(0.0, e)) - h0) / e;
    vec3 n = normalize(normalize(vNormal) + vec3(-grad.x, 0.0, -grad.y) * 0.55 * fine);

    // Whitecaps on the crests (by the sea's height now), more on the
    // faces running down the wind, broken up by smooth noise.
    vec3 vn = normalize(vNormal);
    float front = smoothstep(0.0, 0.12, dot(vn.xz, uWind));
    float crest = smoothstep(0.28 * uHs, 0.6 * uHs, vE);
    float breakup = fbm(p * 0.06 + uWind * uTime * 0.25);
    float foam = crest * smoothstep(0.56, 0.74, breakup + 0.1 * crest + 0.08 * front);
    // Beaufort 10: dense streaks of foam along the wind, in broad rows.
    vec2 along = vec2(dot(p, uWind), dot(p, vec2(-uWind.y, uWind.x)));
    float rows = noise(vec2(along.x * 0.02, along.y * 0.4) - vec2(uTime * 0.08, 0.0)) * 0.65
      + noise(vec2(along.x * 0.05, along.y * 0.9) + 3.1) * 0.35;
    foam += smoothstep(0.66, 0.92, rows) * 0.12 * smoothstep(20.0, 60.0, dist)
      * (0.5 + 0.5 * noise(p * 0.3));
    // White water where the sea meets her hull, and over her deck where
    // a sea stands on it (the sea drawn there is above her deck).
    if (uHullSize.z > 0.5) {
      vec2 d = vLocal - uHull.xy;
      float sx = dot(d, vec2(uHull.z, -uHull.w));
      float sy = dot(d, vec2(-uHull.w, -uHull.z));
      float ends = smoothstep(0.7 * uHullSize.x, uHullSize.x, abs(sx));
      vec2 q = vec2(abs(sx) - uHullSize.x, abs(sy) - uHullSize.y * (1.0 - 0.55 * ends));
      float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      float churn = 0.55 + 0.45 * fbm(p * 0.35 - uWind * uTime * 0.6);
      foam += (1.0 - smoothstep(0.0, 7.0, sd)) * step(-0.6, sd) * 0.8 * churn;
      foam += (1.0 - step(-0.6, sd)) * churn * 1.2;
      // Awash: the sea breaking over her deck edge and just off it.
      float deck = uDeck.x + uDeck.y * sx;
      foam += (1.0 - smoothstep(4.0, 16.0, sd)) * smoothstep(-0.6, 0.6, vE - deck) * churn;
    }
    foam = clamp(foam, 0.0, 1.0) * fine2;

    vec3 lit = lamps(n, v);
    // White things keep a floor of light at night (her deck lights
    // scattered by the snow and the cloud: a look, not physics).
    float white = max(uLight, uWhite);

    if (!gl_FrontFacing) {
      // From under the water: a dim grey window overhead, dark beyond.
      float up = clamp(-v.y, 0.0, 1.0);
      vec3 c = mix(uUnder * 0.2, uUnder, pow(up, 3.0)) * (0.2 + 0.8 * uLight);
      c += uFoam * foam * 0.15 * white;
      gl_FragColor = vec4(c, 1.0);
      #include <fog_fragment>
      return;
    }

    float cosT = clamp(dot(n, v), 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uSkyLow, uSkyHigh, pow(clamp(r.y, 0.0, 1.0), 0.6));
    // Grey-green water, the light coming through the thin crests.
    float through = smoothstep(-0.3 * uHs, 0.5 * uHs, vE) * (1.0 - cosT * 0.4);
    vec3 body = (uDeep + uScatter * through * 1.6) * uLight;
    vec3 c = mix(body, sky, clamp(fres + 0.03, 0.0, 1.0));
    c += lit * (0.4 + foam);
    vec3 foamLit = uFoam * (white * (0.55 + 0.45 * n.y)) + lit * 2.0;
    c = mix(c, foamLit, foam * 0.85);
    gl_FragColor = vec4(c, uOpacity);
    #include <fog_fragment>
  }
`;

interface StormSeaProps {
  runtime: SceneRuntime;
  quality: QualityTier;
  xray: boolean;
  settings: SceneSettings;
  /** The ship on the stage (her length and beam, for the foam at her hull). */
  spec: ShipSpec;
}

export default function StormSea({
  runtime,
  quality,
  xray,
  settings,
  spec,
}: StormSeaProps) {
  const { camera } = useThree();
  const geometry = useMemo(() => buildRings(quality), [quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: DoubleSide,
        fog: true,
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          {
            uWave: { value: null },
            uGroupA: { value: null },
            uGroupB: { value: null },
            uWaveCount: { value: 0 },
            uGroupCount: { value: 0 },
            uMeanK: { value: 0 },
            uWaveR: { value: WAVE_R },
            uTime: { value: 0 },
            uOpacity: { value: 1 },
            uHs: { value: 1 },
            uLight: { value: 1 },
            uNoise: { value: new Vector2() },
            uWind: { value: new Vector2(1, 0) },
            uDeep: {
              value: new Color().setRGB(
                0.013,
                0.021,
                0.02,
                LinearSRGBColorSpace
              ),
            },
            uScatter: {
              value: new Color().setRGB(
                0.024,
                0.042,
                0.036,
                LinearSRGBColorSpace
              ),
            },
            uSkyLow: { value: new Color() },
            uSkyHigh: { value: new Color() },
            uFoam: {
              value: new Color().setRGB(0.62, 0.66, 0.66, LinearSRGBColorSpace),
            },
            uUnder: { value: new Color() },
            uLamps: { value: new Float32Array(3 * MAX_LAMPS) },
            uLampCount: { value: 0 },
            uLampPower: { value: 0 },
            uWhite: { value: STORM_NIGHT_WHITE },
            uHull: { value: new Vector4() },
            uHullSize: { value: new Vector3() },
            uDeck: { value: new Vector2() },
          },
        ]),
      }),
    []
  );
  // The wave arrays (typed arrays upload as they are), set on the
  // material each frame (no side effects in render).
  const waves = useMemo(() => createSeaWaves(), []);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.transparent = xray;
    material.depthWrite = !xray;
    material.uniforms.uOpacity.value = xray ? 0.28 : 1;
    material.needsUpdate = true;
  }, [material, xray]);

  const mesh = useMemo(() => {
    const m = new Mesh(geometry, material);
    m.name = "sea";
    m.renderOrder = -1;
    // The vertices move in the shader: never culled.
    m.frustumCulled = false;
    return m;
  }, [geometry, material]);

  const fogColor = useMemo(() => new Color(settings.fog), [settings]);
  const scratch = useMemo(
    () => ({
      anchorX: 0,
      anchorZ: 0,
      field: null as WaveFieldArrays | null,
      wind: new Vector2(1, 0),
    }),
    []
  );
  // Set once (a string colour parsed every frame allocates).
  useEffect(() => {
    (material.uniforms.uUnder.value as Color).set(settings.underwaterFog);
  }, [material, settings]);
  const hullSize = useMemo(() => {
    const xs = spec.stations.map((st) => st.x);
    return {
      half: (Math.max(...xs) - Math.min(...xs)) / 2,
      mid: (Math.max(...xs) + Math.min(...xs)) / 2,
      beam: spec.beam / 2,
    };
  }, [spec]);

  // After the camera rig (priority -1), before the composer renders.
  useFrame(() => {
    const u = material.uniforms;
    const sea = runtime.sea;
    const cx = camera.position.x;
    const cz = camera.position.z;
    mesh.position.set(cx, 0, cz);
    const field = sea.field;
    u.uWave.value = waves.wave;
    u.uGroupA.value = waves.groupA;
    u.uGroupB.value = waves.groupB;
    if (!field) {
      u.uWaveCount.value = 0;
      u.uGroupCount.value = 0;
    } else {
      packSeaWaves(field, sea.t, cx, -cz, waves);
      u.uWaveCount.value = waves.count;
      u.uGroupCount.value = waves.groupCount;
      u.uMeanK.value = waves.meanK;
      u.uHs.value = Math.max(0.5, waves.hs);
      // The wind's way (three x, z): the waves' mean direction, again
      // whenever the field changes (another storm).
      if (scratch.field !== field) {
        windOf(field, scratch.wind);
        scratch.field = field;
      }
      (u.uWind.value as Vector2).copy(scratch.wind);
    }
    // The fine chop's noise about an anchor near the camera (float32).
    if (
      Math.abs(cx - scratch.anchorX) > 3000 ||
      Math.abs(cz - scratch.anchorZ) > 3000
    ) {
      scratch.anchorX = Math.round(cx / 1000) * 1000;
      scratch.anchorZ = Math.round(cz / 1000) * 1000;
    }
    (u.uNoise.value as Vector2).set(cx - scratch.anchorX, cz - scratch.anchorZ);
    // The sea's own time, continuous: the noise's hash takes its cell
    // mod 289, so a large drift (about 12,000 cells by 7 PM) keeps its
    // precision and nothing wraps.
    u.uTime.value = sea.t;
    // The light: the overcast's share now, never quite none (her lamps).
    const d = stormDaylight(runtime.frame?.t ?? 0);
    u.uLight.value = 0.05 + 0.95 * d;
    (u.uSkyLow.value as Color).copy(fogColor).multiplyScalar(0.04 + 0.96 * d);
    // The overcast is darker overhead than at the horizon: facets facing
    // us reflect the dark, the backs of the waves the bright haze.
    (u.uSkyHigh.value as Color)
      .copy(fogColor)
      .multiplyScalar(0.4 * (0.02 + 0.98 * d));
    u.uLamps.value = runtime.lamps;
    u.uLampCount.value = Math.min(SEA_LAMPS, runtime.lampCount);
    u.uLampPower.value = runtime.lampPower;
    // Her hull on the sea while she floats whole (not in X-ray, where the
    // sea inside her shows).
    const body = runtime.frame?.bodies[0];
    const floats =
      !xray &&
      body !== undefined &&
      runtime.frame?.bodies.length === 1 &&
      body.z > -30;
    if (body && floats) {
      const c = Math.cos(body.yaw);
      const sn = Math.sin(body.yaw);
      const mx = body.x + c * hullSize.mid;
      const my = body.y + sn * hullSize.mid;
      (u.uHull.value as Vector4).set(mx - cx, -my - cz, c, sn);
      (u.uHullSize.value as Vector3).set(hullSize.half, hullSize.beam, 1);
      // Her deck edge amidships (earth z) and its fall along her.
      (u.uDeck.value as Vector2).set(
        body.z + Math.cos(body.pitch) * spec.depth,
        -Math.sin(body.pitch)
      );
    } else (u.uHullSize.value as Vector3).set(0, 0, 0);
  }, -0.5);

  return <primitive object={mesh} />;
}
