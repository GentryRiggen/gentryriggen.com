"use client";
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { deckLevel, makeDeckWater } from "@/lib/shipwreck/sim/deckWater";
import { buildHull } from "@/lib/shipwreck/sim/geometry";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { shipToThreeInto, type V3 } from "./cameraMath";
import { MAX_LAMPS, type SceneRuntime } from "./runtime";
import { STORM_NIGHT_WHITE, stormDaylight } from "./storm";

/**
 * Green water on her deck: the sim's own (`SimFrame.deckWater`, each bay's
 * m³) drawn as a level sheet over each bay at the level that holds it on
 * her cambered, listed deck (`deckLevel`, the sim's), on the low side
 * first, foaming. The seas sweeping over her edge are the sea mesh itself;
 * this is the water they leave standing round the hatches for a few
 * seconds. Only while she floats whole; not on the title's stage (its sea
 * runs on the wall clock, not the sim's). One draw.
 */

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aFoam;
  varying vec3 vWorld;
  varying float vFoam;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vFoam = aFoam;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const fragment = /* glsl */ `
  #include <fog_pars_fragment>
  varying vec3 vWorld;
  varying float vFoam;
  uniform float uLight;
  uniform float uWhite;
  uniform float uTime;
  uniform vec3 uLamps[${MAX_LAMPS}];
  uniform int uLampCount;
  uniform float uLampPower;
  uniform vec3 uOrigin;
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
  float lamps() {
    float s = 0.0;
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      if (i >= uLampCount) break;
      vec3 d = uLamps[i] - vWorld;
      s += 1.0 / (1.0 + dot(d, d) / 600.0);
    }
    return s;
  }
  void main() {
    vec2 p = vWorld.xz - uOrigin.xz;
    float churn = noise(p * 0.9 + vec2(uTime * 1.3, -uTime * 0.7)) * 0.6
      + noise(p * 2.7 - vec2(uTime * 2.1, uTime)) * 0.4;
    float foam = clamp(vFoam * (0.45 + 0.75 * churn), 0.0, 1.0);
    float lamp = lamps() * uLampPower * 1.4;
    vec3 water = vec3(0.05, 0.11, 0.1) * (uLight + lamp);
    // Its churn keeps a night floor of light (as the storm's other white
    // things: README).
    vec3 c = mix(water, vec3(0.7, 0.75, 0.75) * (max(uLight, uWhite) + lamp), foam);
    gl_FragColor = vec4(c, 0.55 + 0.4 * foam);
    #include <fog_fragment>
  }
`;

interface GreenWaterProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  spec: ShipSpec;
}

