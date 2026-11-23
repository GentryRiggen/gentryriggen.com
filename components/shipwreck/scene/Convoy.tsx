"use client";
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from "three";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import {
  CONVOY,
  convoyFade,
  convoyPose,
  convoyShown,
  hullDownM,
  scatterAtOf,
  type ConvoyPaint,
} from "./convoyMotion";

/**
 * The Carpathia's convoy (`convoyMotion.ts`, spec R12): six distant steamers
 * of one low-detail shape (a long hull with a raised forecastle and poop,
 * a midships house and bridge, one raked funnel, two masts), in grey or
 * dazzle, posed from the shown time. Lowered by the earth's curve
 * (hull-down, then gone) and faded into her haze. One instanced draw (and
 * its reflection at the high tier); not mounted at the low tier.
 */

/** The shape is built this long (m) and scaled to each ship's length. */
export const STEAMER_LENGTH_M = 120;

/** The parts, for the paint (the `aPart` attribute). */
const HULL = 0;
const HOUSE = 1;
const FUNNEL = 2;
const MAST = 3;

/**
 * The steamer's shape (non-indexed, flat normals), about 120 m long, the
 * bow at +x, the waterline at y 0 (the hull runs 1 m under it).
 */
export function buildSteamerGeometry(): BufferGeometry {
  const pos: number[] = [];
  const part: number[] = [];
  const tri = (
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
    p: number
  ) => {
    pos.push(...a, ...b, ...c);
    part.push(p, p, p);
  };
  const quad = (
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
    d: readonly number[],
    p: number
  ) => {
    tri(a, b, c, p);
    tri(a, c, d, p);
  };
  // Hull stations (x, half-breadth, deck height): a cruiser-ish stern, a
  // long parallel body, a fine bow; the poop and forecastle a deck higher.
  const st: readonly [number, number, number][] = [
    [-60, 4.6, 8.6],
    [-57, 6.8, 8.5],
    [-52, 7.8, 8.4],
    [-47, 8, 8.3],
    [-47, 8, 6.1],
    [-30, 8, 5.9],
    [30, 8, 6],
    [43, 7.4, 6.3],
    [43, 7.4, 8.8],
    [50, 5.8, 9.1],
    [56, 3.2, 9.4],
    [60, 0.4, 9.7],
  ];
  const keel = -1;
  for (let i = 0; i < st.length - 1; i += 1) {
    const [x0, b0, h0] = st[i];
    const [x1, b1, h1] = st[i + 1];
    if (x0 === x1) {
      // A break in the deck: the bulkhead across it.
      const lo = Math.min(h0, h1);
      const hi = Math.max(h0, h1);
      const face = h1 > h0 ? 1 : -1;
      const L = [x0, lo, b0];
      const R = [x0, lo, -b0];
      const LH = [x0, hi, b0];
      const RH = [x0, hi, -b0];
      if (face > 0) quad(R, L, LH, RH, HULL);
      else quad(L, R, RH, LH, HULL);
      continue;
    }
    // Starboard (+z), port (-z), deck.
    quad([x0, keel, b0], [x1, keel, b1], [x1, h1, b1], [x0, h0, b0], HULL);
    quad([x1, keel, -b1], [x0, keel, -b0], [x0, h0, -b0], [x1, h1, -b1], HULL);
    quad([x0, h0, b0], [x1, h1, b1], [x1, h1, -b1], [x0, h0, -b0], HOUSE);
  }
  // The transom and the stem's narrow end.
  {
    const [x, b, h] = st[0];
    quad([x, keel, -b], [x, keel, b], [x, h, b], [x, h, -b], HULL);
    const [xe, be, he] = st[st.length - 1];
    quad([xe, keel, be], [xe, keel, -be], [xe, he, -be], [xe, he, be], HULL);
  }
  const box = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    hz: number,
    p: number
  ) => {
    const v = (x: number, y: number, z: number) => [x, y, z];
    // +z, -z, +x, -x, top.
    quad(v(x0, y0, hz), v(x1, y0, hz), v(x1, y1, hz), v(x0, y1, hz), p);
    quad(v(x1, y0, -hz), v(x0, y0, -hz), v(x0, y1, -hz), v(x1, y1, -hz), p);
    quad(v(x1, y0, hz), v(x1, y0, -hz), v(x1, y1, -hz), v(x1, y1, hz), p);
    quad(v(x0, y0, -hz), v(x0, y0, hz), v(x0, y1, hz), v(x0, y1, -hz), p);
    quad(v(x0, y1, hz), v(x1, y1, hz), v(x1, y1, -hz), v(x0, y1, -hz), p);
  };
  // The midships house, the bridge on it (its wings across her), a
  // small house aft.
  box(-10, 16, 5.8, 9.2, 6.2, HOUSE);
  box(10, 14.5, 9.2, 12.4, 7.6, HOUSE);
  box(-36, -26, 5.8, 8.2, 3.5, HOUSE);
  // The funnel: ten sides, raked aft.
  {
    const n = 10;
    const r = 2.4;
    const x = 1;
    const y0 = 9.2;
    const y1 = 21;
    const rake = -1.6;
    for (let k = 0; k < n; k += 1) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const c0 = Math.cos(a0) * r;
      const s0 = Math.sin(a0) * r * 0.85;
      const c1 = Math.cos(a1) * r;
      const s1 = Math.sin(a1) * r * 0.85;
      quad(
        [x + c0, y0, s0],
        [x + c1, y0, s1],
        [x + rake + c1, y1, s1],
        [x + rake + c0, y1, s0],
        FUNNEL
      );
    }
  }
  // Two masts (a little thicker than true so they hold a pixel far off)
  // with a yard on the foremast.
  box(31, 31.8, 6, 30, 0.4, MAST);
  box(-33, -32.2, 6, 28, 0.4, MAST);
  box(31.1, 31.7, 24, 24.6, 4.5, MAST);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aPart", new BufferAttribute(new Float32Array(part), 1));
  g.computeVertexNormals();
  return g;
}

