"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import { seeded } from "@/lib/planet-smasher/rng";
import { useGameStore } from "@/lib/planet-smasher/store";
import {
  dirToUv,
  moveOnSphere,
  surfaceBasis,
  uvToDir,
  type Vec3,
} from "@/lib/planet-smasher/sphere";
import {
  clamp01,
  rand,
  shake,
  stepDt,
  tangentBasisInto,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";
import { shouldWindDown, windDownFactor } from "./windDown";

export const TSUNAMI_HITS = 16;
const FIRST_HIT = 0.4;
const LAST_HIT = 3;
const R_FIRST = 0.2;
/** How far the wave travels (rad). */
export const TSUNAMI_REACH = 1.2;
const GROW_END = 3;
const FADE_START = 2.4;
const END = 3.9;

/**
 * The 16 spots the wave floods: on rings from 0.2 to 1.2 rad around the tap,
 * each one at a new angle (a golden-angle spread, jittered), hit at the moment
 * the wave front reaches it (0.4 s for the first, 3 s for the last).
 */
export function tsunamiHits(
  u: number,
  v: number,
  seed: number
): { u: number; v: number; t: number }[] {
  const rnd = seeded(seed);
  const origin: Vec3 = uvToDir(u, v);
  const { east, north } = surfaceBasis(origin);
  const base = rnd() * Math.PI * 2;
  const out: { u: number; v: number; t: number }[] = [];
  for (let i = 0; i < TSUNAMI_HITS; i++) {
    const k = i / (TSUNAMI_HITS - 1);
    const r = R_FIRST + k * (TSUNAMI_REACH - R_FIRST);
    const a = base + i * 2.399963 + (rnd() - 0.5) * 0.5;
    const tangent: Vec3 = {
      x: east.x * Math.cos(a) + north.x * Math.sin(a),
      y: east.y * Math.cos(a) + north.y * Math.sin(a),
      z: east.z * Math.cos(a) + north.z * Math.sin(a),
    };
    const p = moveOnSphere(origin, tangent, r).p;
    const uv = dirToUv(p);
    out.push({ ...uv, t: FIRST_HIT + k * (LAST_HIT - FIRST_HIT) });
  }
  return out;
}

/** Where the wave front is (rad from the tap) at time `t`. */
export function tsunamiFront(t: number): number {
  if (t <= 0) return 0;
  if (t < FIRST_HIT) return R_FIRST * (t / FIRST_HIT);
  const k = clamp01((t - FIRST_HIT) / (LAST_HIT - FIRST_HIT));
  return R_FIRST + k * (TSUNAMI_REACH - R_FIRST);
}

/* ------------------------------------------------------------------ */
/* The wave mesh: positioned on the sphere in the vertex shader         */
/* ------------------------------------------------------------------ */

const SEGS = 160;
const ROWS = 8;

const VERTEX = `
attribute vec2 aP;
uniform vec3 uDir;
uniform vec3 uT1;
uniform vec3 uT2;
uniform float uInner;
uniform float uOuter;
uniform float uR;
uniform float uCrest;
uniform float uTime;
varying float vK;
varying float vTh;
void main() {
  float th = aP.x;
  float k = aP.y;
  // A ragged crest, and a lip that rises towards the front of the band.
  float rag = 0.5 + 0.5 * sin(th * 9.0 + uTime * 3.0) * sin(th * 5.0 - uTime * 2.0);
  float a = mix(uInner, uOuter, k) + 0.025 * rag * k;
  float lip = pow(k, 3.0) * (1.0 - smoothstep(0.9, 1.0, k) * 0.6);
  float rad = uR * (1.005 + uCrest * 0.04 * lip * (0.6 + 0.6 * rag));
  vec3 dir = uDir * cos(a) + (uT1 * cos(th) + uT2 * sin(th)) * sin(a);
  vK = k;
  vTh = th;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * rad, 1.0);
}`;

const FRAGMENT = `
uniform float uOpacity;
uniform float uTime;
varying float vK;
varying float vTh;
void main() {
  float n = 0.5 + 0.5 * sin(vTh * 31.0 + uTime * 5.0 + vK * 9.0) * sin(vTh * 13.0 - uTime * 3.0);
  vec3 deep = vec3(0.05, 0.36, 0.7);
  vec3 shallow = vec3(0.4, 0.78, 0.95);
  float crest = smoothstep(0.84, 0.98, vK);
  vec3 col = mix(deep, shallow, vK);
  col = mix(col, vec3(1.0), clamp(crest * (0.7 + 0.3 * n) + 0.14 * n * smoothstep(0.35, 1.0, vK), 0.0, 1.0));
  float a = uOpacity * (0.2 + 0.7 * pow(vK, 1.5)) * smoothstep(0.0, 0.14, vK);
  gl_FragColor = vec4(col, a);
}`;

function ringGeometry(): BufferGeometry {
  const p: number[] = [];
  for (let i = 0; i <= SEGS; i++) {
    for (let j = 0; j <= ROWS; j++) {
      p.push((i / SEGS) * Math.PI * 2, j / ROWS);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < SEGS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const a = i * (ROWS + 1) + j;
      const b = (i + 1) * (ROWS + 1) + j;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("aP", new Float32BufferAttribute(p, 2));
  // The positions come from the shader; this keeps three.js happy.
  g.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array((SEGS + 1) * (ROWS + 1) * 3), 3)
  );
  g.setIndex(index);
  return g;
}

const FOAM: readonly [number, number, number] = [0.9, 0.97, 1];
const FOAM_END: readonly [number, number, number] = [0.45, 0.75, 0.95];
const MUD: readonly [number, number, number] = [0.5, 0.45, 0.36];
const MUD_END: readonly [number, number, number] = [0.4, 0.36, 0.3];

const dir = new Vector3();
const point = new Vector3();
const t1 = new Vector3();
const t2 = new Vector3();
const fl1 = new Vector3();
const fl2 = new Vector3();

/**
 * The tsunami: a blue-white ring of water (one shader mesh, plus foam in the
 * shared particle pool) that rolls out from the tap to 1.2 rad over 3 s. When
 * the front reaches each of 16 spots it floods them (`onImpact`, which paints
 * the "flood" stamp). About 4 s. One draw call.
 */
export default function Tsunami({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const age = useRef(0);
  const done = useRef(false);
  const next = useRef(0);
  const foamDebt = useRef(0);
  const muted = useRef(false);
  const mutedAt = useRef(0);
  const foam = useSharedParticles(true, 0);
  const smoke = useSharedParticles(false, 0);

  const hits = useMemo(
    () => tsunamiHits(effect.u, effect.v, Math.floor(rand(0, 1e9))),
    [effect.u, effect.v]
  );
  const origin = useMemo(() => {
    const d = uvToDir(effect.u, effect.v);
    return new Vector3(d.x, d.y, d.z).normalize();
  }, [effect.u, effect.v]);

  const mesh = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        uDir: { value: origin.clone() },
        uT1: { value: new Vector3() },
        uT2: { value: new Vector3() },
        uInner: { value: 0 },
        uOuter: { value: 0 },
        uR: { value: planetRadius },
        uCrest: { value: 1 },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    tangentBasisInto(origin, mat.uniforms.uT1.value, mat.uniforms.uT2.value);
    const m = new Mesh(ringGeometry(), mat);
    m.frustumCulled = false;
    m.renderOrder = 2;
    m.visible = false;
    return m;
  }, [origin, planetRadius]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    },
    [mesh]
  );

  const meshRef = useLatest(mesh);

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    const prev = age.current;
    age.current += dt;
    const now = age.current;
    if (!muted.current && shouldWindDown(useGameStore.getState().phase)) {
      muted.current = true;
      mutedAt.current = now;
    }
    if (prev === 0) shake(0.015, 0.8);

    const front = tsunamiFront(now);
    const fade =
      Math.min(1, now * 6) *
      (1 - clamp01((now - FADE_START) / (END - FADE_START))) *
      (muted.current ? windDownFactor(now - mutedAt.current) : 1);
    const band = 0.04 + 0.08 * Math.min(1, front / 0.5);
    const mesh = meshRef.current;
    const u = (mesh.material as ShaderMaterial).uniforms;
    u.uTime.value = now;
    u.uInner.value = Math.max(0, front - band);
    u.uOuter.value = front + 0.012;
    u.uOpacity.value = fade;
    // The crest builds, then flattens as the wave spreads out.
    u.uCrest.value =
      Math.min(1, front / 0.3) * (1 - 0.5 * clamp01(front / 1.2));
    mesh.visible = fade > 0.01 && front > 0.005;

    // Foam along the leading edge.
    if (now < GROW_END + 0.3 && fade > 0.05) {
      foamDebt.current += dt * 90;
      const n = Math.min(8, Math.floor(foamDebt.current));
      foamDebt.current -= n;
      tangentBasisInto(origin, t1, t2);
      for (let i = 0; i < n; i++) {
        const th = rand(0, Math.PI * 2);
        const c = Math.cos(front);
        const s = Math.sin(front);
        dir
          .copy(origin)
          .multiplyScalar(c)
          .addScaledVector(t1, Math.cos(th) * s)
          .addScaledVector(t2, Math.sin(th) * s);
        // Outward along the surface, and up.
        fl1
          .copy(origin)
          .multiplyScalar(-s)
          .addScaledVector(t1, Math.cos(th) * c)
          .addScaledVector(t2, Math.sin(th) * c);
        foam.emit({
          x: dir.x * planetRadius * 1.02,
          y: dir.y * planetRadius * 1.02,
          z: dir.z * planetRadius * 1.02,
          vx: fl1.x * 0.2 + dir.x * rand(0.05, 0.25),
          vy: fl1.y * 0.2 + dir.y * rand(0.05, 0.25),
          vz: fl1.z * 0.2 + dir.z * rand(0.05, 0.25),
          life: rand(0.4, 0.8),
          size: rand(0.035, 0.07),
          endSize: 0.015,
          color: FOAM,
          endColor: FOAM_END,
          alpha: 0.7 * fade,
          drag: 0.6,
        });
      }
    }

    // Each spot floods as the front reaches it.
    while (next.current < hits.length && now >= hits[next.current].t) {
      const h = hits[next.current++];
      if (muted.current) continue;
      const d = uvToDir(h.u, h.v);
      point.set(d.x, d.y, d.z).normalize();
      shake(0.01, 0.3);
      tangentBasisInto(point, fl1, fl2);
      for (let i = 0; i < 9; i++) {
        const a = rand(0, Math.PI * 2);
        const out = rand(0.05, 0.25);
        const up = rand(0.4, 1.1);
        foam.emit({
          x: point.x * planetRadius * 1.01,
          y: point.y * planetRadius * 1.01,
          z: point.z * planetRadius * 1.01,
          vx: point.x * up + (fl1.x * Math.cos(a) + fl2.x * Math.sin(a)) * out,
          vy: point.y * up + (fl1.y * Math.cos(a) + fl2.y * Math.sin(a)) * out,
          vz: point.z * up + (fl1.z * Math.cos(a) + fl2.z * Math.sin(a)) * out,
          life: rand(0.5, 1),
          size: rand(0.03, 0.06),
          endSize: 0.012,
          color: FOAM,
          endColor: FOAM_END,
          alpha: 0.85,
          pull: 2.5,
        });
      }
      smoke.emit({
        x: point.x * planetRadius * 1.01,
        y: point.y * planetRadius * 1.01,
        z: point.z * planetRadius * 1.01,
        life: 0.9,
        size: 0.09,
        endSize: 0.18,
        color: MUD,
        endColor: MUD_END,
        alpha: 0.5,
      });
      cb.current.onImpact(h.u, h.v, { x: point.x, y: point.y, z: point.z });
    }

    if (now > END && !done.current) {
      done.current = true;
      cb.current.onDone();
    }
  });

  return <primitive object={mesh} />;
}
