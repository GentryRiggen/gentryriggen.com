"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  SpotLight,
  SRGBColorSpace,
  HemisphereLight,
  Vector3,
} from "three";
import type { SceneRuntime } from "./runtime";
import {
  NIGHT_DEEP_FOG,
  NIGHT_FOG,
  NIGHT_SEA_FOG,
  sunDirection,
  type SceneSettings,
} from "./settings";
import { lookUnderFog, walkAmbient } from "./walkCamera";

/**
 * Light, fog and the deep. The night (the Titanic): very low starlight
 * (hemisphere), the night fog to the horizon, and under the surface a
 * blue-black fog that thickens with depth, the mud of the sea floor at
 * `seaDepthM` and a submersible's lamp on the camera so the wreck is
 * readable. The afternoon (the Lusitania): the sun (a directional light at
 * the computed angles) and the blue sky (hemisphere), a light haze, and
 * under the surface green water with shafts of sunlight, dimming with
 * depth, over a floor of sand and shingle.
 */

const SEA_FOG = NIGHT_SEA_FOG;
const DEEP_FOG = NIGHT_DEEP_FOG;
/** The afternoon's haze (exp² density: the coast, 20 km off, half hidden). */
const DAY_FOG_DENSITY = 0.000027;
/** Sunlit sea water in the Celtic Sea: green near the top, darker down. */
const DAY_DEEP_WATER = new Color(0x0c3a33);

function sandTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#a89a7c";
  g.fillRect(0, 0, 256, 256);
  let a = 1915;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  // Soft ripples of sand, then shingle and shell.
  for (let i = 0; i < 180; i += 1) {
    const l = 52 + rnd() * 20;
    g.fillStyle = `hsla(40, 18%, ${l}%, 0.12)`;
    g.beginPath();
    g.ellipse(
      rnd() * 256,
      rnd() * 256,
      10 + rnd() * 30,
      3 + rnd() * 6,
      0.3,
      0,
      Math.PI * 2
    );
    g.fill();
  }
  for (let i = 0; i < 900; i += 1) {
    const l = 30 + rnd() * 55;
    const r = 0.6 + rnd() * 2.2;
    g.fillStyle = `hsla(${30 + rnd() * 20}, ${8 + rnd() * 12}%, ${l}%, 0.85)`;
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 256, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 3000; i += 1) {
    const l = 40 + rnd() * 45;
    g.fillStyle = `hsla(40, 12%, ${l}%, 0.5)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1, 1);
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(1200, 1200);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function mudTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#4a4136";
  g.fillRect(0, 0, 256, 256);
  // Deterministic speckle and soft blotches.
  let a = 77;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  for (let i = 0; i < 260; i += 1) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 6 + rnd() * 26;
    const l = 50 + rnd() * 30;
    g.fillStyle = `hsla(34, 14%, ${l}%, 0.10)`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 4000; i += 1) {
    const l = 20 + rnd() * 50;
    g.fillStyle = `hsla(30, 10%, ${l}%, 0.5)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1, 1);
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(160, 160);
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface EnvironmentProps {
  runtime: SceneRuntime;
  /** The sea floor's depth under the ship on the stage (m). */
  seaDepthM: number;
  /** The ship's scene (night or afternoon). */
  settings: SceneSettings;
}

export default function Environment({
  runtime,
  seaDepthM,
  settings,
}: EnvironmentProps) {
  if (settings.timeOfDay === "afternoon")
    return (
      <AfternoonEnvironment
        runtime={runtime}
        seaDepthM={seaDepthM}
        settings={settings}
      />
    );
  return <NightEnvironment runtime={runtime} seaDepthM={seaDepthM} />;
}