const PAINT_ID: Record<ConvoyPaint, number> = {
  grey: 0,
  dark: 1,
  "dazzle-a": 2,
  "dazzle-b": 3,
};

const vertexHead = /* glsl */ `
  attribute float aPart;
  attribute float aPaint;
  attribute float aFade;
  varying vec3 vLocal;
  varying float vPart;
  varying float vPaint;
  varying float vFade;
`;
const fragmentHead = /* glsl */ `
  varying vec3 vLocal;
  varying float vPart;
  varying float vPaint;
  varying float vFade;
  // 1918 British merchant greys and dazzle (linear): black, white, a
  // blue-grey and a mid grey; plain battle grey; a darker grey.
  const vec3 DZ_BLACK = vec3(0.012, 0.014, 0.016);
  const vec3 DZ_WHITE = vec3(0.72, 0.74, 0.74);
  const vec3 DZ_BLUE = vec3(0.13, 0.19, 0.27);
  const vec3 DZ_GREY = vec3(0.3, 0.32, 0.34);
  vec3 dazzle(vec3 p, float kind) {
    // Bold bands at an angle, the angle flipping at a break along her and
    // differing side to side (as dazzle did), so her line breaks up.
    float side = p.z > 0.0 ? 1.0 : -1.0;
    float brk = kind < 2.5 ? 8.0 : -14.0;
    float ang = (p.x > brk ? 0.9 : -0.6) * (kind < 2.5 ? 1.0 : -1.3);
    float w = kind < 2.5 ? 11.0 : 8.5;
    float f = fract((p.x * cos(ang) + p.y * 2.2 * sin(ang)) / w + side * 0.31 + kind * 0.17);
    float i = floor(f * 4.0);
    return i < 1.0 ? DZ_BLACK : i < 2.0 ? DZ_WHITE : i < 3.0 ? DZ_BLUE : DZ_GREY;
  }
  vec3 paintOf(vec3 p, float part, float kind) {
    if (part > 2.5) return vec3(0.03, 0.032, 0.035);
    if (part > 1.5) return kind > 0.5 && kind < 1.5 ? vec3(0.025, 0.026, 0.028) : vec3(0.12, 0.13, 0.14);
    if (kind > 1.5) return dazzle(p, kind);
    vec3 grey = kind > 0.5 ? vec3(0.07, 0.078, 0.085) : vec3(0.2, 0.22, 0.24);
    // The houses a shade lighter than the hull.
    return part > 0.5 ? grey * 1.35 : grey;
  }
`;