export default function GreenWater({ store, runtime, spec }: GreenWaterProps) {
  const deck = useMemo(() => makeDeckWater(spec, buildHull(spec)), [spec]);
  const n = deck?.n ?? 0;
  const mesh = useMemo(() => {
    // Two quads a bay: its starboard and port halves.
    const quads = n * 2;
    const g = new BufferGeometry();
    const pos = new BufferAttribute(new Float32Array(quads * 4 * 3), 3);
    pos.setUsage(DynamicDrawUsage);
    const foam = new BufferAttribute(new Float32Array(quads * 4), 1);
    foam.setUsage(DynamicDrawUsage);
    g.setAttribute("position", pos);
    g.setAttribute("aFoam", foam);
    const idx: number[] = [];
    for (let q = 0; q < quads; q += 1) {
      const o = q * 4;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    const mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uLight: { value: 1 },
          uWhite: { value: STORM_NIGHT_WHITE },
          uTime: { value: 0 },
          uLamps: { value: new Float32Array(3 * MAX_LAMPS) },
          uLampCount: { value: 0 },
          uLampPower: { value: 0 },
          uOrigin: { value: new Vector3() },
        },
      ]),
    });
    const m = new Mesh(g, mat);
    m.name = "green-water";
    m.frustumCulled = false;
    m.renderOrder = 2;
    return { m, g, mat, pos, foam };
  }, [n]);
  useEffect(
    () => () => {
      mesh.g.dispose();
      mesh.mat.dispose();
    },
    [mesh]
  );
  const scratch = useMemo(
    () => ({
      p: [0, 0, 0] as number[],
      out: [0, 0, 0] as V3,
      // Each bay's water as drawn: it lingers about a second of wall time
      // after the sim's runs off (foam does; a look, README), so a wet
      // spell of a few seconds still shows at ×10.
      shown: new Float64Array(64),
      lastT: -Infinity,
    }),
    []
  );

  useFrame((state, dt) => {
    const s = store.getState();
    const frame = runtime.frame;
    const vol = frame?.deckWater;
    const shown = scratch.shown;
    // A seek (or going back): draw the sim's water as it is.
    const jump =
      !frame || frame.t < scratch.lastT || frame.t > scratch.lastT + 30;
    scratch.lastT = frame?.t ?? -Infinity;
    const keep = jump ? 0 : Math.exp(-Math.min(0.1, dt) / 0.5);
    if (vol)
      for (let i = 0; i < vol.length && i < shown.length; i += 1)
        shown[i] = Math.max(vol[i], shown[i] * keep);
    mesh.g.setDrawRange(0, 0);
    if (!deck || !frame || !vol || s.preview || s.xray) return;
    const body = frame.bodies[0];
    if (frame.bodies.length !== 1 || body.part !== "whole") return;
    const P = mesh.pos.array as Float32Array;
    const F = mesh.foam.array as Float32Array;
    const sp = Math.sin(body.pitch);
    const cp = Math.cos(body.pitch);
    const sr = Math.sin(body.roll);
    const cr = Math.cos(body.roll);
    let q = 0;
    for (let i = 0; i < deck.n && i < vol.length; i += 1) {
      const v = shown[i];
      const len = deck.x1[i] - deck.x0[i];
      if (v < 0.2 || len <= 0) continue;
      const x = deck.xm[i];
      const y = deck.hb[i];
      const base = body.z - sp * x + cp * cr * deck.zEdge[i];
      const zs = base - cp * sr * y;
      const zp = base + cp * sr * y;
      const zc = base + cp * cr * deck.camber;
      const L = deckLevel(zs, zc, zp, y, v / len) + 0.04;
      // How much is churning (thin water is all foam).
      const foam = Math.min(1, 0.35 + v / (len * y * 0.6));
      // Starboard half (y from -hb to 0), then port (0 to hb).
      for (let h = 0; h < 2; h += 1) {
        const y0 = h === 0 ? -y : 0;
        const z0 = h === 0 ? zs : zc;
        const y1 = h === 0 ? 0 : y;
        const z1 = h === 0 ? zc : zp;
        if (z0 >= L && z1 >= L) continue;
        const cut = (L - z0) / (z1 - z0);
        const a = z0 < L ? y0 : y0 + (y1 - y0) * cut;
        const b = z1 < L ? y1 : y0 + (y1 - y0) * cut;
        corner(P, q * 4, body, deck.x0[i], a, L, cp, cr, sp, sr, scratch);
        corner(P, q * 4 + 1, body, deck.x1[i], a, L, cp, cr, sp, sr, scratch);
        corner(P, q * 4 + 2, body, deck.x1[i], b, L, cp, cr, sp, sr, scratch);
        corner(P, q * 4 + 3, body, deck.x0[i], b, L, cp, cr, sp, sr, scratch);
        for (let k = 0; k < 4; k += 1) F[q * 4 + k] = foam;
        q += 1;
      }
    }
    if (q === 0) return;
    mesh.pos.needsUpdate = true;
    mesh.foam.needsUpdate = true;
    mesh.g.setDrawRange(0, q * 6);
    const u = mesh.mat.uniforms;
    u.uLight.value = 0.03 + 0.97 * stormDaylight(frame.t);
    u.uTime.value = state.clock.elapsedTime;
    u.uLamps.value = runtime.lamps;
    u.uLampCount.value = runtime.lampCount;
    u.uLampPower.value = runtime.lampPower;
    (u.uOrigin.value as Vector3).set(
      Math.round(body.x / 1000) * 1000,
      0,
      -Math.round(body.y / 1000) * 1000
    );
  }, -1.4);

  return <primitive object={mesh.m} />;
}

/**
 * A corner of the water's sheet: the ship-frame (x, y) on the level
 * surface at earth height L (the z that puts it there), in three.js.
 */
function corner(
  P: Float32Array,
  v: number,
  body: BodyPose,
  x: number,
  y: number,
  L: number,
  cp: number,
  cr: number,
  sp: number,
  sr: number,
  s: { p: number[]; out: V3 }
): void {
  s.p[0] = x;
  s.p[1] = y;
  s.p[2] = (L - body.z + sp * x - cp * sr * y) / Math.max(0.2, cp * cr);
  shipToThreeInto(body, s.p, s.out);
  P[v * 3] = s.out[0];
  P[v * 3 + 1] = s.out[1];
  P[v * 3 + 2] = s.out[2];
}