function NightEnvironment({
  runtime,
  seaDepthM: SEA_DEPTH,
}: Omit<EnvironmentProps, "settings">) {
  const { scene, camera } = useThree();

  const fog = useMemo(() => new FogExp2(NIGHT_FOG.getHex(), 0.00011), []);
  useEffect(() => {
    scene.fog = fog;
    scene.background = new Color(0x02040a);
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog]);

  const floor = useMemo(() => {
    const map = mudTexture();
    const mat = new MeshStandardMaterial({
      color: 0x8a7f70,
      map,
      roughness: 1,
      metalness: 0,
    });
    const geo = new PlaneGeometry(24000, 24000);
    const m = new Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.name = "sea-floor";
    return { m, geo, mat, map };
  }, []);
  useEffect(() => {
    floor.m.position.y = -SEA_DEPTH;
  }, [floor, SEA_DEPTH]);
  useEffect(
    () => () => {
      floor.geo.dispose();
      floor.mat.dispose();
      floor.map?.dispose();
    },
    [floor]
  );

  // Starlight; a rocket's burst lights everything briefly (white).
  const sky = useMemo(() => {
    const h = new HemisphereLight(0x4a5c86, 0x06080e, 0.9);
    h.name = "starlight";
    return h;
  }, []);

  const lamp = useMemo(() => {
    const l = new SpotLight(0xd8ecff, 0, 420, 0.55, 0.6, 1.1);
    l.name = "submersible-lamp";
    return l;
  }, []);

  useFrame((state) => {
    const y = camera.position.y;
    const under = y < 0;
    if (under) {
      // Thicker and darker the deeper it goes.
      const k = Math.min(1, -y / 600);
      fog.color.copy(SEA_FOG).lerp(DEEP_FOG, k);
      // Look under (from the sea while walking): clearer, to watch her go.
      fog.density = lookUnderFog(
        "night",
        0.0065 - 0.002 * k,
        runtime.walkLookUnder
      );
      (scene.background as Color).copy(fog.color);
    } else {
      fog.color.copy(NIGHT_FOG);
      fog.density = 0.00011;
      (scene.background as Color).set(0x02040a);
    }
    floor.m.visible = y < -SEA_DEPTH + 2500;
    // The lamp rides on the camera, a little above, pointing where it looks.
    lamp.intensity = under ? Math.min(1, -y / 40) * 320 : 0;
    lamp.position.copy(camera.position);
    lamp.position.y += 1.5;
    state.camera.getWorldDirection(lamp.target.position);
    lamp.target.position.multiplyScalar(60).add(camera.position);
    lamp.target.updateMatrixWorld();
    runtime.underwater = under;
    // Walking: a faint lift so a child can see the deck.
    sky.intensity = walkAmbient(
      under ? 0.25 : 0.9 + runtime.flash * 5,
      runtime.walkInfo?.phase === "deck"
    );
  }, -0.8);

  return (
    <>
      <primitive object={sky} />
      <primitive object={floor.m} />
      <primitive object={lamp} />
      <primitive object={lamp.target} />
    </>
  );
}

