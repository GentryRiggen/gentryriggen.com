"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";

/**
 * The moonless sky of 14–15 April 1912: thousands of stars (sizes and
 * colours varied, a gentle twinkle), a faint Milky Way band and a very faint
 * glow at the horizon over a deep blue-black gradient. It follows the camera
 * so it is always at infinity. Two draw calls.
 */

const RADIUS = 14000;
const STAR_COUNT = 6000;

/** A small deterministic generator (no Math.random in the scene's data). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The galactic plane, tilted across the sky (a unit normal).
const BAND = [0.38, 0.52, 0.76];

const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const domeFragment = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uBand;
  uniform float uFade;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 zenith = vec3(0.0012, 0.0019, 0.0048);
    vec3 horizon = vec3(0.0075, 0.0110, 0.0200);
    vec3 c = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.5));
    // The faint glow along the horizon (airglow and starlight).
    c += vec3(0.0065, 0.0085, 0.0120) * exp(-abs(h) * 22.0);
    // The Milky Way: a soft band with dusty lanes.
    float b = dot(d, uBand);
    float band = exp(-b * b / 0.018);
    float dust = noise(d * 9.0) * 0.6 + noise(d * 23.0) * 0.4;
    float lanes = smoothstep(0.35, 0.75, noise(d * 14.0 + 3.1));
    c += vec3(0.016, 0.017, 0.022) * band * (0.5 + dust) * (1.0 - 0.6 * lanes * band);
    // Below the horizon (seen from under the sea surface's edge): dark.
    c *= smoothstep(-0.08, 0.0, h) * 0.9 + 0.1;
    gl_FragColor = vec4(c * uFade, 1.0);
  }
`;

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.75 + 0.25 * sin(uTime * (1.3 + aSeed * 2.7) + aSeed * 40.0);
    vec3 dir = normalize(position);
    // Stars dim and redden through the thick air near the horizon.
    float alt = clamp(dir.y, 0.0, 1.0);
    float ext = smoothstep(0.0, 0.25, alt);
    vAlpha = tw * (0.25 + 0.75 * ext);
    vColor = mix(aColor * vec3(1.0, 0.85, 0.7), aColor, ext);
    gl_PointSize = aSize * uPixelRatio;
  }
`;
const starFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uFade;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p) * 2.0;
    float core = exp(-r * r * 6.0);
    if (r > 1.0) discard;
    gl_FragColor = vec4(vColor * core * vAlpha * uFade, 1.0);
  }
`;

function starGeometry(): BufferGeometry {
  const rnd = mulberry32(1912);
  const pos = new Float32Array(STAR_COUNT * 3);
  const size = new Float32Array(STAR_COUNT);
  const color = new Float32Array(STAR_COUNT * 3);
  const seed = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i += 1) {
    // Uniform on the sphere, with more stars along the Milky Way.
    let x = 0;
    let y = 0;
    let z = 0;
    for (let tries = 0; tries < 4; tries += 1) {
      const u = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      x = s * Math.cos(a);
      y = u;
      z = s * Math.sin(a);
      const b = x * BAND[0] + y * BAND[1] + z * BAND[2];
      if (rnd() < 0.35 + 0.65 * Math.exp((-b * b) / 0.03)) break;
    }
    if (y < -0.05) y = -y; // keep them above the horizon
    pos[i * 3] = x * RADIUS;
    pos[i * 3 + 1] = y * RADIUS;
    pos[i * 3 + 2] = z * RADIUS;
    // Most are faint; a few bright ones.
    const m = rnd();
    size[i] = 1.1 + Math.pow(m, 9) * 4.2;
    const bright = 0.35 + Math.pow(m, 4) * 2.6;
    const temp = rnd();
    const r = temp < 0.2 ? 1 : temp < 0.7 ? 0.9 : 0.75;
    const g = temp < 0.2 ? 0.86 : temp < 0.7 ? 0.93 : 0.85;
    const bl = temp < 0.2 ? 0.7 : 1;
    color[i * 3] = r * bright;
    color[i * 3 + 1] = g * bright;
    color[i * 3 + 2] = bl * bright;
    seed[i] = rnd();
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aSize", new BufferAttribute(size, 1));
  g.setAttribute("aColor", new BufferAttribute(color, 3));
  g.setAttribute("aSeed", new BufferAttribute(seed, 1));
  return g;
}

interface SkyProps {
  /** Device pixel ratio, for the stars' point size. */
  dpr: number;
}