/** The smoke ribbon's segments along its length. */
const SMOKE_SEGMENTS = 10;

/** A ribbon along u (0 at the funnel, 1 at the far end) and v (-1..1). */
function buildSmokeGeometry(): InstancedBufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SMOKE_SEGMENTS; i += 1) {
    const u = i / SMOKE_SEGMENTS;
    pos.push(u, -1, 0, u, 1, 0);
    if (i < SMOKE_SEGMENTS) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

const smokeVertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec3 aStart;
  attribute vec3 aDrift;
  attribute vec2 aLook;
  varying vec2 vUv;
  varying float vFade;
  varying float vDensity;
  void main() {
    float u = position.x;
    // Out along the drift, rising and spreading as it goes.
    vec3 axis = aStart + aDrift * u + vec3(0.0, 34.0 * sqrt(u), 0.0);
    vec3 toEye = normalize(cameraPosition - axis);
    vec3 along = normalize(aDrift + vec3(0.0, 1e-3, 0.0));
    vec3 across = normalize(cross(along, toEye));
    float w = 5.0 + 40.0 * u;
    vec4 mvPosition = viewMatrix * vec4(axis + across * position.y * w, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vUv = vec2(u, position.y);
    vFade = aLook.x;
    vDensity = aLook.y;
    #include <fog_vertex>
  }
`;
const smokeFragment = /* glsl */ `
  #include <fog_pars_fragment>
  varying vec2 vUv;
  varying float vFade;
  varying float vDensity;
  uniform float uTime;
  float hash(vec2 p) {
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
  void main() {
    float u = vUv.x;
    // Thick at the funnel, thinning out; soft at the edges; puffy.
    float edge = 1.0 - vUv.y * vUv.y;
    float n = noise(vec2(u * 9.0 - uTime * 0.25, vUv.y * 1.5)) * 0.6
      + noise(vec2(u * 23.0 - uTime * 0.5, vUv.y * 3.0)) * 0.4;
    float a = edge * pow(1.0 - u, 1.4) * smoothstep(0.0, 0.04, u)
      * (0.55 + 0.45 * n) * vDensity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(0.075, 0.078, 0.08), a);
    #include <fog_fragment>
    #ifdef USE_FOG
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, vFade);
    #endif
  }
`;

/** The wind (m/s, scene axes): her own smoke's drift when she lies stopped. */
const WIND_X = -1.5;
const WIND_Z = -0.25;
/** Seconds of smoke a plume shows (its length is the drift over them). */
const SMOKE_S = 75;

export default function Convoy({ store }: { store: PlaybackStore }) {
  const parts = useMemo(() => {
    const geo = buildSteamerGeometry();
    const paint = new InstancedBufferAttribute(
      new Float32Array(CONVOY.length),
      1
    );
    const fade = new InstancedBufferAttribute(
      new Float32Array(CONVOY.length),
      1
    );
    geo.setAttribute("aPaint", paint);
    geo.setAttribute("aFade", fade);
    // Both sides: the hull's flat shapes need no winding care.
    const mat = new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${vertexHead}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vLocal = position; vPart = aPart; vPaint = aPaint; vFade = aFade;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${fragmentHead}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          diffuseColor.rgb = paintOf(vLocal, vPart, vPaint);`
        )
        .replace(
          "#include <fog_fragment>",
          `#include <fog_fragment>
          #ifdef USE_FOG
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, vFade);
          #endif`
        );
    };
    mat.customProgramCacheKey = () => "shipwreck-convoy";
    const mesh = new InstancedMesh(geo, mat, CONVOY.length);
    mesh.name = "convoy";
    // The instances move kilometres: never culled on a stale bound.
    mesh.frustumCulled = false;
    // Their smoke: one ribbon each, facing the camera along its length.
    const smokeGeo = buildSmokeGeometry();
    const n = CONVOY.length;
    const start = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const drift = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const look = new InstancedBufferAttribute(new Float32Array(n * 2), 2);
    smokeGeo.setAttribute("aStart", start);
    smokeGeo.setAttribute("aDrift", drift);
    smokeGeo.setAttribute("aLook", look);
    const smokeMat = new ShaderMaterial({
      vertexShader: smokeVertex,
      fragmentShader: smokeFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: true,
      uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 } }]),
    });
    const smoke = new Mesh(smokeGeo, smokeMat);
    smoke.name = "convoy-smoke";
    smoke.frustumCulled = false;
    return {
      geo,
      mat,
      mesh,
      paint,
      fade,
      smoke,
      smokeGeo,
      smokeMat,
      start,
      drift,
      look,
      dummy: new Object3D(),
    };
  }, []);
  useEffect(
    () => () => {
      parts.geo.dispose();
      parts.mat.dispose();
      parts.mesh.dispose();
      parts.smokeGeo.dispose();
      parts.smokeMat.dispose();
    },
    [parts]
  );

  // After the camera rig (-1), before the sea's reflection (-0.5).
  useFrame((state) => {
    const { t, torpedoes } = store.getState();
    const cam = state.camera.position;
    const { mesh, dummy, paint, fade, smoke, start, drift, look } = parts;
    // Under water the sea's underside hides them: no draw.
    if (cam.y < 0) {
      mesh.visible = false;
      smoke.visible = false;
      return;
    }
    const at = scatterAtOf(torpedoes);
    let n = 0;
    for (const ship of CONVOY) {
      const p = convoyPose(ship, t, at);
      const d = Math.hypot(p.x - cam.x, p.z - cam.z);
      const drop = hullDownM(d, cam.y);
      if (!convoyShown(d, drop)) continue;
      const s = ship.lengthM / STEAMER_LENGTH_M;
      dummy.position.set(p.x, -drop, p.z);
      dummy.rotation.set(0, -p.heading, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      paint.setX(n, PAINT_ID[ship.paint]);
      const f = convoyFade(d);
      fade.setX(n, f);
      // The funnel's top (the shape's -0.6, 21), and the smoke's drift:
      // the wind less her own way, over `SMOKE_S`; heavier at full speed.
      const c = Math.cos(p.heading);
      const sn = Math.sin(p.heading);
      start.setXYZ(n, p.x - 0.6 * s * c, 21 * s - drop, p.z - 0.6 * s * sn);
      drift.setXYZ(
        n,
        (WIND_X - p.speed * c) * SMOKE_S,
        0,
        (WIND_Z - p.speed * sn) * SMOKE_S
      );
      look.setXY(
        n,
        f,
        0.6 + 0.35 * Math.min(1, Math.max(0, (p.speed - 5) / 1.6))
      );
      n += 1;
    }
    parts.smokeGeo.instanceCount = n;
    smoke.visible = n > 0;
    start.needsUpdate = true;
    drift.needsUpdate = true;
    look.needsUpdate = true;
    parts.smokeMat.uniforms.uTime.value = state.clock.elapsedTime;
    mesh.count = n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
    paint.needsUpdate = true;
    fade.needsUpdate = true;
  }, -0.6);

  return (
    <>
      <primitive object={parts.mesh} />
      <primitive object={parts.smoke} />
    </>
  );
}