function AfternoonEnvironment({
  runtime,
  seaDepthM: SEA_DEPTH,
  settings,
}: EnvironmentProps) {
  const { scene, camera } = useThree();
  const haze = useMemo(() => new Color(settings.fog), [settings]);
  const shallow = useMemo(() => new Color(settings.underwaterFog), [settings]);
  const sunDir = useMemo(
    () =>
      settings.sun
        ? sunDirection(settings.sun, settings.headingDeg ?? 90)
        : ([0, 1, 0] as [number, number, number]),
    [settings]
  );

  const fog = useMemo(
    () => new FogExp2(haze.getHex(), DAY_FOG_DENSITY),
    [haze]
  );
  useEffect(() => {
    fog.color.copy(haze);
    scene.fog = fog;
    scene.background = haze.clone();
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog, haze]);

  const floor = useMemo(() => {
    const map = sandTexture();
    const mat = new MeshStandardMaterial({
      color: 0xc8bc9e,
      map,
      roughness: 1,
      metalness: 0,
    });
    const caustics = { uTime: { value: 0 }, uCaustic: { value: 0 } };
    // Sunlight's ripples dancing on the sand (faint at 93 m).
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, caustics);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vCausticXZ;"
        )
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nvCausticXZ = (modelMatrix * vec4(transformed, 1.0)).xz;"
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec2 vCausticXZ;
uniform float uTime;
uniform float uCaustic;
float causticAt(vec2 p) {
  // Two warped ripple layers at odd angles: a loose, moving net of light.
  vec2 q = p * 0.13;
  q += vec2(sin(q.y * 0.7 + uTime * 0.3), cos(q.x * 0.6 - uTime * 0.25)) * 1.4;
  float a = sin(q.x * 1.3 + q.y * 0.4 + uTime * 0.5);
  float b = sin(q.y * 1.1 - q.x * 0.5 - uTime * 0.4);
  float c1 = pow(1.0 - abs(a * b), 9.0);
  vec2 r = p * 0.21 + vec2(3.1, 1.7);
  float d = sin(r.x * 0.9 - r.y * 1.2 + uTime * 0.6) * sin(r.y * 0.8 + r.x * 0.3 - uTime * 0.35);
  return c1 * (0.4 + 0.6 * pow(1.0 - abs(d), 5.0));
}`
        )
        .replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.7, 0.95, 0.8) * causticAt(vCausticXZ) * uCaustic;"
        );
    };
    mat.customProgramCacheKey = () => "shipwreck-sand";
    const geo = new PlaneGeometry(24000, 24000);
    const m = new Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.name = "sea-floor";
    return { m, geo, mat, map, caustics };
  }, []);
  useEffect(() => {
    floor.m.position.y = -SEA_DEPTH;
  }, [floor, SEA_DEPTH]);
  useEffect(
    () => () => {
      floor.geo.dispose();
      floor.mat.dispose();
      floor.map?.dispose();
    },
    [floor]
  );

  const lights = useMemo(() => {
    const sun = new DirectionalLight(0xfff0d8, 4);
    sun.name = "sun";
    const sky = new HemisphereLight(0xa9c8ee, 0x2f4a4c, 0.75);
    sky.name = "skylight";
    const lamp = new SpotLight(0xd8ecff, 0, 300, 0.6, 0.6, 1.1);
    lamp.name = "submersible-lamp";
    return {
      sun,
      sky,
      lamp,
      warm: new Color(0xfff1dc),
      under: new Color(0x9fe0cf),
    };
  }, []);
  useEffect(() => {
    lights.sun.position
      .set(sunDir[0], sunDir[1], sunDir[2])
      .multiplyScalar(1000);
  }, [lights, sunDir]);

  const water = useMemo(() => new Color(), []);
  useFrame((state) => {
    const y = camera.position.y;
    const under = y < 0;
    const k = Math.min(1, Math.max(0, -y / SEA_DEPTH));
    if (under) {
      // Green and bright near the top, dimmer toward the floor.
      water.copy(shallow).lerp(DAY_DEEP_WATER, k * 0.85);
      fog.color.copy(water);
      fog.density = lookUnderFog(
        "afternoon",
        0.0085 + 0.004 * k,
        runtime.walkLookUnder
      );
      (scene.background as Color).copy(water);
      lights.sun.color.copy(lights.under);
      lights.sun.intensity = 4 * (0.45 - 0.33 * k);
      lights.sky.intensity = walkAmbient(
        0.95 - 0.55 * k,
        runtime.walkInfo?.phase === "deck"
      );
    } else {
      fog.color.copy(haze);
      fog.density = DAY_FOG_DENSITY;
      (scene.background as Color).copy(haze);
      lights.sun.color.copy(lights.warm);
      lights.sun.intensity = 4;
      lights.sky.intensity = walkAmbient(
        0.75,
        runtime.walkInfo?.phase === "deck"
      );
    }
    floor.m.visible = under;
    floor.caustics.uTime.value = state.clock.elapsedTime;
    floor.caustics.uCaustic.value = under ? 0.12 * (1 - 0.5 * k) : 0;
    const lamp = lights.lamp;
    lamp.intensity = under ? Math.min(1, -y / 50) * 160 : 0;
    lamp.position.copy(camera.position);
    lamp.position.y += 1.5;
    state.camera.getWorldDirection(lamp.target.position);
    lamp.target.position.multiplyScalar(60).add(camera.position);
    lamp.target.updateMatrixWorld();
    runtime.underwater = under;
  }, -0.8);

  return (
    <>
      <primitive object={lights.sun} />
      <primitive object={lights.sky} />
      <primitive object={floor.m} />
      <primitive object={lights.lamp} />
      <primitive object={lights.lamp.target} />
      <LightShafts sunDir={sunDir} seaDepthM={SEA_DEPTH} />
    </>
  );
}

const SHAFTS = 22;
const SHAFT_SPAN = 150;

const shaftVertex = /* glsl */ `
  attribute vec2 aBase;
  attribute vec2 aCorner;
  attribute float aSeed;
  uniform vec3 uCam;
  uniform vec3 uDown;
  uniform float uDepth;
  uniform float uSpan;
  varying float vAcross;
  varying float vDepth;
  varying float vSeed;
  void main() {
    // Each shaft stays within uSpan of the camera (wrapping as it moves).
    vec2 rel = mod(aBase - uCam.xz + uSpan * 0.5, uSpan) - uSpan * 0.5;
    vec3 top = vec3(uCam.x + rel.x, -0.5, uCam.z + rel.y);
    float len = uDepth / max(0.3, -uDown.y);
    vec3 p = top + uDown * len * aCorner.y;
    vec3 toCam = normalize(uCam - p);
    vec3 across = normalize(cross(uDown, toCam));
    float w = 1.5 + 4.0 * aSeed;
    p += across * aCorner.x * w * (1.0 + aCorner.y * 1.5);
    vAcross = aCorner.x;
    vDepth = -p.y;
    vSeed = aSeed;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const shaftFragment = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  varying float vAcross;
  varying float vDepth;
  varying float vSeed;
  void main() {
    float side = 1.0 - vAcross * vAcross;
    float fade = exp(-vDepth / 38.0) * smoothstep(0.0, 4.0, vDepth);
    float flicker = 0.55 + 0.45 * sin(uTime * (0.6 + vSeed) + vSeed * 40.0);
    float a = side * side * fade * flicker * uStrength;
    gl_FragColor = vec4(vec3(0.55, 0.85, 0.7) * a, 1.0);
  }
`;

/**
 * Shafts of sunlight slanting down through the green water (refracted: the
 * sun 50° up comes in about 29° from the vertical), fading with depth. Only
 * under water. One draw call.
 */
function LightShafts({
  sunDir,
  seaDepthM,
}: {
  sunDir: readonly [number, number, number];
  seaDepthM: number;
}) {
  const shafts = useMemo(() => {
    const pos = new Float32Array(SHAFTS * 4 * 3);
    const base = new Float32Array(SHAFTS * 4 * 2);
    const corner = new Float32Array(SHAFTS * 4 * 2);
    const seed = new Float32Array(SHAFTS * 4);
    const index: number[] = [];
    let a = 507;
    const rnd = () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
    for (let i = 0; i < SHAFTS; i += 1) {
      const bx = rnd() * SHAFT_SPAN;
      const bz = rnd() * SHAFT_SPAN;
      const s = rnd();
      const corners = [
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
      ];
      corners.forEach(([cx, cy], k) => {
        const v = i * 4 + k;
        base[v * 2] = bx;
        base[v * 2 + 1] = bz;
        corner[v * 2] = cx;
        corner[v * 2 + 1] = cy;
        seed[v] = s;
      });
      const o = i * 4;
      index.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aBase", new BufferAttribute(base, 2));
    geo.setAttribute("aCorner", new BufferAttribute(corner, 2));
    geo.setAttribute("aSeed", new BufferAttribute(seed, 1));
    geo.setIndex(index);
    const mat = new ShaderMaterial({
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uCam: { value: new Vector3() },
        uDown: { value: new Vector3() },
        uDepth: { value: 90 },
        uSpan: { value: SHAFT_SPAN },
        uTime: { value: 0 },
        uStrength: { value: 0.16 },
      },
    });
    const mesh = new Mesh(geo, mat);
    mesh.name = "light-shafts";
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    return { mesh, geo, mat };
  }, []);
  useEffect(() => {
    // Snell: sin(in water) = sin(from the vertical in air) / 1.33.
    const h = Math.hypot(sunDir[0], sunDir[2]);
    const sinAir = Math.min(1, h);
    const sinW = sinAir / 1.33;
    const cosW = Math.sqrt(1 - sinW * sinW);
    const hx = h > 1e-6 ? -sunDir[0] / h : 0;
    const hz = h > 1e-6 ? -sunDir[2] / h : 0;
    (shafts.mat.uniforms.uDown.value as Vector3).set(
      hx * sinW,
      -cosW,
      hz * sinW
    );
    shafts.mat.uniforms.uDepth.value = seaDepthM;
  }, [shafts, sunDir, seaDepthM]);
  useEffect(
    () => () => {
      shafts.geo.dispose();
      shafts.mat.dispose();
    },
    [shafts]
  );
  useFrame((state) => {
    const cam = state.camera.position;
    shafts.mesh.visible = cam.y < 0;
    (shafts.mat.uniforms.uCam.value as Vector3).copy(cam);
    shafts.mat.uniforms.uTime.value = state.clock.elapsedTime;
  }, -0.8);
  return <primitive object={shafts.mesh} />;
}