export default function Sky({ dpr }: SkyProps) {
  const sky = useMemo(() => {
    const group = new Group();
    group.name = "sky";
    const domeGeo = new SphereGeometry(RADIUS * 1.05, 32, 16);
    const domeMat = new ShaderMaterial({
      vertexShader: domeVertex,
      fragmentShader: domeFragment,
      side: BackSide,
      depthWrite: false,
      uniforms: { uBand: { value: BAND }, uFade: { value: 1 } },
    });
    const dome = new Mesh(domeGeo, domeMat);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    const starGeo = starGeometry();
    const starMat = new ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uFade: { value: 1 },
      },
    });
    const stars = new Points(starGeo, starMat);
    stars.renderOrder = -9;
    stars.frustumCulled = false;
    group.add(dome, stars);
    return { group, domeGeo, domeMat, starGeo, starMat };
  }, []);

  useEffect(
    () => () => {
      sky.domeGeo.dispose();
      sky.domeMat.dispose();
      sky.starGeo.dispose();
      sky.starMat.dispose();
    },
    [sky]
  );

  useFrame((state) => {
    sky.group.position.copy(state.camera.position);
    sky.starMat.uniforms.uTime.value = state.clock.elapsedTime;
    sky.starMat.uniforms.uPixelRatio.value = dpr;
    const under = state.camera.position.y < 0;
    sky.group.visible = !under;
    // Before the sea's reflection pass (-0.5), after the camera rig (-1).
  }, -0.7);

  return <primitive object={sky.group} />;
}

// ---------------------------------------------------------------------------
// The afternoon of 7 May 1915: a clear spring sky over a light haze.

const daySkyFragment = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    // Deep blue overhead, paling to the haze at the horizon.
    vec3 c = mix(uHorizon, uZenith, pow(h, 0.32));
    c = mix(c, uHorizon * 1.04, exp(-h * 30.0) * 0.6);
    // Brighter toward the sun (forward scattering in the haze).
    float cs = max(dot(d, uSunDir), 0.0);
    c += uSunColor * (0.06 * pow(cs, 4.0) + 0.22 * pow(cs, 48.0) + 1.2 * pow(cs, 900.0));
    // The disc (0.27° across), bright enough to bloom.
    c += uSunColor * 24.0 * smoothstep(0.99997, 0.999989, cs);
    // Below the horizon (the sea's edge from under it): the haze.
    if (d.y < 0.0) c = uHorizon * mix(1.0, 0.75, clamp(-d.y * 4.0, 0.0, 1.0));
    gl_FragColor = vec4(c, 1.0);
  }
`;

interface DaySkyProps {
  /** Toward the sun (unit, scene axes). */
  sunDir: readonly [number, number, number];
  /** The haze at the horizon (linear; the fog's colour). */
  horizon: Color;
}

/**
 * The sky of a sunny afternoon: blue overhead, a pale haze at the horizon
 * the fog fades into, the sun's glow and disc. No stars. One draw call.
 */
export function DaySky({ sunDir, horizon }: DaySkyProps) {
  const sky = useMemo(() => {
    const geo = new SphereGeometry(RADIUS * 1.05, 32, 16);
    const mat = new ShaderMaterial({
      vertexShader: domeVertex,
      fragmentShader: daySkyFragment,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: new Vector3() },
        uSunColor: { value: new Color().setRGB(1, 0.93, 0.82) },
        uZenith: { value: new Color().setRGB(0.045, 0.16, 0.55) },
        uHorizon: { value: new Color() },
      },
    });
    const dome = new Mesh(geo, mat);
    dome.name = "day-sky";
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    return { dome, geo, mat };
  }, []);
  useEffect(() => {
    (sky.mat.uniforms.uSunDir.value as Vector3)
      .set(sunDir[0], sunDir[1], sunDir[2])
      .normalize();
    (sky.mat.uniforms.uHorizon.value as Color).copy(horizon);
  }, [sky, sunDir, horizon]);
  useEffect(
    () => () => {
      sky.geo.dispose();
      sky.mat.dispose();
    },
    [sky]
  );
  useFrame((state) => {
    sky.dome.position.copy(state.camera.position);
    sky.dome.visible = state.camera.position.y >= 0;
  }, -0.7);
  return <primitive object={sky.dome} />;
}
